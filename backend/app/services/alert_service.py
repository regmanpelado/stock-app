"""Servicio de alertas: CRUD + checker en background."""
import asyncio
import uuid
from datetime import datetime, timezone

import ccxt

from app.database import get_session
from app.models.orm import Alert


# ── CRUD ──────────────────────────────────────────────────────────────────────

def _alert_dict(alert_id: str) -> dict:
    with get_session() as s:
        a = s.get(Alert, alert_id)
        if not a:
            raise ValueError("Alerta no encontrada")
        return a.to_dict()


def list_alerts(user_id: str = "demo") -> list[dict]:
    with get_session() as s:
        rows = s.query(Alert).filter(Alert.user_id == user_id)\
                              .order_by(Alert.created_at.desc()).all()
        return [a.to_dict() for a in rows]


def create_alert(data: dict) -> dict:
    aid = str(uuid.uuid4())[:8]
    now = datetime.now(timezone.utc).isoformat()
    with get_session() as s:
        s.add(Alert(
            id=aid, user_id=data.get("user_id", "demo"),
            name=data.get("name") or "",
            type=data["type"], exchange=data["exchange"], symbol=data["symbol"],
            condition=data["condition"], target_value=data.get("target_value"),
            indicator=data.get("indicator"), active=True, triggered=False,
            created_at=now, notified=False, email=data.get("email") or "",
        ))
    return _alert_dict(aid)


def toggle_alert(alert_id: str) -> dict:
    with get_session() as s:
        a = s.get(Alert, alert_id)
        if not a:
            raise ValueError("Alerta no encontrada")
        a.active = not a.active
        if a.active:                     # re-activar limpia el estado disparado
            a.triggered = False
            a.triggered_at = a.triggered_value = None
            a.notified = False
    return _alert_dict(alert_id)


def delete_alert(alert_id: str) -> None:
    with get_session() as s:
        a = s.get(Alert, alert_id)
        if a:
            s.delete(a)


def get_notifications(user_id: str = "demo") -> list[dict]:
    """Alertas disparadas pendientes de ser acusadas en el frontend."""
    with get_session() as s:
        rows = s.query(Alert).filter(
            Alert.user_id == user_id,
            Alert.triggered == True,
            Alert.notified  == False,
        ).all()
        return [a.to_dict() for a in rows]


def acknowledge(alert_id: str) -> None:
    with get_session() as s:
        a = s.get(Alert, alert_id)
        if a:
            a.notified = True


def _mark_triggered(alert_id: str, value: float) -> None:
    with get_session() as s:
        a = s.get(Alert, alert_id)
        if a:
            a.triggered       = True
            a.active          = False
            a.triggered_at    = datetime.now(timezone.utc).isoformat()
            a.triggered_value = value
            a.notified        = False


# ── Evaluación de condición ───────────────────────────────────────────────────

async def _ticker(exchange_name: str, symbol: str) -> dict | None:
    def _sync():
        cls = getattr(ccxt, exchange_name, None)
        return cls({"enableRateLimit": True}).fetch_ticker(symbol) if cls else None
    try:
        return await asyncio.to_thread(_sync)
    except Exception:
        return None


def _rsi(closes: list[float], period: int = 14) -> float:
    if len(closes) < period + 1:
        return 50.0
    deltas = [closes[i] - closes[i - 1] for i in range(1, len(closes))]
    gains  = [max(d, 0) for d in deltas]
    losses = [max(-d, 0) for d in deltas]
    ag = sum(gains[-period:])  / period
    al = sum(losses[-period:]) / period
    return 100.0 if al == 0 else 100 - 100 / (1 + ag / al)


async def _ohlcv_closes(exchange_name: str, symbol: str,
                        timeframe: str = "1h", limit: int = 50) -> list[float]:
    def _sync():
        cls = getattr(ccxt, exchange_name, None)
        if not cls:
            return []
        data = cls({"enableRateLimit": True}).fetch_ohlcv(symbol, timeframe, limit=limit)
        return [c[4] for c in data]   # close prices
    try:
        return await asyncio.to_thread(_sync)
    except Exception:
        return []


async def _check_one(alert: dict) -> tuple[bool, float | None]:
    typ  = alert["type"]
    cond = alert["condition"]
    tgt  = float(alert["target_value"] or 0)

    if typ in ("price", "pct_change", "volume"):
        t = await _ticker(alert["exchange"], alert["symbol"])
        if not t:
            return False, None
        if typ == "price":
            val = float(t.get("last") or 0)
        elif typ == "pct_change":
            val = float(t.get("percentage") or 0)
        else:
            val = float(t.get("baseVolume") or 0)

        if cond == "above" and val > tgt:
            return True, val
        if cond == "below" and val < tgt:
            return True, val

    elif typ == "signal":
        ind = alert.get("indicator", "rsi")
        closes = await _ohlcv_closes(alert["exchange"], alert["symbol"])
        if not closes:
            return False, None

        if ind == "rsi":
            val = _rsi(closes)
        elif ind == "macd":
            # MACD signal line (simplified: EMA12 - EMA26)
            def ema(data, p):
                k, e = 2 / (p + 1), data[0]
                for v in data[1:]:
                    e = v * k + e * (1 - k)
                return e
            val = ema(closes, 12) - ema(closes, 26)
        else:  # bollinger — use %B (0=lower, 1=upper)
            avg = sum(closes[-20:]) / 20
            std = (sum((c - avg) ** 2 for c in closes[-20:]) / 20) ** 0.5
            if std == 0:
                return False, None
            val = (closes[-1] - (avg - 2 * std)) / (4 * std)

        if cond == "above" and val > tgt:
            return True, val
        if cond == "below" and val < tgt:
            return True, val

    return False, None


# ── Background checker ────────────────────────────────────────────────────────

async def _run_checks() -> None:
    alerts = list_alerts("demo")
    active = [a for a in alerts if a["active"] and not a["triggered"]]
    for alert in active:
        try:
            fired, val = await _check_one(alert)
            if fired:
                _mark_triggered(alert["id"], val or 0.0)
                try:
                    from app.services.email_service import send_alert_email
                    send_alert_email(alert, val or 0.0)
                except Exception:
                    pass
        except Exception:
            pass


async def start_checker() -> None:
    """Verifica todas las alertas activas cada 60 segundos."""
    await asyncio.sleep(10)          # espera inicial a que el servidor arranque
    while True:
        try:
            await _run_checks()
        except Exception:
            pass
        await asyncio.sleep(60)
