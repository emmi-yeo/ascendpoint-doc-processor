import os
import sqlite3
import secrets
from contextlib import contextmanager
from datetime import datetime, timedelta

DB_PATH = os.getenv("DB_PATH", "/tmp/ascend.db")


def init_db():
    with get_db() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL COLLATE NOCASE,
                password_hash TEXT NOT NULL,
                is_active INTEGER NOT NULL DEFAULT 1,
                is_admin INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE TABLE IF NOT EXISTS reset_tokens (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                token TEXT UNIQUE NOT NULL,
                expires_at TEXT NOT NULL,
                used INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );
        """)


@contextmanager
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def get_user_by_email(email: str):
    with get_db() as conn:
        row = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
        return dict(row) if row else None


def get_user_by_id(user_id: int):
    with get_db() as conn:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        return dict(row) if row else None


def create_user(email: str, password_hash: str) -> dict:
    with get_db() as conn:
        count = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
        is_admin = 1 if count == 0 else 0
        is_active = 1 if count == 0 else 0  # first user auto-approved; others await admin approval
        conn.execute(
            "INSERT INTO users (email, password_hash, is_admin, is_active) VALUES (?, ?, ?, ?)",
            (email, password_hash, is_admin, is_active),
        )
        row = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
        return dict(row)


def list_users() -> list:
    with get_db() as conn:
        rows = conn.execute("SELECT id, email, is_active, is_admin, created_at FROM users ORDER BY created_at").fetchall()
        return [dict(r) for r in rows]


def update_user(user_id: int, **fields):
    allowed = {"is_active", "is_admin", "password_hash"}
    updates = {k: v for k, v in fields.items() if k in allowed}
    if not updates:
        return
    set_clause = ", ".join(f"{k} = ?" for k in updates)
    with get_db() as conn:
        conn.execute(f"UPDATE users SET {set_clause} WHERE id = ?", (*updates.values(), user_id))


def delete_user(user_id: int):
    with get_db() as conn:
        conn.execute("DELETE FROM reset_tokens WHERE user_id = ?", (user_id,))
        conn.execute("DELETE FROM users WHERE id = ?", (user_id,))


def create_reset_token(user_id: int) -> str:
    token = secrets.token_urlsafe(32)
    expires_at = (datetime.utcnow() + timedelta(hours=1)).strftime("%Y-%m-%d %H:%M:%S")
    with get_db() as conn:
        conn.execute("DELETE FROM reset_tokens WHERE user_id = ?", (user_id,))
        conn.execute(
            "INSERT INTO reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)",
            (user_id, token, expires_at),
        )
    return token


def consume_reset_token(token: str):
    """Returns user_id if token is valid and unused, else None."""
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM reset_tokens WHERE token = ? AND used = 0 AND expires_at > datetime('now')",
            (token,),
        ).fetchone()
        if not row:
            return None
        conn.execute("UPDATE reset_tokens SET used = 1 WHERE id = ?", (row["id"],))
        return row["user_id"]
