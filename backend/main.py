import logging
import os
import uuid
import zipfile
import json
import asyncio
from collections import deque
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from jose import jwt, JWTError
import hashlib, secrets as _secrets

from utils.pdf_splitter import split_pdf
from utils.ai_namer import name_document, generate_filename
from utils.db import (
    init_db, get_user_by_email, get_user_by_id, create_user,
    list_users, update_user, delete_user, create_reset_token, consume_reset_token,
)
from utils.email_sender import send_reset_email

# ── Logging ───────────────────────────────────────────────────────────────────

class _MemoryHandler(logging.Handler):
    def __init__(self, maxlen=500):
        super().__init__()
        self._buf: deque = deque(maxlen=maxlen)

    def emit(self, record: logging.LogRecord):
        self._buf.appendleft({
            "ts": datetime.utcfromtimestamp(record.created).strftime("%Y-%m-%d %H:%M:%S"),
            "level": record.levelname,
            "logger": record.name,
            "message": self.format(record),
        })

    def entries(self, level: Optional[str] = None, limit: int = 200) -> list:
        out = [e for e in self._buf if not level or e["level"] == level]
        return out[:limit]


_mem_handler = _MemoryHandler()
_mem_handler.setFormatter(logging.Formatter("%(message)s"))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logging.getLogger().addHandler(_mem_handler)
logger = logging.getLogger("main")

# ── Auth ──────────────────────────────────────────────────────────────────────

JWT_SECRET = os.getenv("JWT_SECRET", "change-this-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = 10
APP_URL = os.getenv("APP_URL", "http://localhost:5173")

# Gemini 3.1 Flash-Lite pricing (USD per 1M tokens) — update if model/pricing changes
GEMINI_INPUT_COST_PER_M = 0.25
GEMINI_OUTPUT_COST_PER_M = 1.50

# Persistent audit log — lives alongside the SQLite DB on GCS mount
_DB_DIR = Path(os.path.dirname(os.getenv("DB_PATH", "/tmp/ascend.db")))
AUDIT_LOG_PATH = _DB_DIR / "audit.log"


def _append_audit(entry: dict):
    try:
        with open(AUDIT_LOG_PATH, "a") as f:
            f.write(json.dumps(entry) + "\n")
    except Exception:
        pass


def _load_audit_entries(level: Optional[str] = None, limit: int = 200) -> list:
    try:
        with open(AUDIT_LOG_PATH) as f:
            lines = f.readlines()
        entries = []
        for line in reversed(lines):
            try:
                e = json.loads(line.strip())
                if not level or e.get("level") == level:
                    entries.append(e)
                if len(entries) >= limit:
                    break
            except Exception:
                pass
        return entries
    except FileNotFoundError:
        return []


def _audit(level: str, logger_name: str, message: str, meta: Optional[dict] = None):
    entry = {
        "ts": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"),
        "level": level,
        "logger": logger_name,
        "message": message,
    }
    if meta:
        entry["meta"] = meta
    _append_audit(entry)
    # Also emit to memory handler and stdout via standard logging
    logging.getLogger(logger_name).log(getattr(logging, level), message)

_security = HTTPBearer()


def _hash_password(password: str) -> str:
    salt = _secrets.token_hex(16)
    h = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 260000).hex()
    return f"{salt}${h}"


def _verify_password(password: str, stored: str) -> bool:
    try:
        salt, h = stored.split("$", 1)
        return hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 260000).hex() == h
    except Exception:
        return False


def _create_token(email: str, is_admin: bool) -> str:
    expire = datetime.utcnow() + timedelta(hours=JWT_EXPIRY_HOURS)
    return jwt.encode(
        {"sub": email, "is_admin": is_admin, "exp": expire},
        JWT_SECRET, algorithm=JWT_ALGORITHM,
    )


async def require_auth(credentials: HTTPAuthorizationCredentials = Depends(_security)) -> dict:
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        email = payload.get("sub")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired session. Please log in again.")
    user = get_user_by_email(email)
    if not user or not user["is_active"]:
        raise HTTPException(status_code=401, detail="Account not found or deactivated.")
    return user


async def require_admin(user: dict = Depends(require_auth)) -> dict:
    if not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required.")
    return user


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(title="AscendPoint Document Processor")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

SESSIONS_DIR = Path("/tmp/sessions")
SESSIONS_DIR.mkdir(exist_ok=True)

init_db()
logger.info("Database initialised")

# ── Auth endpoints ─────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


@app.post("/api/auth/register")
def register(req: RegisterRequest):
    email = req.email.strip().lower()
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Invalid email address.")
    if len(req.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters.")
    if get_user_by_email(email):
        raise HTTPException(status_code=409, detail="An account with this email already exists.")
    pw_hash = _hash_password(req.password)
    user = create_user(email, pw_hash)
    logger.info(f"New user registered: {email} (admin={user['is_admin']}, active={user['is_active']})")
    if user["is_admin"]:
        return {"token": _create_token(email, True), "is_admin": True}
    return {"pending": True}


@app.post("/api/auth/login")
def login(req: LoginRequest):
    email = req.email.strip().lower()
    user = get_user_by_email(email)
    if not user or not _verify_password(req.password, user["password_hash"]):
        logger.warning(f"Failed login for {email}")
        raise HTTPException(status_code=401, detail="Incorrect email or password.")
    if not user["is_active"]:
        raise HTTPException(status_code=403, detail="Your account is pending approval. Please contact your admin.")
    _audit("INFO", "auth", f"User logged in: {email}")
    return {"token": _create_token(email, bool(user["is_admin"])), "is_admin": bool(user["is_admin"])}


@app.post("/api/auth/forgot-password")
def forgot_password(req: ForgotPasswordRequest):
    email = req.email.strip().lower()
    user = get_user_by_email(email)
    smtp_configured = all([os.getenv("SMTP_HOST"), os.getenv("SMTP_USER"), os.getenv("SMTP_PASS")])
    if not smtp_configured:
        raise HTTPException(
            status_code=503,
            detail="Email is not configured on this system. Please ask your admin to send you a reset link directly.",
        )
    if user and user["is_active"]:
        token = create_reset_token(user["id"])
        reset_url = f"{APP_URL}?token={token}"
        try:
            send_reset_email(email, reset_url)
            logger.info(f"Password reset email sent to {email}")
        except Exception as e:
            logger.error(f"Failed to send reset email to {email}: {e}")
            raise HTTPException(status_code=500, detail="Failed to send reset email. Please check SMTP configuration.")
    else:
        logger.warning(f"Password reset requested for unknown/inactive email: {email}")
    return {"message": "If that email is registered, a reset link has been sent."}


@app.post("/api/auth/reset-password")
def reset_password(req: ResetPasswordRequest):
    if len(req.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters.")
    user_id = consume_reset_token(req.token)
    if not user_id:
        raise HTTPException(status_code=400, detail="Reset link is invalid or has expired.")
    pw_hash = _hash_password(req.new_password)
    update_user(user_id, password_hash=pw_hash)
    user = get_user_by_id(user_id)
    logger.info(f"Password reset for user_id={user_id}")
    return {"token": _create_token(user["email"], bool(user["is_admin"])), "is_admin": bool(user["is_admin"])}


# ── Admin endpoints ────────────────────────────────────────────────────────────

@app.get("/api/admin/logs")
def get_logs(level: Optional[str] = None, limit: int = 200, user: dict = Depends(require_auth)):
    logger.info(f"[{user['email']}] Viewed admin logs")
    file_entries = _load_audit_entries(level=level, limit=limit)
    if file_entries:
        return {"entries": file_entries}
    return {"entries": _mem_handler.entries(level=level, limit=limit)}


@app.get("/api/admin/users")
def get_users(admin: dict = Depends(require_admin)):
    logger.info(f"[{admin['email']}] Listed users")
    return {"users": list_users()}


class UpdateUserRequest(BaseModel):
    is_active: Optional[int] = None
    is_admin: Optional[int] = None


@app.patch("/api/admin/users/{user_id}")
def patch_user(user_id: int, req: UpdateUserRequest, admin: dict = Depends(require_admin)):
    if user_id == admin["id"] and req.is_admin == 0:
        raise HTTPException(status_code=400, detail="You cannot remove your own admin rights.")
    fields = {k: v for k, v in req.dict().items() if v is not None}
    update_user(user_id, **fields)
    logger.info(f"[{admin['email']}] Updated user {user_id}: {fields}")
    return {"ok": True}


@app.post("/api/admin/users/{user_id}/reset-link")
def admin_reset_link(user_id: int, admin: dict = Depends(require_admin)):
    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    token = create_reset_token(user_id)
    reset_url = f"{APP_URL}?token={token}"
    logger.info(f"[{admin['email']}] Generated reset link for user_id={user_id} ({user['email']})")
    return {"url": reset_url, "email": user["email"]}


@app.delete("/api/admin/users/{user_id}")
def remove_user(user_id: int, admin: dict = Depends(require_admin)):
    if user_id == admin["id"]:
        raise HTTPException(status_code=400, detail="You cannot delete your own account.")
    delete_user(user_id)
    logger.info(f"[{admin['email']}] Deleted user {user_id}")
    return {"ok": True}


# ── Document endpoints ─────────────────────────────────────────────────────────

@app.post("/api/upload")
async def upload_pdf(file: UploadFile = File(...), user: dict = Depends(require_auth)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    session_id = str(uuid.uuid4())
    session_dir = SESSIONS_DIR / session_id
    session_dir.mkdir()

    pdf_path = session_dir / "original.pdf"
    pdf_path.write_bytes(await file.read())

    import fitz
    doc = fitz.open(pdf_path)
    total_pages = doc.page_count
    doc.close()

    logger.info(f"[{user['email']}] Uploaded {file.filename!r} — {total_pages} pages — session {session_id}")
    return {"session_id": session_id, "total_pages": total_pages, "filename": file.filename}


class ProcessRequest(BaseModel):
    page_count: int


@app.post("/api/process/{session_id}")
async def process_documents(session_id: str, req: ProcessRequest, user: dict = Depends(require_auth)):
    session_dir = SESSIONS_DIR / session_id
    if not session_dir.exists():
        raise HTTPException(status_code=404, detail="Session not found")

    import fitz as _fitz
    _doc = _fitz.open(session_dir / "original.pdf")
    total_pages = _doc.page_count
    _doc.close()

    if total_pages % req.page_count != 0:
        raise HTTPException(
            status_code=400,
            detail=f"Total pages ({total_pages}) is not divisible by {req.page_count}",
        )

    page_counts = [req.page_count] * (total_pages // req.page_count)
    split_paths = await asyncio.to_thread(split_pdf, session_dir / "original.pdf", page_counts, session_dir)

    documents = []
    for i, (doc_path, page_count) in enumerate(zip(split_paths, page_counts)):
        try:
            ai = await asyncio.to_thread(name_document, doc_path)
            input_tok = ai.get("input_tokens", 0)
            output_tok = ai.get("output_tokens", 0)
            latency_ms = ai.get("latency_ms", 0)
            cost_usd = (input_tok * GEMINI_INPUT_COST_PER_M + output_tok * GEMINI_OUTPUT_COST_PER_M) / 1_000_000
            msg = (
                f"[{user['email']}] Doc {i+1}/{len(page_counts)} '{ai.get('doc_type')} / {ai.get('client_name')}' "
                f"— {input_tok}in+{output_tok}out tokens | ${cost_usd:.6f} | {latency_ms}ms"
            )
            _audit("INFO", "gemini", msg, meta={
                "input_tokens": input_tok,
                "output_tokens": output_tok,
                "cost_usd": round(cost_usd, 6),
                "latency_ms": latency_ms,
            })
            documents.append({
                "index": i,
                "page_count": page_count,
                "client_name": ai.get("client_name", ""),
                "doc_type": ai.get("doc_type", ""),
                "suggested_name": generate_filename(ai),
                "error": None,
            })
        except Exception as e:
            error_msg = str(e)
            _audit("ERROR", "gemini", f"[{user['email']}] Failed to process doc {i} in session {session_id}: {error_msg}")
            logger.error(f"[{user['email']}] Failed to process doc {i} in session {session_id}: {error_msg}")
            quota_hit = "429" in error_msg or "quota" in error_msg.lower()
            documents.append({
                "index": i,
                "page_count": page_count,
                "client_name": "",
                "doc_type": "",
                "suggested_name": f"document_{i + 1}.pdf",
                "error": "Quota exceeded — please wait a minute and retry" if quota_hit else f"AI failed: {error_msg}",
            })

    (session_dir / "documents.json").write_text(json.dumps(documents))
    logger.info(f"[{user['email']}] Processed session {session_id}: {len(documents)} docs")
    return {"documents": documents}


class DownloadRequest(BaseModel):
    documents: list


@app.post("/api/download/{session_id}")
async def download_files(session_id: str, req: DownloadRequest, user: dict = Depends(require_auth)):
    session_dir = SESSIONS_DIR / session_id
    if not session_dir.exists():
        raise HTTPException(status_code=404, detail="Session not found")

    if len(req.documents) == 1:
        doc = req.documents[0]
        src = session_dir / f"doc_{doc['index']}.pdf"
        logger.info(f"[{user['email']}] Single download: {doc['suggested_name']}")
        return FileResponse(src, media_type="application/pdf", filename=doc["suggested_name"],
                            headers={"Content-Disposition": f"attachment; filename={doc['suggested_name']}"})

    zip_path = session_dir / "output.zip"
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for doc in req.documents:
            src = session_dir / f"doc_{doc['index']}.pdf"
            if src.exists():
                folder = doc["doc_type"].replace(" ", "_") or "Other"
                zf.write(src, f"{folder}/{doc['suggested_name']}")

    logger.info(f"[{user['email']}] ZIP download: {len(req.documents)} docs from session {session_id}")
    return FileResponse(zip_path, media_type="application/zip", filename="processed_documents.zip",
                        headers={"Content-Disposition": "attachment; filename=processed_documents.zip"})


@app.get("/api/download/{session_id}/{doc_index}")
async def download_single(session_id: str, doc_index: int, filename: str = "document.pdf",
                           user: dict = Depends(require_auth)):
    session_dir = SESSIONS_DIR / session_id
    src = session_dir / f"doc_{doc_index}.pdf"
    if not src.exists():
        raise HTTPException(status_code=404, detail="File not found")
    logger.info(f"[{user['email']}] Download single: {filename}")
    return FileResponse(src, media_type="application/pdf", filename=filename,
                        headers={"Content-Disposition": f"attachment; filename={filename}"})


class BatchSession(BaseModel):
    session_id: str
    documents: list


class BatchDownloadRequest(BaseModel):
    sessions: list


@app.post("/api/download-batch")
async def download_batch(req: BatchDownloadRequest, user: dict = Depends(require_auth)):
    tmp_dir = SESSIONS_DIR / f"batch_{uuid.uuid4().hex}"
    tmp_dir.mkdir()
    zip_path = tmp_dir / "processed_documents.zip"

    total = 0
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for session in req.sessions:
            session_dir = SESSIONS_DIR / session["session_id"]
            for doc in session["documents"]:
                src = session_dir / f"doc_{doc['index']}.pdf"
                if src.exists():
                    folder = doc["doc_type"].replace(" ", "_") or "Other"
                    zf.write(src, f"{folder}/{doc['suggested_name']}")
                    total += 1

    logger.info(f"[{user['email']}] Batch ZIP download: {total} docs across {len(req.sessions)} sessions")
    return FileResponse(zip_path, media_type="application/zip", filename="processed_documents.zip",
                        headers={"Content-Disposition": "attachment; filename=processed_documents.zip"})


# Serve React frontend in production
try:
    app.mount("/", StaticFiles(directory="static", html=True), name="static")
except Exception:
    pass
