"""Limpieza de basura acumulada por el worker.

Reglas de retención:
  * sources/*.mp4    → 24h desde el último acceso (mtime)
  * jobs/<id>/*      → 6h desde creación (intermedios, no se recuperan)
  * output/*.mp4     → 7 días (el user puede volver a descargar)
  * jobs.db rows     → 30 días (historial)
  * push_subscriptions: 60 días desde last_seen (revocadas ya se purgan solas)

Ejecutable como CLI:  python -m worker.cleanup [--dry-run]
"""

from __future__ import annotations

import argparse
import shutil
import sqlite3
import sys
import time
from pathlib import Path

# Import perezoso para no explotar si se ejecuta fuera del contexto normal
from .settings import settings


DEFAULT_RETENTION = {
    "sources_hours": 24,
    "jobs_hours": 6,
    "output_days": 7,
    "db_days": 30,
    "push_days": 60,
}


def _mtime_age_seconds(p: Path) -> float:
    try:
        return time.time() - p.stat().st_mtime
    except OSError:
        return 0.0


def _delete_file(p: Path, dry_run: bool) -> int:
    size = 0
    try:
        size = p.stat().st_size
    except OSError:
        pass
    if not dry_run:
        try:
            p.unlink()
        except OSError:
            return 0
    return size


def _delete_tree(p: Path, dry_run: bool) -> int:
    size = 0
    try:
        for f in p.rglob("*"):
            if f.is_file():
                try:
                    size += f.stat().st_size
                except OSError:
                    pass
    except OSError:
        return 0
    if not dry_run:
        shutil.rmtree(p, ignore_errors=True)
    return size


def _fmt(bytes_: int) -> str:
    for u in ("B", "KB", "MB", "GB"):
        if bytes_ < 1024:
            return f"{bytes_:.1f} {u}"
        bytes_ /= 1024  # type: ignore[assignment]
    return f"{bytes_:.1f} TB"


def cleanup(dry_run: bool = False) -> dict:
    """Aplica las reglas de retención. Devuelve stats de lo eliminado."""
    workspace = Path(settings.workspace_dir)
    stats = {
        "sources_deleted": 0,
        "sources_bytes": 0,
        "jobs_deleted": 0,
        "jobs_bytes": 0,
        "output_deleted": 0,
        "output_bytes": 0,
        "db_rows_deleted": 0,
        "push_subs_deleted": 0,
    }
    now = time.time()

    # --- sources/ ---
    sources_dir = workspace / "sources"
    if sources_dir.exists():
        threshold = DEFAULT_RETENTION["sources_hours"] * 3600
        for f in sources_dir.iterdir():
            if not f.is_file():
                continue
            if _mtime_age_seconds(f) > threshold:
                stats["sources_bytes"] += _delete_file(f, dry_run)
                stats["sources_deleted"] += 1

    # --- jobs/<id>/ (workdirs con intermedios) ---
    jobs_dir = workspace / "jobs"
    if jobs_dir.exists():
        threshold = DEFAULT_RETENTION["jobs_hours"] * 3600
        for d in jobs_dir.iterdir():
            if not d.is_dir():
                continue
            if _mtime_age_seconds(d) > threshold:
                stats["jobs_bytes"] += _delete_tree(d, dry_run)
                stats["jobs_deleted"] += 1

    # --- output/*.mp4 (Shorts generados) ---
    output_dir = workspace / "output"
    if output_dir.exists():
        threshold = DEFAULT_RETENTION["output_days"] * 24 * 3600
        for f in output_dir.iterdir():
            if not f.is_file():
                continue
            if _mtime_age_seconds(f) > threshold:
                stats["output_bytes"] += _delete_file(f, dry_run)
                stats["output_deleted"] += 1

    # --- jobs.db rows ---
    if Path(settings.db_path).exists():
        cutoff = int(now) - DEFAULT_RETENTION["db_days"] * 24 * 3600
        # timeout=30 fija busy_timeout a nivel de driver, pero además lo
        # forzamos con PRAGMA para asegurar que si hay writes concurrentes
        # (analyze/generate en curso) esperamos en vez de fallar.
        db = sqlite3.connect(settings.db_path, timeout=30, isolation_level=None)
        db.execute("PRAGMA busy_timeout=30000")
        try:
            if not dry_run:
                r1 = db.execute(
                    "DELETE FROM job_subscriptions WHERE job_id IN "
                    "(SELECT id FROM jobs WHERE created_at < ?)",
                    (cutoff,),
                )
                r2 = db.execute("DELETE FROM jobs WHERE created_at < ?", (cutoff,))
                stats["db_rows_deleted"] = r2.rowcount
            else:
                r = db.execute("SELECT COUNT(*) FROM jobs WHERE created_at < ?", (cutoff,)).fetchone()
                stats["db_rows_deleted"] = r[0] if r else 0

            # push_subscriptions viejas
            push_cutoff = int(now) - DEFAULT_RETENTION["push_days"] * 24 * 3600
            if not dry_run:
                r3 = db.execute("DELETE FROM push_subscriptions WHERE last_seen_at < ?", (push_cutoff,))
                stats["push_subs_deleted"] = r3.rowcount
            else:
                r = db.execute(
                    "SELECT COUNT(*) FROM push_subscriptions WHERE last_seen_at < ?",
                    (push_cutoff,),
                ).fetchone()
                stats["push_subs_deleted"] = r[0] if r else 0
        finally:
            db.close()

    return stats


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="Muestra qué se borraría sin borrar nada")
    args = parser.parse_args()
    s = cleanup(dry_run=args.dry_run)
    prefix = "[DRY-RUN] " if args.dry_run else ""
    total = s["sources_bytes"] + s["jobs_bytes"] + s["output_bytes"]
    print(
        f"{prefix}sources: {s['sources_deleted']} files, {_fmt(s['sources_bytes'])} · "
        f"jobs: {s['jobs_deleted']} dirs, {_fmt(s['jobs_bytes'])} · "
        f"output: {s['output_deleted']} files, {_fmt(s['output_bytes'])} · "
        f"db: {s['db_rows_deleted']} rows · "
        f"push subs: {s['push_subs_deleted']} · "
        f"TOTAL espacio: {_fmt(total)}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
