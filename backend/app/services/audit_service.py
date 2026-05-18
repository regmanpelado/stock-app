"""Registro de auditoría. Usa ContextVar para capturar la IP del request automáticamente."""
import json
import uuid
from contextvars import ContextVar
from datetime import datetime, timezone

from app.database import get_session
from app.models.orm import AuditLog

_current_ip: ContextVar[str | None] = ContextVar("current_ip", default=None)


def set_request_ip(ip: str | None) -> None:
    _current_ip.set(ip)


def get_request_ip() -> str | None:
    return _current_ip.get()


def log(
    action: str,
    user_id: str | None = None,
    user_email: str | None = None,
    details: dict | None = None,
) -> None:
    try:
        with get_session() as s:
            s.add(AuditLog(
                id         = str(uuid.uuid4()),
                user_id    = user_id,
                user_email = user_email,
                action     = action,
                ip         = _current_ip.get(),
                details    = json.dumps(details or {}, ensure_ascii=False),
                created_at = datetime.now(timezone.utc).isoformat(),
            ))
    except Exception:
        pass  # nunca interrumpe el flujo principal


def query_logs(
    user_id: str | None = None,
    action: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[dict]:
    with get_session() as s:
        q = s.query(AuditLog)
        if user_id:
            q = q.filter(AuditLog.user_id == user_id)
        if action:
            q = q.filter(AuditLog.action == action)
        if date_from:
            q = q.filter(AuditLog.created_at >= date_from)
        if date_to:
            q = q.filter(AuditLog.created_at <= date_to + "T23:59:59")
        rows = (
            q.order_by(AuditLog.created_at.desc())
             .offset(offset).limit(limit).all()
        )
        return [
            {
                "id":         r.id,
                "user_id":    r.user_id,
                "user_email": r.user_email,
                "action":     r.action,
                "ip":         r.ip,
                "details":    json.loads(r.details or "{}"),
                "created_at": r.created_at,
            }
            for r in rows
        ]


def count_logs(
    user_id: str | None = None,
    action: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
) -> int:
    with get_session() as s:
        q = s.query(AuditLog)
        if user_id:
            q = q.filter(AuditLog.user_id == user_id)
        if action:
            q = q.filter(AuditLog.action == action)
        if date_from:
            q = q.filter(AuditLog.created_at >= date_from)
        if date_to:
            q = q.filter(AuditLog.created_at <= date_to + "T23:59:59")
        return q.count()
