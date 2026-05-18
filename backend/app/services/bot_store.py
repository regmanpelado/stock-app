"""Capa de persistencia de bots usando SQLAlchemy ORM."""
from app.database import get_session
from app.models.orm import Bot, Trade


# ── Escritura ──────────────────────────────────────────────────────────────────

def insert_bot(bot: dict) -> None:
    with get_session() as s:
        s.merge(Bot(
            id=bot["id"], user_id=bot.get("user_id", "demo"),
            name=bot["name"], type=bot["type"],
            config=bot["config"], sandbox=bot["sandbox"],
            status=bot["status"], created_at=bot["created_at"],
            pnl=bot.get("pnl", 0), pnl_pct=bot.get("pnl_pct", 0),
            total_invested=bot.get("total_invested", 0),
            current_value=bot.get("current_value", 0),
            stats=bot.get("stats", {}),
            last_check=bot.get("last_check"),
            error=bot.get("error"),
        ))


def update_bot(bot: dict) -> None:
    with get_session() as s:
        obj = s.get(Bot, bot["id"])
        if not obj:
            return
        obj.status         = bot["status"]
        obj.pnl            = bot.get("pnl", 0)
        obj.pnl_pct        = bot.get("pnl_pct", 0)
        obj.total_invested = bot.get("total_invested", 0)
        obj.current_value  = bot.get("current_value", 0)
        obj.stats          = bot.get("stats", {})
        obj.last_check     = bot.get("last_check")
        obj.error          = bot.get("error")


def update_status(bot_id: str, status: str, error: str | None = None) -> None:
    with get_session() as s:
        obj = s.get(Bot, bot_id)
        if obj:
            obj.status = status
            obj.error  = error


def delete_bot(bot_id: str) -> None:
    with get_session() as s:
        obj = s.get(Bot, bot_id)
        if obj:
            s.delete(obj)


def insert_trade(trade: dict, bot_id: str) -> None:
    with get_session() as s:
        existing = s.get(Trade, trade["id"])
        if existing:
            return
        s.add(Trade(
            id=trade["id"], bot_id=bot_id,
            timestamp=trade["timestamp"], side=trade["side"],
            price=trade["price"], amount=trade["amount"],
            cost=trade["cost"], sandbox=bool(trade.get("sandbox", True)),
        ))


# ── Lectura ────────────────────────────────────────────────────────────────────

def load_all_bots() -> list[dict]:
    with get_session() as s:
        bots = s.query(Bot).order_by(Bot.created_at).all()
        return [b.to_dict() for b in bots]
