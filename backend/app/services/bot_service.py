"""
Servicio de bots de trading para acciones.
Bots: dca_stock, momentum_stock, signal_stock, rebalance.
"""
import asyncio
import uuid
from datetime import datetime, timezone

from app.services import bot_store


_tasks: dict[str, asyncio.Task] = {}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _safe_float(val, default=0.0) -> float:
    try:
        v = float(val)
        return v if v == v else default
    except Exception:
        return default


# ── CRUD ──────────────────────────────────────────────────────────────────────

def create_bot(bot_type: str, config: dict, sandbox: bool,
               name: str | None, user_id: str) -> dict:
    valid = {"dca_stock", "momentum_stock", "signal_stock", "rebalance"}
    if bot_type not in valid:
        raise ValueError(f"Tipo no soportado: {bot_type}. Validos: {valid}")
    default_names = {
        "dca_stock":      "DCA Acciones",
        "momentum_stock": "Momentum",
        "signal_stock":   "Senales RSI/MACD",
        "rebalance":      "Rebalanceo",
    }
    bot = {
        "id": str(uuid.uuid4()), "user_id": user_id,
        "type": bot_type,
        "name": name or default_names.get(bot_type, bot_type),
        "config": config, "sandbox": sandbox,
        "status": "stopped", "created_at": _now(),
        "pnl": 0.0, "pnl_pct": 0.0,
        "total_invested": 0.0, "current_value": 0.0,
        "stats": {}, "last_check": None, "error": None, "trades": [],
    }
    bot_store.save_bot(bot)
    return bot


def get_bot(bot_id: str) -> dict:
    bot = bot_store.get_bot(bot_id)
    if not bot:
        raise ValueError(f"Bot {bot_id} no encontrado")
    return bot


def list_bots(user_id: str | None = None) -> list[dict]:
    bots = bot_store.list_bots()
    if user_id:
        bots = [b for b in bots if b.get("user_id") == user_id]
    return bots


def pause_bot(bot_id: str) -> None:
    bot = get_bot(bot_id)
    bot["status"] = "paused"
    bot_store.update_bot(bot)
    if bot_id in _tasks:
        _tasks[bot_id].cancel()


def stop_bot(bot_id: str) -> None:
    bot = get_bot(bot_id)
    bot["status"] = "stopped"
    bot_store.update_bot(bot)
    if bot_id in _tasks:
        _tasks[bot_id].cancel()
        del _tasks[bot_id]


def delete_bot(bot_id: str) -> None:
    stop_bot(bot_id)
    bot_store.delete_bot(bot_id)


async def start_bot(bot_id: str) -> None:
    bot = get_bot(bot_id)
    if bot["status"] == "running":
        return
    bot["status"] = "running"
    bot["error"] = None
    bot_store.update_bot(bot)
    task = asyncio.create_task(_run_bot(bot_id))
    _tasks[bot_id] = task


async def load_and_resume() -> None:
    for bot in list_bots():
        if bot.get("status") == "running":
            task = asyncio.create_task(_run_bot(bot["id"]))
            _tasks[bot["id"]] = task


async def cleanup_all() -> None:
    for task in _tasks.values():
        task.cancel()
    _tasks.clear()


# ── Loop principal ────────────────────────────────────────────────────────────

async def _run_bot(bot_id: str) -> None:
    try:
        bot = get_bot(bot_id)
        dispatch = {
            "dca_stock":      _dca_loop,
            "momentum_stock": _momentum_loop,
            "signal_stock":   _signal_loop,
            "rebalance":      _rebalance_loop,
        }
        fn = dispatch.get(bot["type"])
        if not fn:
            raise ValueError(f"Tipo desconocido: {bot['type']}")
        await fn(bot_id)
    except asyncio.CancelledError:
        pass
    except Exception as e:
        try:
            bot = get_bot(bot_id)
            bot["status"] = "error"
            bot["error"] = str(e)[:200]
            bot_store.update_bot(bot)
        except Exception:
            pass


def _record_trade(bot: dict, side: str, price: float, shares: float, cost: float) -> None:
    trade = {
        "id": str(uuid.uuid4()), "timestamp": _now(),
        "side": side, "price": price, "shares": shares, "cost": cost,
        "sandbox": bot["sandbox"],
    }
    bot.setdefault("trades", []).insert(0, trade)
    bot["trades"] = bot["trades"][:500]


def _get_closes(symbol: str, exchange: str) -> list:
    import yfinance as yf
    from app.services.market_service import _full_symbol
    full = _full_symbol(symbol, exchange)
    hist = yf.Ticker(full).history(period="3mo", interval="1d")
    return hist["Close"].tolist() if not hist.empty else []


# ── DCA ───────────────────────────────────────────────────────────────────────

async def _dca_loop(bot_id: str) -> None:
    while True:
        bot = get_bot(bot_id)
        if bot["status"] != "running":
            break
        cfg = bot["config"]
        symbol   = cfg["symbol"]
        exchange = cfg.get("exchange", "NYSE")
        amount   = float(cfg["amount_usd"])
        interval = int(cfg.get("interval_minutes", 1440))
        tp_pct   = float(cfg.get("take_profit_pct", 0))
        sl_pct   = float(cfg.get("stop_loss_pct", 0))

        try:
            from app.services.market_service import get_quote as _get_quote
            quote  = await _get_quote(symbol, exchange)
            price  = quote["price"]
            shares = round(amount / price, 6)

            bot["total_invested"] = round(bot.get("total_invested", 0) + amount, 2)
            bot["current_value"]  = round(bot.get("current_value", 0) + amount, 2)
            _record_trade(bot, "buy", price, shares, amount)

            invested = bot["total_invested"]
            if invested > 0:
                bot["pnl_pct"] = round((bot["current_value"] - invested) / invested * 100, 2)
            bot["pnl"]        = round(bot["current_value"] - invested, 2)
            bot["last_check"] = _now()
            bot["stats"]      = {"last_price": price, "shares_total": shares}

            if tp_pct > 0 and bot["pnl_pct"] >= tp_pct:
                _record_trade(bot, "sell_tp", price, shares, bot["current_value"])
                bot["status"] = "stopped"
                bot["stats"]["exit_reason"] = "take_profit"
                bot_store.update_bot(bot)
                break
            if sl_pct > 0 and bot["pnl_pct"] <= -sl_pct:
                _record_trade(bot, "sell_sl", price, shares, bot["current_value"])
                bot["status"] = "stopped"
                bot["stats"]["exit_reason"] = "stop_loss"
                bot_store.update_bot(bot)
                break

            bot_store.update_bot(bot)
        except Exception as e:
            bot["error"] = str(e)[:200]
            bot_store.update_bot(bot)

        await asyncio.sleep(interval * 60)


# ── Momentum ──────────────────────────────────────────────────────────────────

async def _momentum_loop(bot_id: str) -> None:
    in_position = False
    entry_price = 0.0
    max_price   = 0.0

    while True:
        bot = get_bot(bot_id)
        if bot["status"] != "running":
            break
        cfg      = bot["config"]
        symbol   = cfg["symbol"]
        exchange = cfg.get("exchange", "NYSE")
        amount   = float(cfg["amount_usd"])
        rsi_min  = float(cfg.get("rsi_min", 55))
        rsi_max  = float(cfg.get("rsi_max", 75))
        tp_pct   = float(cfg.get("take_profit_pct", 5.0))
        sl_pct   = float(cfg.get("stop_loss_pct", 3.0))
        trail    = float(cfg.get("trailing_stop_pct", 2.0))
        interval = int(cfg.get("check_interval_minutes", 60))

        try:
            loop   = asyncio.get_event_loop()
            closes = await loop.run_in_executor(None, lambda: _get_closes(symbol, exchange))
            if len(closes) < 20:
                await asyncio.sleep(interval * 60)
                continue

            from app.services.signals_service import _rsi
            rsi   = _rsi(closes)
            price = closes[-1]

            if in_position:
                max_price   = max(max_price, price)
                pnl_pct     = (price - entry_price) / entry_price * 100
                trail_trigger = (max_price - price) / max_price * 100

                exit_reason = None
                if pnl_pct >= tp_pct:       exit_reason = "take_profit"
                elif pnl_pct <= -sl_pct:    exit_reason = "stop_loss"
                elif trail_trigger >= trail: exit_reason = "trailing_stop"

                if exit_reason:
                    shares = round(amount / entry_price, 6)
                    value  = round(shares * price, 2)
                    _record_trade(bot, "sell", price, shares, value)
                    bot["pnl"]     = round(value - amount, 2)
                    bot["pnl_pct"] = round(pnl_pct, 2)
                    bot["stats"]["exit_reason"] = exit_reason
                    in_position = False
            else:
                if rsi_min <= rsi <= rsi_max:
                    shares = round(amount / price, 6)
                    _record_trade(bot, "buy", price, shares, amount)
                    bot["total_invested"] = round(bot.get("total_invested", 0) + amount, 2)
                    entry_price = price
                    max_price   = price
                    in_position = True

            bot["last_check"] = _now()
            bot["stats"].update({"rsi": rsi, "price": price, "in_position": in_position})
            bot_store.update_bot(bot)
        except Exception as e:
            bot["error"] = str(e)[:200]
            bot_store.update_bot(bot)

        await asyncio.sleep(interval * 60)


# ── Signal RSI/MACD ───────────────────────────────────────────────────────────

async def _signal_loop(bot_id: str) -> None:
    in_position = False
    entry_price = 0.0

    while True:
        bot = get_bot(bot_id)
        if bot["status"] != "running":
            break
        cfg        = bot["config"]
        symbol     = cfg["symbol"]
        exchange   = cfg.get("exchange", "NYSE")
        amount     = float(cfg["amount_usd"])
        oversold   = float(cfg.get("rsi_oversold", 35))
        overbought = float(cfg.get("rsi_overbought", 65))
        use_macd   = bool(cfg.get("use_macd", True))
        interval   = int(cfg.get("check_interval_minutes", 60))

        try:
            loop   = asyncio.get_event_loop()
            closes = await loop.run_in_executor(None, lambda: _get_closes(symbol, exchange))
            if len(closes) < 26:
                await asyncio.sleep(interval * 60)
                continue

            from app.services.signals_service import _rsi, _macd
            rsi   = _rsi(closes)
            macd  = _macd(closes)
            price = closes[-1]

            if not in_position:
                buy_signal = rsi < oversold
                if use_macd:
                    buy_signal = buy_signal and macd["histogram"] > 0
                if buy_signal:
                    shares = round(amount / price, 6)
                    _record_trade(bot, "buy", price, shares, amount)
                    bot["total_invested"] = round(bot.get("total_invested", 0) + amount, 2)
                    entry_price = price
                    in_position = True
            else:
                sell_signal = rsi > overbought
                if use_macd:
                    sell_signal = sell_signal or macd["histogram"] < 0
                if sell_signal:
                    shares = round(amount / entry_price, 6)
                    value  = round(shares * price, 2)
                    _record_trade(bot, "sell", price, shares, value)
                    bot["pnl"] = round(bot.get("pnl", 0) + value - amount, 2)
                    in_position = False

            bot["last_check"] = _now()
            bot["stats"].update({"rsi": rsi, "macd": macd["histogram"],
                                  "price": price, "in_position": in_position})
            bot_store.update_bot(bot)
        except Exception as e:
            bot["error"] = str(e)[:200]
            bot_store.update_bot(bot)

        await asyncio.sleep(interval * 60)


# ── Rebalanceo ────────────────────────────────────────────────────────────────

async def _rebalance_loop(bot_id: str) -> None:
    while True:
        bot = get_bot(bot_id)
        if bot["status"] != "running":
            break
        cfg      = bot["config"]
        exchange = cfg.get("exchange", "NYSE")
        targets  = cfg.get("targets", {})
        capital  = float(cfg.get("total_capital_usd", 1000))
        interval = int(cfg.get("check_interval_minutes", 1440))

        try:
            from app.services.market_service import get_quote
            rebalanced = []
            for sym, target_pct in targets.items():
                q = await get_quote(sym, exchange)
                target_val    = capital * target_pct / 100
                target_shares = round(target_val / q["price"], 6) if q["price"] > 0 else 0
                rebalanced.append({
                    "symbol": sym, "target_pct": target_pct,
                    "target_value": round(target_val, 2),
                    "target_shares": target_shares,
                    "price": q["price"],
                })

            bot["last_check"] = _now()
            bot["stats"] = {"rebalanced": rebalanced, "capital": capital}
            bot_store.update_bot(bot)
        except Exception as e:
            bot["error"] = str(e)[:200]
            bot_store.update_bot(bot)

        await asyncio.sleep(interval * 60)
