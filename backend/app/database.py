"""Configuración del engine SQLAlchemy. SQLite en local, PostgreSQL en producción."""
import os
from contextlib import contextmanager
from pathlib import Path

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, DeclarativeBase

# ── URL de conexión ────────────────────────────────────────────────────────────
_raw = os.environ.get("DATABASE_URL", "")

if not _raw:
    # Desarrollo local: SQLite en ./data/bots.db
    _dir = Path(__file__).parent.parent / "data"
    _dir.mkdir(parents=True, exist_ok=True)
    DATABASE_URL = f"sqlite:///{_dir}/bots.db"
elif _raw.startswith("postgres://"):
    # Railway usa el prefijo antiguo postgres://; SQLAlchemy necesita postgresql://
    DATABASE_URL = _raw.replace("postgres://", "postgresql://", 1)
else:
    DATABASE_URL = _raw

IS_SQLITE = DATABASE_URL.startswith("sqlite")

# ── Engine ─────────────────────────────────────────────────────────────────────
_connect_args = {"check_same_thread": False} if IS_SQLITE else {}

engine = create_engine(
    DATABASE_URL,
    connect_args=_connect_args,
    pool_pre_ping=True,
    pool_size=5 if not IS_SQLITE else 1,
    max_overflow=10 if not IS_SQLITE else 0,
    echo=os.environ.get("SQL_ECHO", "false").lower() == "true",
)

# Activa foreign keys en SQLite (no son automáticas)
if IS_SQLITE:
    @event.listens_for(engine, "connect")
    def _set_sqlite_pragma(conn, _):
        conn.execute("PRAGMA foreign_keys=ON")
        conn.execute("PRAGMA journal_mode=WAL")

# ── Sesión ─────────────────────────────────────────────────────────────────────
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


@contextmanager
def get_session():
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


# ── Base para todos los modelos ORM ───────────────────────────────────────────
class Base(DeclarativeBase):
    pass
