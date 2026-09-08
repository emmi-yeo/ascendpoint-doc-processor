import os
import json
import time
import logging
import urllib.parse
import httpx
from utils.db import get_db

logger = logging.getLogger(__name__)

XPM_CLIENT_ID = os.getenv("XPM_CLIENT_ID")
XPM_CLIENT_SECRET = os.getenv("XPM_CLIENT_SECRET")
APP_URL = os.getenv("APP_URL", "http://localhost:5173")
REDIRECT_URI = f"{APP_URL}/api/admin/xpm/callback"

XERO_AUTH_URL = "https://login.xero.com/identity/connect/authorize"
XERO_TOKEN_URL = "https://identity.xero.com/connect/token"
XERO_CONNECTIONS_URL = "https://api.xero.com/connections"
XPM_API_BASE = "https://api.xero.com/practicemgr/1.0"
SCOPES = "openid profile email offline_access practicemgr"


def get_authorize_url() -> str:
    params = {
        "response_type": "code",
        "client_id": XPM_CLIENT_ID,
        "redirect_uri": REDIRECT_URI,
        "scope": SCOPES,
        "state": "xpm_connect",
    }
    return f"{XERO_AUTH_URL}?{urllib.parse.urlencode(params)}"


def exchange_code(code: str) -> dict:
    resp = httpx.post(XERO_TOKEN_URL, data={
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": REDIRECT_URI,
        "client_id": XPM_CLIENT_ID,
        "client_secret": XPM_CLIENT_SECRET,
    })
    resp.raise_for_status()
    return resp.json()


def _refresh(refresh_token: str) -> dict:
    resp = httpx.post(XERO_TOKEN_URL, data={
        "grant_type": "refresh_token",
        "refresh_token": refresh_token,
        "client_id": XPM_CLIENT_ID,
        "client_secret": XPM_CLIENT_SECRET,
    })
    resp.raise_for_status()
    return resp.json()


def get_valid_token() -> tuple:
    """Returns (access_token, tenant_id), refreshing if needed."""
    with get_db() as conn:
        row = conn.execute("SELECT * FROM xpm_tokens ORDER BY id DESC LIMIT 1").fetchone()
    if not row:
        raise RuntimeError("XPM not connected. Please connect via the admin panel.")
    t = dict(row)
    if t["expires_at"] - time.time() < 300:
        new = _refresh(t["refresh_token"])
        expires_at = time.time() + new.get("expires_in", 1800)
        with get_db() as conn:
            conn.execute(
                "UPDATE xpm_tokens SET access_token=?, refresh_token=?, expires_at=? WHERE id=?",
                (new["access_token"], new.get("refresh_token", t["refresh_token"]), expires_at, t["id"]),
            )
        return new["access_token"], t["tenant_id"]
    return t["access_token"], t["tenant_id"]


def save_tokens(tokens: dict, tenant_id: str):
    expires_at = time.time() + tokens.get("expires_in", 1800)
    with get_db() as conn:
        conn.execute("DELETE FROM xpm_tokens")
        conn.execute(
            "INSERT INTO xpm_tokens (access_token, refresh_token, expires_at, tenant_id) VALUES (?, ?, ?, ?)",
            (tokens["access_token"], tokens["refresh_token"], expires_at, tenant_id),
        )


def get_tenant_id(access_token: str) -> str:
    resp = httpx.get(
        XERO_CONNECTIONS_URL,
        headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"},
    )
    resp.raise_for_status()
    connections = resp.json()
    for c in connections:
        if c.get("tenantType") == "PRACTICE":
            return c["tenantId"]
    if connections:
        return connections[0]["tenantId"]
    raise RuntimeError("No Xero tenants found")


def _xpm_get(path: str) -> dict:
    access_token, tenant_id = get_valid_token()
    resp = httpx.get(
        f"{XPM_API_BASE}{path}",
        headers={
            "Authorization": f"Bearer {access_token}",
            "Xero-tenant-id": tenant_id,
            "Accept": "application/json",
        },
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def fetch_all_clients() -> list:
    data = _xpm_get("/client")
    clients = data.get("Clients", {}).get("Client", [])
    if isinstance(clients, dict):
        clients = [clients]
    return clients


def sync_clients_cache() -> int:
    clients = fetch_all_clients()
    with get_db() as conn:
        conn.execute("DELETE FROM xpm_clients_cache")
        for c in clients:
            client_id = c.get("UUID", "")
            name = c.get("Name", "").strip()
            if not name:
                name = f"{c.get('LastName', '')} {c.get('FirstName', '')}".strip()
            manager = c.get("Manager") or {}
            if isinstance(manager, str):
                job_admin_name, job_admin_email = manager, ""
            else:
                job_admin_name = manager.get("Name", "")
                job_admin_email = manager.get("Email", "")
            conn.execute(
                "INSERT INTO xpm_clients_cache (xpm_client_id, name, job_admin_name, job_admin_email, raw_json) VALUES (?, ?, ?, ?, ?)",
                (client_id, name, job_admin_name, job_admin_email, json.dumps(c)),
            )
    logger.info(f"Synced {len(clients)} clients from XPM")
    return len(clients)


def fuzzy_match_client(client_name: str, threshold: int = 55) -> list:
    from rapidfuzz import fuzz
    with get_db() as conn:
        rows = [dict(r) for r in conn.execute("SELECT * FROM xpm_clients_cache").fetchall()]
    results = []
    for row in rows:
        score = fuzz.token_sort_ratio(client_name.lower(), row["name"].lower())
        if score >= threshold:
            results.append({"score": score, "client": row})
    results.sort(key=lambda x: x["score"], reverse=True)
    return results[:5]


def is_connected() -> bool:
    with get_db() as conn:
        return conn.execute("SELECT id FROM xpm_tokens LIMIT 1").fetchone() is not None


def client_cache_count() -> int:
    with get_db() as conn:
        return conn.execute("SELECT COUNT(*) FROM xpm_clients_cache").fetchone()[0]
