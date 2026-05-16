"""SQLite-backed CRM for surgeon leads captured through the sell-by-chat flow.

Reuses the project's existing viral_intel.db file so everything lives in one
place and can later be synced to the MySQL dashboard if desired.
"""
import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "viral_intel.db")


@contextmanager
def _conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_crm():
    with _conn() as c:
        c.execute(
            """
            CREATE TABLE IF NOT EXISTS ig_leads (
                ig_user_id    TEXT PRIMARY KEY,
                username      TEXT,
                name          TEXT,
                is_expert     INTEGER DEFAULT 0,
                is_surgeon    INTEGER DEFAULT 0,
                stage         TEXT DEFAULT 'NEW',
                status        TEXT DEFAULT 'open',
                email         TEXT,
                phone         TEXT,
                practice      TEXT,
                revenue_stage TEXT,
                top_challenge TEXT,
                desired_state TEXT,
                roadblocks    TEXT,
                commitment    INTEGER,
                created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        c.execute(
            """
            CREATE TABLE IF NOT EXISTS ig_messages (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                ig_user_id TEXT,
                direction  TEXT,
                text       TEXT,
                ts         TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )


def get_lead(ig_user_id: str):
    with _conn() as c:
        row = c.execute(
            "SELECT * FROM ig_leads WHERE ig_user_id = ?", (ig_user_id,)
        ).fetchone()
        return dict(row) if row else None


def create_lead(ig_user_id: str, username: str, name: str,
                is_expert: bool, is_surgeon: bool):
    with _conn() as c:
        c.execute(
            """
            INSERT OR IGNORE INTO ig_leads
                (ig_user_id, username, name, is_expert, is_surgeon, stage)
            VALUES (?, ?, ?, ?, ?, 'NEW')
            """,
            (ig_user_id, username, name, int(is_expert), int(is_surgeon)),
        )
    return get_lead(ig_user_id)


def update_lead(ig_user_id: str, **fields):
    if not fields:
        return
    fields["updated_at"] = datetime.now(timezone.utc).isoformat()
    cols = ", ".join(f"{k} = ?" for k in fields)
    with _conn() as c:
        c.execute(
            f"UPDATE ig_leads SET {cols} WHERE ig_user_id = ?",
            (*fields.values(), ig_user_id),
        )


def log_message(ig_user_id: str, direction: str, text: str):
    with _conn() as c:
        c.execute(
            "INSERT INTO ig_messages (ig_user_id, direction, text) VALUES (?, ?, ?)",
            (ig_user_id, direction, text),
        )


def export_leads(only_status: str = None):
    """Return captured leads as a list of dicts (for CSV / dashboard sync)."""
    q = "SELECT * FROM ig_leads"
    args = ()
    if only_status:
        q += " WHERE status = ?"
        args = (only_status,)
    q += " ORDER BY updated_at DESC"
    with _conn() as c:
        return [dict(r) for r in c.execute(q, args).fetchall()]
