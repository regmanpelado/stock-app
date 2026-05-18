"""Modelos ORM de SQLAlchemy. Compatibles con SQLite (dev) y PostgreSQL (producción)."""
from sqlalchemy import (
    Boolean, Column, Float, ForeignKey, Index, String, Text
)
from sqlalchemy.orm import relationship
from sqlalchemy.types import TypeDecorator, TEXT
import json

from app.database import Base


# ── JSON portable (SQLite no tiene columna JSON nativa, PostgreSQL sí) ─────────
class JSONType(TypeDecorator):
    """Serializa dicts/listas como JSON en SQLite; usa JSON nativo en PostgreSQL."""
    impl = TEXT
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return "{}"
        return json.dumps(value, ensure_ascii=False)

    def process_result_value(self, value, dialect):
        if value is None:
            return {}
        try:
            return json.loads(value)
        except (ValueError, TypeError):
            return {}

    def coerce_compared_value(self, op, value):
        return TEXT()


def _json_col(default=None):
    return Column(JSONType, nullable=False, default=default or dict)


# ── Bot ────────────────────────────────────────────────────────────────────────
class Bot(Base):
    __tablename__ = "bots"

    id             = Column(String(36),  primary_key=True)
    user_id        = Column(String(36),  nullable=False, default="demo")
    name           = Column(String(255), nullable=False)
    type           = Column(String(50),  nullable=False)
    config         = _json_col()
    sandbox        = Column(Boolean,     nullable=False, default=True)
    status         = Column(String(50),  nullable=False, default="stopped")
    created_at     = Column(String(50),  nullable=False)
    pnl            = Column(Float,  default=0.0)
    pnl_pct        = Column(Float,  default=0.0)
    total_invested = Column(Float,  default=0.0)
    current_value  = Column(Float,  default=0.0)
    stats          = _json_col()
    last_check     = Column(String(50))
    error          = Column(Text)

    trades = relationship(
        "Trade", back_populates="bot",
        cascade="all, delete-orphan",
        order_by="desc(Trade.timestamp)",
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id, "user_id": self.user_id,
            "name": self.name, "type": self.type,
            "config": self.config, "sandbox": self.sandbox,
            "status": self.status, "created_at": self.created_at,
            "pnl": self.pnl, "pnl_pct": self.pnl_pct,
            "total_invested": self.total_invested, "current_value": self.current_value,
            "stats": self.stats, "last_check": self.last_check, "error": self.error,
            "trades": [t.to_dict() for t in self.trades[:200]],
        }


# ── Trade ──────────────────────────────────────────────────────────────────────
class Trade(Base):
    __tablename__ = "trades"
    __table_args__ = (Index("ix_trades_bot_id", "bot_id"),)

    id        = Column(String(36),  primary_key=True)
    bot_id    = Column(String(36),  ForeignKey("bots.id", ondelete="CASCADE"), nullable=False)
    timestamp = Column(String(50),  nullable=False)
    side      = Column(String(10),  nullable=False)
    price     = Column(Float,       nullable=False)
    amount    = Column(Float,       nullable=False)
    cost      = Column(Float,       nullable=False)
    sandbox   = Column(Boolean,     nullable=False, default=True)

    bot = relationship("Bot", back_populates="trades")

    def to_dict(self) -> dict:
        return {
            "id": self.id, "timestamp": self.timestamp, "side": self.side,
            "price": self.price, "amount": self.amount, "cost": self.cost,
            "sandbox": self.sandbox,
        }


# ── User / Suscripción ─────────────────────────────────────────────────────────
class User(Base):
    __tablename__ = "users"

    id                  = Column(String(36),  primary_key=True)
    email               = Column(String(255), nullable=False, unique=True)
    nombre              = Column(String(255), nullable=False)
    plan                = Column(String(50),  nullable=False, default="free")
    activo              = Column(Boolean,     nullable=False, default=True)
    creado_en           = Column(String(50),  nullable=False)
    proxima_factura     = Column(String(50))
    password_hash       = Column(Text,        nullable=True)
    email_verificado    = Column(Boolean,     nullable=False, default=False)
    token_verificacion  = Column(String(100), nullable=True)
    token_reset_pass    = Column(String(100), nullable=True)
    token_reset_expiry  = Column(String(50),  nullable=True)
    is_admin            = Column(Boolean,     nullable=False, default=False)
    totp_secret         = Column(String(64),  nullable=True)
    totp_enabled        = Column(Boolean,     nullable=False, default=False)
    totp_backup_hash    = Column(Text,        nullable=True)   # JSON list of bcrypt hashes
    stripe_customer_id     = Column(String(100), nullable=True)
    stripe_subscription_id = Column(String(100), nullable=True)

    def to_dict(self) -> dict:
        return {
            "id": self.id, "email": self.email, "nombre": self.nombre,
            "plan": self.plan, "activo": self.activo,
            "creado_en": self.creado_en, "proxima_factura": self.proxima_factura,
            "email_verificado": self.email_verificado,
            "is_admin": bool(self.is_admin),
            "totp_enabled": bool(self.totp_enabled),
        }


# ── Exchange API Keys ─────────────────────────────────────────────────────────
class ExchangeKey(Base):
    __tablename__ = "exchange_keys"

    id         = Column(String(36),  primary_key=True)
    user_id    = Column(String(36),  nullable=False)
    exchange   = Column(String(50),  nullable=False)
    label      = Column(String(100), nullable=True)
    api_key    = Column(Text(),      nullable=False)   # cifrado con Fernet
    api_secret = Column(Text(),      nullable=False)   # cifrado con Fernet
    created_at = Column(String(50),  nullable=False)


# ── Alerta ────────────────────────────────────────────────────────────────────
class Alert(Base):
    __tablename__ = "alerts"

    id              = Column(String(36),  primary_key=True)
    user_id         = Column(String(36),  nullable=False, default="demo")
    name            = Column(String(255), nullable=True)
    type            = Column(String(50),  nullable=False)   # price|pct_change|volume|signal
    exchange        = Column(String(50),  nullable=False)
    symbol          = Column(String(50),  nullable=False)
    condition       = Column(String(30),  nullable=False)   # above|below
    target_value    = Column(Float,       nullable=True)
    indicator       = Column(String(30),  nullable=True)    # rsi|macd|bollinger
    active          = Column(Boolean,     nullable=False, default=True)
    triggered       = Column(Boolean,     nullable=False, default=False)
    triggered_at    = Column(String(50),  nullable=True)
    triggered_value = Column(Float,       nullable=True)
    created_at      = Column(String(50),  nullable=False)
    notified        = Column(Boolean,     nullable=False, default=False)
    email           = Column(String(255), nullable=True)

    def to_dict(self) -> dict:
        return {
            "id": self.id, "user_id": self.user_id, "name": self.name,
            "type": self.type, "exchange": self.exchange, "symbol": self.symbol,
            "condition": self.condition, "target_value": self.target_value,
            "indicator": self.indicator, "active": self.active,
            "triggered": self.triggered, "triggered_at": self.triggered_at,
            "triggered_value": self.triggered_value, "created_at": self.created_at,
            "notified": self.notified, "email": self.email,
        }


# ── Audit Log ─────────────────────────────────────────────────────────────────
class AuditLog(Base):
    __tablename__ = "audit_log"

    id         = Column(String(36),  primary_key=True)
    user_id    = Column(String(36),  nullable=True)
    user_email = Column(String(255), nullable=True)
    action     = Column(String(50),  nullable=False, index=True)
    ip         = Column(String(64),  nullable=True)
    details    = Column(Text,        nullable=True)
    created_at = Column(String(50),  nullable=False, index=True)
