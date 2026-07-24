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
