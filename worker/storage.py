import json
import sqlite3
import time
import uuid
from contextlib import contextmanager
from pathlib import Path
from typing import Any


SCHEMA = """
CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,               -- 'analyze' | 'generate'
    parent_id TEXT,                   -- id del job analyze del que sale un generate
    status TEXT NOT NULL,             -- pending|running|done|error
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    input_json TEXT NOT NULL,
    progress REAL DEFAULT 0.0,
    stage TEXT,
    result_json TEXT,
    error TEXT,
    client_ip TEXT
);

CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_ip_date ON jobs(client_ip, created_at);

CREATE TABLE IF NOT EXISTS push_subscriptions (
    endpoint TEXT PRIMARY KEY,
    subscription_json TEXT NOT NULL,   -- JSON completo con endpoint + keys
    client_ip TEXT,
    created_at INTEGER NOT NULL,
    last_seen_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS job_subscriptions (
    job_id TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    PRIMARY KEY (job_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_job_subs_job ON job_subscriptions(job_id);
"""


def init_db(db_path: str) -> None:
    Path(db_path).parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(db_path) as db:
        db.executescript(SCHEMA)


@contextmanager
def _conn(db_path: str):
    # timeout: SQLite espera N segundos si la BBDD está locked antes de
    # devolver OperationalError. Subimos a 30s para absorber picos.
    db = sqlite3.connect(db_path, timeout=30, isolation_level=None)
    db.row_factory = sqlite3.Row
    # WAL mode: permite N lectores concurrentes junto a 1 escritor.
    # Sin WAL, cualquier lectura durante una escritura da "database is locked".
    # WAL persiste a nivel de fichero — set idempotente por conexión.
    db.execute("PRAGMA journal_mode=WAL")
    db.execute("PRAGMA synchronous=NORMAL")  # más rápido con WAL, sin perder durabilidad relevante
    db.execute("PRAGMA busy_timeout=30000")  # 30s (redundante con timeout=, defensa en profundidad)
    try:
        yield db
    finally:
        db.close()


def new_job(
    db_path: str,
    kind: str,
    input_data: dict,
    client_ip: str,
    parent_id: str | None = None,
) -> str:
    job_id = uuid.uuid4().hex[:12]
    now = int(time.time())
    with _conn(db_path) as db:
        db.execute(
            "INSERT INTO jobs (id, kind, parent_id, status, created_at, updated_at, input_json, client_ip) "
            "VALUES (?, ?, ?, 'pending', ?, ?, ?, ?)",
            (job_id, kind, parent_id, now, now, json.dumps(input_data), client_ip),
        )
    return job_id


def get_job(db_path: str, job_id: str) -> dict | None:
    with _conn(db_path) as db:
        row = db.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()
    if not row:
        return None
    d = dict(row)
    d["input"] = json.loads(d.pop("input_json") or "{}")
    d["result"] = json.loads(d.pop("result_json") or "null")
    return d


def update_job(db_path: str, job_id: str, **fields: Any) -> None:
    if not fields:
        return
    if "result" in fields:
        fields["result_json"] = json.dumps(fields.pop("result"))
    fields["updated_at"] = int(time.time())
    keys = ", ".join(f"{k} = ?" for k in fields)
    values = list(fields.values()) + [job_id]
    with _conn(db_path) as db:
        db.execute(f"UPDATE jobs SET {keys} WHERE id = ?", values)


def count_jobs_by_ip_last_24h(db_path: str, ip: str) -> int:
    cutoff = int(time.time()) - 24 * 3600
    with _conn(db_path) as db:
        row = db.execute(
            "SELECT COUNT(*) AS n FROM jobs WHERE client_ip = ? AND created_at > ? AND kind = 'generate'",
            (ip, cutoff),
        ).fetchone()
    return int(row["n"] or 0)


def save_push_subscription(db_path: str, endpoint: str, sub_json: str, client_ip: str, job_id: str | None = None) -> None:
    now = int(time.time())
    with _conn(db_path) as db:
        db.execute(
            "INSERT INTO push_subscriptions (endpoint, subscription_json, client_ip, created_at, last_seen_at) "
            "VALUES (?, ?, ?, ?, ?) "
            "ON CONFLICT(endpoint) DO UPDATE SET subscription_json = excluded.subscription_json, "
            "last_seen_at = excluded.last_seen_at, client_ip = excluded.client_ip",
            (endpoint, sub_json, client_ip, now, now),
        )
        if job_id:
            db.execute(
                "INSERT OR IGNORE INTO job_subscriptions (job_id, endpoint) VALUES (?, ?)",
                (job_id, endpoint),
            )


def get_subscriptions_for_job(db_path: str, job_id: str) -> list[str]:
    """Devuelve subscription_json de todas las subs asociadas al job (o el mismo IP)."""
    with _conn(db_path) as db:
        # Subs asociadas explícitamente al job
        rows = db.execute(
            "SELECT ps.subscription_json FROM push_subscriptions ps "
            "JOIN job_subscriptions js ON js.endpoint = ps.endpoint "
            "WHERE js.job_id = ?",
            (job_id,),
        ).fetchall()
        subs = [r["subscription_json"] for r in rows]
        if subs:
            return subs
        # Fallback: subs del mismo IP (por si el frontend no asoció)
        job_row = db.execute("SELECT client_ip FROM jobs WHERE id = ?", (job_id,)).fetchone()
        if not job_row or not job_row["client_ip"]:
            return []
        ip_rows = db.execute(
            "SELECT subscription_json FROM push_subscriptions "
            "WHERE client_ip = ? AND last_seen_at > ?",
            (job_row["client_ip"], int(time.time()) - 30 * 24 * 3600),
        ).fetchall()
        return [r["subscription_json"] for r in ip_rows]


def delete_push_subscription(db_path: str, endpoint: str) -> None:
    with _conn(db_path) as db:
        db.execute("DELETE FROM job_subscriptions WHERE endpoint = ?", (endpoint,))
        db.execute("DELETE FROM push_subscriptions WHERE endpoint = ?", (endpoint,))


def mark_orphaned_running_jobs(db_path: str) -> int:
    """Marca como error los jobs que quedaron 'running'/'pending' de un run anterior.

    Se llama al arrancar el worker: si un job está en estado activo pero el
    proceso que lo estaba ejecutando ya no existe (por reinicio del service),
    queda huérfano. Sin este cleanup, aparecerían "running" para siempre.
    """
    now = int(time.time())
    with _conn(db_path) as db:
        res = db.execute(
            "UPDATE jobs SET status = 'error', error = ?, updated_at = ? "
            "WHERE status IN ('running', 'pending')",
            (
                "El worker se reinició durante el procesamiento. Reintenta el análisis.",
                now,
            ),
        )
    return res.rowcount
