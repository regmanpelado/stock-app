"""Inicialización y conexión a SQLite para persistencia de bots."""
import os
import sqlite3
from pathlib import Path

# En Railway: configura DB_PATH=/data/bots.db y monta un volumen en /data
# En local: crea ./data/bots.db junto al directorio backend
_DEFAULT = Path(__file__).parent.parent / "data" / "bots.db"
DB_PATH = os.environ.get("DB_PATH", str(_DEFAULT))


def get_conn() -> sqlite3.Connection:
    Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, check_same_thread=False, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")   # lecturas concurrentes sin bloquear
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db() -> None:
    conn = get_conn()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS bots (
            id              TEXT PRIMARY KEY,
            name            TEXT NOT NULL,
            type            TEXT NOT NULL,
            config          TEXT NOT NULL,
            sandbox         INTEGER NOT NULL DEFAULT 1,
            status          TEXT NOT NULL DEFAULT 'stopped',
            created_at      TEXT NOT NULL,
            pnl             REAL DEFAULT 0,
            pnl_pct         REAL DEFAULT 0,
            total_invested  REAL DEFAULT 0,
            current_value   REAL DEFAULT 0,
            stats           TEXT NOT NULL DEFAULT '{}',
            last_check      TEXT,
            error           TEXT
        );

        CREATE TABLE IF NOT EXISTS trades (
            id       TEXT PRIMARY KEY,
            bot_id   TEXT NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
            timestamp TEXT NOT NULL,
            side     TEXT NOT NULL,
            price    REAL NOT NULL,
            amount   REAL NOT NULL,
            cost     REAL NOT NULL,
            sandbox  INTEGER NOT NULL DEFAULT 1
        );

        CREATE INDEX IF NOT EXISTS idx_trades_bot ON trades(bot_id);
    """)
    conn.commit()
    conn.close()
