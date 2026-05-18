"""Gestión de API keys de exchange por usuario. Las claves se almacenan cifradas con Fernet."""
import base64
import hashlib
import os
import uuid
from datetime import datetime, timezone

from cryptography.fernet import Fernet

from app.database import get_session
from app.models.orm import ExchangeKey

SUPPORTED_EXCHANGES = ["binance", "coinbase", "kraken", "gateio"]

# Nombres de las variables de entorno globales por exchange
_ENV_KEYS = {
    "binance":  ("BINANCE_API_KEY",  "BINANCE_SECRET_KEY"),
    "coinbase": ("COINBASE_API_KEY", "COINBASE_SECRET_KEY"),
    "kraken":   ("KRAKEN_API_KEY",   "KRAKEN_SECRET_KEY"),
    "gateio":   ("GATE_API_KEY",     "GATE_SECRET_KEY"),
}


# ── Cifrado ────────────────────────────────────────────────────────────────────

def _fernet() -> Fernet:
    from app.config import get_settings
    secret = get_settings().jwt_secret.encode()
    key    = base64.urlsafe_b64encode(hashlib.sha256(secret).digest())
    return Fernet(key)


def _encrypt(plain: str) -> str:
    return _fernet().encrypt(plain.encode()).decode()


def _decrypt(token: str) -> str:
    return _fernet().decrypt(token.encode()).decode()


def _mask(key: str) -> str:
    if len(key) <= 10:
        return "••••••••"
    return key[:6] + "••••••••" + key[-4:]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── CRUD ───────────────────────────────────────────────────────────────────────

def list_user_keys(user_id: str) -> list[dict]:
    with get_session() as s:
        rows = s.query(ExchangeKey).filter(ExchangeKey.user_id == user_id).all()
        result = {
            r.exchange: {
                "exchange":       r.exchange,
                "label":          r.label,
                "api_key_masked": _mask(_decrypt(r.api_key)),
                "created_at":     r.created_at,
                "source":         "user",
            }
            for r in rows
        }

    # Completar con claves globales de env vars — solo para admins
    from app.models.orm import User
    with get_session() as s:
        u = s.get(User, user_id)
        is_admin = bool(u and u.is_admin)

    if is_admin:
        for exchange, (key_var, secret_var) in _ENV_KEYS.items():
            if exchange not in result and os.environ.get(key_var):
                result[exchange] = {
                    "exchange":       exchange,
                    "label":          "Global (Railway)",
                    "api_key_masked": _mask(os.environ[key_var]),
                    "created_at":     None,
                    "source":         "env",
                }

    return list(result.values())


def upsert_key(user_id: str, exchange: str,
               api_key: str, api_secret: str, label: str = "") -> dict:
    if exchange not in SUPPORTED_EXCHANGES:
        raise ValueError(f"Exchange '{exchange}' no soportado")
    if not api_key.strip() or not api_secret.strip():
        raise ValueError("API key y API secret son obligatorios")

    with get_session() as s:
        existing = s.query(ExchangeKey).filter(
            ExchangeKey.user_id == user_id,
            ExchangeKey.exchange == exchange,
        ).first()
        if existing:
            existing.api_key    = _encrypt(api_key.strip())
            existing.api_secret = _encrypt(api_secret.strip())
            existing.label      = label.strip() or None
            existing.created_at = _now()
        else:
            s.add(ExchangeKey(
                id         = str(uuid.uuid4()),
                user_id    = user_id,
                exchange   = exchange,
                label      = label.strip() or None,
                api_key    = _encrypt(api_key.strip()),
                api_secret = _encrypt(api_secret.strip()),
                created_at = _now(),
            ))
    return {"exchange": exchange, "ok": True}


def delete_key(user_id: str, exchange: str) -> bool:
    with get_session() as s:
        row = s.query(ExchangeKey).filter(
            ExchangeKey.user_id == user_id,
            ExchangeKey.exchange == exchange,
        ).first()
        if not row:
            return False
        s.delete(row)
        return True


def get_credentials(user_id: str, exchange: str) -> tuple[str, str] | None:
    """Devuelve (api_key, api_secret) descifrados, o None si no existen.
    El fallback a env vars solo está disponible para administradores."""
    from app.models.orm import User
    with get_session() as s:
        row = s.query(ExchangeKey).filter(
            ExchangeKey.user_id == user_id,
            ExchangeKey.exchange == exchange,
        ).first()
        if row:
            return _decrypt(row.api_key), _decrypt(row.api_secret)
        # Fallback a env vars solo para admins
        user = s.get(User, user_id)
        is_admin = bool(user and user.is_admin)

    if is_admin:
        env = _ENV_KEYS.get(exchange)
        if env:
            key, secret = os.environ.get(env[0]), os.environ.get(env[1])
            if key and secret:
                return key, secret
    return None


# ── Test de conexión ───────────────────────────────────────────────────────────

async def test_connection(user_id: str, exchange: str) -> dict:
    creds = get_credentials(user_id, exchange)
    if not creds:
        return {"ok": False, "error": "No hay credenciales configuradas para este exchange"}

    api_key, api_secret = creds
    try:
        import ccxt
        CLASSES = {
            "binance":  ccxt.binance,
            "coinbase": ccxt.coinbase,
            "kraken":   ccxt.kraken,
            "gateio":   ccxt.gateio,
        }
        cls = CLASSES.get(exchange)
        if not cls:
            return {"ok": False, "error": f"Exchange '{exchange}' no soportado"}

        exc     = cls({"apiKey": api_key, "secret": api_secret, "enableRateLimit": True})
        balance = exc.fetch_balance()

        QUOTE   = {"EUR", "ZEUR", "EURT", "USD", "USDT", "ZUSD", "USDC"}
        total_q = sum(v for k, v in (balance.get("total") or {}).items() if k in QUOTE)
        return {"ok": True, "message": f"Conexión exitosa. Balance de referencia: ${total_q:,.2f}"}

    except Exception as e:
        msg = str(e)
        if "invalid" in msg.lower() or "api" in msg.lower():
            return {"ok": False, "error": "Credenciales inválidas o sin permisos"}
        return {"ok": False, "error": msg[:200]}
