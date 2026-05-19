"""Servicio de portfolio: posiciones manuales + sync Alpaca."""
import uuid
from datetime import datetime, timezone
from app.database import get_session
from app.models.orm import Position
from app.services import market_service


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── CRUD posiciones manuales ──────────────────────────────────────────────────

def add_position(user_id: str, symbol: str, exchange: str, shares: float,
                 avg_price: float, currency: str, name: str = "", notes: str = "") -> dict:
    with get_session() as s:
        pos = Position(
            id=str(uuid.uuid4()), user_id=user_id,
            symbol=symbol.upper(), exchange=exchange.upper(),
            name=name or symbol.upper(),
            shares=shares, avg_price=avg_price,
            currency=currency.upper(),
            created_at=_now(), notes=notes,
        )
        s.add(pos)
        return pos.to_dict()


def update_position(position_id: str, user_id: str, shares: float,
                    avg_price: float, notes: str = None) -> dict:
    with get_session() as s:
        pos = s.get(Position, position_id)
        if not pos or pos.user_id != user_id:
            raise ValueError("Posición no encontrada")
        pos.shares = shares
        pos.avg_price = avg_price
        if notes is not None:
            pos.notes = notes
        return pos.to_dict()


def delete_position(position_id: str, user_id: str) -> None:
    with get_session() as s:
        pos = s.get(Position, position_id)
        if not pos or pos.user_id != user_id:
            raise ValueError("Posición no encontrada")
        s.delete(pos)


def list_positions(user_id: str) -> list[dict]:
    with get_session() as s:
        rows = s.query(Position).filter(Position.user_id == user_id).all()
        return [r.to_dict() for r in rows]


# ── Portfolio enriquecido con precios actuales ────────────────────────────────

async def get_portfolio(user_id: str) -> dict:
    positions = list_positions(user_id)
    if not positions:
        return {"positions": [], "summary": {"total_value": 0, "total_invested": 0,
                                              "total_pnl": 0, "total_pnl_pct": 0}}
    enriched = []
    total_value = 0.0
    total_invested = 0.0

    for pos in positions:
        try:
            quote = await market_service.get_quote(pos["symbol"], pos["exchange"])
            current_price = quote["price"]
        except Exception:
            current_price = pos["avg_price"]

        invested = pos["shares"] * pos["avg_price"]
        value = pos["shares"] * current_price
        pnl = value - invested
        pnl_pct = (pnl / invested * 100) if invested else 0.0

        total_value += value
        total_invested += invested
        enriched.append({
            **pos,
            "current_price": round(current_price, 4),
            "value":         round(value, 2),
            "invested":      round(invested, 2),
            "pnl":           round(pnl, 2),
            "pnl_pct":       round(pnl_pct, 2),
        })

    total_pnl = total_value - total_invested
    total_pnl_pct = (total_pnl / total_invested * 100) if total_invested else 0.0

    return {
        "positions": enriched,
        "summary": {
            "total_value":    round(total_value, 2),
            "total_invested": round(total_invested, 2),
            "total_pnl":      round(total_pnl, 2),
            "total_pnl_pct":  round(total_pnl_pct, 2),
            "count":          len(enriched),
        },
    }


# ── Alpaca sync ───────────────────────────────────────────────────────────────

async def get_alpaca_portfolio() -> dict:
    """Obtiene posiciones y cuenta de Alpaca si está configurado."""
    try:
        from app.services import alpaca_service
        account = alpaca_service.get_account()
        positions = alpaca_service.get_positions()

        total_pnl = sum(p["unrealized_pnl"] for p in positions)
        total_value = sum(p["market_value"] for p in positions)

        return {
            "source": "alpaca",
            "paper": account["paper"],
            "account": account,
            "positions": positions,
            "summary": {
                "total_value":   round(total_value, 2),
                "total_pnl":     round(total_pnl, 2),
                "buying_power":  account["buying_power"],
                "cash":          account["cash"],
                "count":         len(positions),
            },
        }
    except ValueError as e:
        return {"source": "alpaca", "error": str(e), "positions": [], "summary": {}}
    except Exception as e:
        return {"source": "alpaca", "error": f"Error Alpaca: {str(e)[:120]}", "positions": [], "summary": {}}
