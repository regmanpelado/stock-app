import asyncio
import uuid
from datetime import datetime, timezone

from app.services.exchange_service import fetch_ticker, create_order
from app.services import bot_store


def _persist(bot_id: str) -> None:
    """Persiste el estado actual del bot en SQLite. Nunca lanza excepción."""
    try:
        bot = _bots.get(bot_id)
        if bot:
            bot_store.update_bot(bot)
    except Exception:
        pass

# ── Estado global ──────────────────────────────────────────────────────────────
_bots: dict[str, dict] = {}
_tasks: dict[str, asyncio.Task] = {}


# ── Helpers ────────────────────────────────────────────────────────────────────

def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _grid_levels(low: float, high: float, n: int) -> list[float]:
    if n < 2:
        return [low, high]
    step = (high - low) / (n - 1)
    return [round(low + step * i, 8) for i in range(n)]


def _record_trade(bot_id: str, side: str, price: float, amount: float, sandbox: bool):
    trade = {
        "id": str(uuid.uuid4())[:8],
        "timestamp": _now(),
        "side": side,
        "price": round(price, 8),
        "amount": round(amount, 8),
        "cost": round(price * amount, 6),
        "sandbox": sandbox,
    }
    trades = _bots[bot_id]["trades"]
    trades.insert(0, trade)
    if len(trades) > 200:
        _bots[bot_id]["trades"] = trades[:200]
    try:
        bot_store.insert_trade(trade, bot_id)
    except Exception:
        pass
    return trade


async def _get_price(exchange: str, symbol: str) -> float:
    ticker = await fetch_ticker(exchange, symbol)
    return float(ticker["last"])


async def _execute(bot_id: str, exchange: str, symbol: str,
                   side: str, amount: float, sandbox: bool) -> tuple[dict, float]:
    price = await _get_price(exchange, symbol)
    if not sandbox:
        # Usar credenciales propias del usuario si las tiene configuradas
        user_id = (_bots.get(bot_id) or {}).get("user_id")
        order   = None
        if user_id:
            try:
                from app.services.exchange_key_service import get_credentials
                from app.services.exchange_service import get_exchange_with_credentials
                creds = get_credentials(user_id, exchange)
                if creds:
                    api_key, api_secret = creds
                    exc   = get_exchange_with_credentials(exchange, api_key, api_secret)
                    order = exc.create_order(symbol, "market", side, amount)
            except Exception:
                pass
        if order is None:
            order = await create_order(exchange, symbol, side, "market", amount)
        price = float(order.get("price") or order.get("average") or price)
    trade = _record_trade(bot_id, side, price, amount, sandbox)
    try:
        from app.services.audit_service import log as audit_log
        audit_log("TRADE_EXECUTED", user_id=user_id,
                  details={"bot_id": bot_id, "exchange": exchange, "symbol": symbol,
                           "side": side, "amount": amount, "price": price,
                           "sandbox": sandbox})
    except Exception:
        pass
    return trade, price


def _on_done(bot_id: str, task: asyncio.Task):
    bot = _bots.get(bot_id)
    if not bot:
        return
    # Si fue cancelado por cleanup_all (shutdown limpio), NO tocar el estado en BD:
    # el último _persist() del loop ya guardó status="running", lo que permite
    # que load_and_resume() lo reanude en el próximo arranque.
    if task.cancelled():
        return
    if bot["status"] == "running":
        try:
            exc = task.exception()
        except Exception:
            exc = None
        bot["status"] = "error" if exc else "stopped"
        if exc:
            bot["error"] = str(exc)
        _persist(bot_id)


# ── CRUD ───────────────────────────────────────────────────────────────────────

def create_bot(bot_type: str, config: dict, sandbox: bool = True,
               name: str | None = None, user_id: str = "demo") -> dict:
    bot_id = str(uuid.uuid4())[:8]
    label = name or f"{bot_type.upper()} #{bot_id[:4]}"

    stats: dict = {}
    if bot_type == "dca":
        stats = {"total_orders": 0, "total_quantity": 0.0,
                 "avg_cost": 0.0, "next_order_at": None}
    elif bot_type == "grid":
        levels = _grid_levels(
            config["lower_price"], config["upper_price"], config["grid_levels"]
        )
        stats = {
            "levels": [{"price": p, "bought": False, "entry": None, "qty": None} for p in levels],
            "completed_cycles": 0,
            "realized_pnl": 0.0,
            "total_buy_fills": 0,
            "total_sell_fills": 0,
            "profit_per_cycle": 0.0,
            "grid_efficiency": 0.0,
            "available_profit": 0.0,
            "trail_count": 0,
            "auto_paused": False,
            "pause_reason": None,
            "dynamic_updated": None,
            "dynamic_ticks": 0,
        }
    elif bot_type == "signal":
        stats = {
            "position": 0.0, "avg_entry": 0.0,
            "total_signals": 0, "buy_signals": 0, "sell_signals": 0,
            "win_trades": 0, "last_signal": None,
        }
    elif bot_type == "ia_dynamic":
        stats = {
            "positions": {},     # {symbol: {qty, avg_entry, entry_date, current_price}}
            "ranking": [],       # top símbolos del último scan con scores
            "total_scans": 0,
            "rotations": 0,
            "realized_pnl": 0.0,
            "last_scan": None,
        }
    elif bot_type == "market_making":
        stats = {
            "mid_price": 0.0,
            "bid_prices": [],
            "ask_prices": [],
            "current_inventory": 0.0,
            "avg_buy_price": 0.0,
            "buy_fills": 0,
            "sell_fills": 0,
            "total_fills": 0,
            "spread_earned": 0.0,
            "realized_pnl": 0.0,
            "last_refresh": None,
        }
    elif bot_type == "arbitrage":
        stats = {
            "price_a": 0.0,
            "price_b": 0.0,
            "current_spread_pct": 0.0,
            "best_spread_pct": 0.0,
            "buy_exchange": None,
            "sell_exchange": None,
            "opportunities_scanned": 0,
            "opportunities_found": 0,
            "trades_executed": 0,
            "realized_pnl": 0.0,
            "last_opportunity": None,
        }
    elif bot_type == "momentum":
        stats = {
            "position": 0.0,
            "entry_price": 0.0,
            "peak_price": 0.0,
            "entry_time": None,
            "total_trades": 0,
            "winning_trades": 0,
            "losing_trades": 0,
            "win_rate": 0.0,
            "avg_profit_pct": 0.0,
            "realized_pnl": 0.0,
            "current_signal": "neutral",
            "momentum_score": 0.0,
            "last_rsi": None,
            "last_macd_hist": None,
            "last_trade": None,
        }
    elif bot_type == "mean_reversion":
        stats = {
            "position": 0.0,
            "entry_price": 0.0,
            "entry_time": None,
            "total_trades": 0,
            "winning_trades": 0,
            "losing_trades": 0,
            "win_rate": 0.0,
            "avg_profit_pct": 0.0,
            "realized_pnl": 0.0,
            "current_signal": "neutral",
            "bb_upper": None,
            "bb_middle": None,
            "bb_lower": None,
            "deviation_pct": 0.0,
            "pct_b": None,
            "last_rsi": None,
            "last_trade": None,
        }
    elif bot_type == "scalping":
        stats = {
            "position": 0.0,
            "entry_price": 0.0,
            "entry_time": None,
            "total_trades": 0,
            "winning_trades": 0,
            "losing_trades": 0,
            "win_rate": 0.0,
            "avg_profit_pct": 0.0,
            "realized_pnl": 0.0,
            "current_signal": "neutral",
            "last_rsi": None,
            "last_macd_hist": None,
            "last_trade": None,
        }

    elif bot_type == "funding_arb":
        stats = {
            "position_open":          False,
            "direction":              None,      # "long_spot_short_perp" | "short_spot_long_perp"
            "entry_price":            0.0,
            "quantity":               0.0,
            "entry_time":             None,
            "exit_reason":            None,
            "last_funding_rate_pct":  0.0,
            "mark_price":             0.0,
            "annualized_yield_pct":   0.0,
            "total_funding_collected": 0.0,
            "funding_payments":       [],
            "last_payment_ts":        0.0,
            "total_checks":           0,
        }

    bot = {
        "id": bot_id, "user_id": user_id, "name": label, "type": bot_type,
        "config": config, "sandbox": sandbox,
        "status": "stopped",
        "created_at": _now(),
        "pnl": 0.0, "pnl_pct": 0.0,
        "total_invested": 0.0, "current_value": 0.0,
        "trades": [], "stats": stats,
        "last_check": None, "error": None,
    }
    _bots[bot_id] = bot
    try:
        bot_store.insert_bot(bot)
    except Exception:
        pass
    return bot


async def start_bot(bot_id: str):
    bot = _require(bot_id)
    if bot_id in _tasks and not _tasks[bot_id].done():
        bot["status"] = "running"
        bot_store.update_status(bot_id, "running")
        return
    bot["status"] = "running"
    bot["error"] = None
    bot_store.update_status(bot_id, "running")
    loops = {"dca": _dca_loop, "grid": _grid_loop, "signal": _signal_loop,
             "ia_dynamic": _ia_dynamic_loop, "market_making": _market_making_loop,
             "arbitrage": _arbitrage_loop, "scalping": _scalping_loop,
             "mean_reversion": _mean_reversion_loop, "momentum": _momentum_loop,
             "funding_arb": _funding_arb_loop}
    fn = loops.get(bot["type"])
    if not fn:
        raise ValueError(f"Tipo desconocido: {bot['type']}")
    task = asyncio.create_task(fn(bot_id))
    task.add_done_callback(lambda t: _on_done(bot_id, t))
    _tasks[bot_id] = task


def pause_bot(bot_id: str):
    _require(bot_id)["status"] = "paused"
    bot_store.update_status(bot_id, "paused")


def stop_bot(bot_id: str):
    _require(bot_id)["status"] = "stopped"
    bot_store.update_status(bot_id, "stopped")
    if bot_id in _tasks:
        _tasks[bot_id].cancel()
        del _tasks[bot_id]


def delete_bot(bot_id: str):
    stop_bot(bot_id)
    del _bots[bot_id]
    try:
        bot_store.delete_bot(bot_id)
    except Exception:
        pass


def get_bot(bot_id: str) -> dict:
    return _require(bot_id)


def list_bots(user_id: str | None = None) -> list[dict]:
    bots = list(_bots.values())
    if user_id is not None:
        bots = [b for b in bots if b.get("user_id") == user_id]
    return bots


def _require(bot_id: str) -> dict:
    if bot_id not in _bots:
        raise ValueError(f"Bot {bot_id} no encontrado")
    return _bots[bot_id]


# ── Loop DCA ───────────────────────────────────────────────────────────────────

async def _dca_check_exit(bot_id: str) -> bool:
    """Comprueba TP/SL del DCA. Devuelve True si se cerró la posición."""
    bot = _bots.get(bot_id)
    if not bot:
        return False
    s   = bot["stats"]
    cfg = bot["config"]
    if s["total_quantity"] <= 0 or s["avg_cost"] <= 0:
        return False

    take_profit = float(cfg.get("take_profit_pct", 0))
    stop_loss   = float(cfg.get("stop_loss_pct",   0))
    if take_profit <= 0 and stop_loss <= 0:
        return False

    try:
        exchange, symbol = cfg["exchange"], cfg["symbol"]
        price   = await _get_price(exchange, symbol)
        pnl_pct = (price / s["avg_cost"] - 1) * 100

        exit_reason = None
        if take_profit > 0 and pnl_pct >= take_profit:
            exit_reason = f"Take profit +{pnl_pct:.2f}%"
        elif stop_loss > 0 and pnl_pct <= -stop_loss:
            exit_reason = f"Stop loss {pnl_pct:.2f}%"

        if exit_reason:
            qty = s["total_quantity"]
            _, sell_price = await _execute(bot_id, exchange, symbol, "sell", qty, bot["sandbox"])
            realized = (sell_price - s["avg_cost"]) * qty
            bot["pnl"]           = round(bot.get("pnl", 0) + realized, 6)
            bot["pnl_pct"]       = 0.0
            bot["total_invested"] = 0.0
            bot["current_value"]  = 0.0
            s["total_quantity"]  = 0.0
            s["avg_cost"]        = 0.0
            s["last_exit"]       = {"reason": exit_reason, "price": sell_price,
                                    "realized_pnl": round(realized, 6), "at": _now()}
            bot["last_check"] = _now()
            _persist(bot_id)
            return True
    except Exception as e:
        if _bots.get(bot_id):
            _bots[bot_id]["error"] = str(e)
    return False


async def _dca_loop(bot_id: str):
    while True:
        bot = _bots.get(bot_id)
        if not bot or bot["status"] == "stopped":
            break
        if bot["status"] == "paused":
            await asyncio.sleep(5)
            continue

        # Comprueba TP/SL antes de cada nueva compra
        await _dca_check_exit(bot_id)

        bot = _bots.get(bot_id)
        if not bot or bot["status"] == "stopped":
            break

        try:
            cfg = bot["config"]
            exchange, symbol = cfg["exchange"], cfg["symbol"]
            quote_amount = float(cfg["amount"])

            price = await _get_price(exchange, symbol)
            base_amount = round(quote_amount / price, 8)

            _, exec_price = await _execute(bot_id, exchange, symbol, "buy", base_amount, bot["sandbox"])

            s = bot["stats"]
            old_qty = s["total_quantity"]
            new_qty = old_qty + base_amount
            s["avg_cost"] = (s["avg_cost"] * old_qty + exec_price * base_amount) / new_qty if new_qty else exec_price
            s["total_quantity"] = new_qty
            s["total_orders"] += 1

            invested    = new_qty * s["avg_cost"]
            current_val = new_qty * exec_price
            bot["total_invested"] = round(invested, 6)
            bot["current_value"]  = round(current_val, 6)
            bot["pnl"]     = round(current_val - invested, 6)
            bot["pnl_pct"] = round((current_val / invested - 1) * 100, 4) if invested else 0
            bot["last_check"] = _now()

            interval = int(cfg.get("interval_minutes", 60)) * 60
            s["next_order_at"] = datetime.fromtimestamp(
                datetime.now(timezone.utc).timestamp() + interval, tz=timezone.utc
            ).isoformat()

            # Comprueba TP/SL inmediatamente después de comprar
            await _dca_check_exit(bot_id)

        except Exception as e:
            bot["error"] = str(e)
            _persist(bot_id)
            await asyncio.sleep(30)
            continue

        _persist(bot_id)

        # Sleep en trozos de 60 s; cada minuto comprueba TP/SL y pause/stop
        interval = int(cfg.get("interval_minutes", 60)) * 60
        slept = 0
        while slept < interval:
            chunk = min(60, interval - slept)
            await asyncio.sleep(chunk)
            slept += chunk
            state = _bots.get(bot_id, {}).get("status")
            if state in ("stopped", "paused"):
                break
            # Revisión periódica de TP/SL durante la espera
            exited = await _dca_check_exit(bot_id)
            if exited:
                break  # Reinicia el ciclo de compras inmediatamente


# ── Loop Grid ──────────────────────────────────────────────────────────────────

async def _grid_loop(bot_id: str):
    while True:
        bot = _bots.get(bot_id)
        if not bot or bot["status"] == "stopped":
            break

        # ── Pause / auto-resume ────────────────────────────────────────────────
        if bot["status"] == "paused":
            s_p = bot["stats"]
            if s_p.get("auto_paused", False):
                try:
                    rec = await _get_price(bot["config"]["exchange"], bot["config"]["symbol"])
                    if rec >= bot["config"]["lower_price"]:
                        s_p["auto_paused"]  = False
                        s_p["pause_reason"] = None
                        bot["status"]       = "running"
                        bot_store.update_status(bot_id, "running")
                        _persist(bot_id)
                        # fall through to execute this cycle
                    else:
                        await asyncio.sleep(30)
                        continue
                except Exception:
                    await asyncio.sleep(30)
                    continue
            else:
                await asyncio.sleep(5)
                continue

        try:
            cfg      = bot["config"]
            exchange = cfg["exchange"]
            symbol   = cfg["symbol"]
            amount   = float(cfg["amount_per_grid"])
            sandbox  = bot["sandbox"]
            s        = bot["stats"]
            price    = await _get_price(exchange, symbol)

            # Backward-compat: garantizar campos nuevos en bots antiguos
            s.setdefault("total_buy_fills",  0)
            s.setdefault("total_sell_fills", 0)
            s.setdefault("profit_per_cycle", 0.0)
            s.setdefault("grid_efficiency",  0.0)
            s.setdefault("available_profit", 0.0)
            s.setdefault("trail_count",      0)
            s.setdefault("auto_paused",      False)
            s.setdefault("pause_reason",     None)
            s.setdefault("dynamic_updated",  None)
            s.setdefault("dynamic_ticks",    0)
            for lv in s["levels"]:
                lv.setdefault("qty", None)

            # ── Feature 1: Grid Dinámico (Bollinger Bands) ────────────────────
            if cfg.get("dynamic_grid", False):
                s["dynamic_ticks"] += 1
                first_run     = s["dynamic_updated"] is None
                outside_range = price > cfg["upper_price"] * 1.02 or price < cfg["lower_price"] * 0.98
                if first_run or outside_range or s["dynamic_ticks"] >= 480:
                    try:
                        from app.services.signals_service import analyze_symbol
                        analysis = await analyze_symbol(exchange, symbol, "4h")
                        bb       = (analysis.get("indicators") or {}).get("bollinger") or {}
                        bb_lower = bb.get("lower")
                        bb_upper = bb.get("upper")
                        if bb_lower and bb_upper and bb_upper > bb_lower * 1.005:
                            cfg["lower_price"] = round(float(bb_lower), 2)
                            cfg["upper_price"] = round(float(bb_upper), 2)
                            n          = cfg["grid_levels"]
                            new_prices = _grid_levels(cfg["lower_price"], cfg["upper_price"], n)
                            old_map    = {lv["price"]: lv for lv in s["levels"]}
                            new_levels = []
                            for p in new_prices:
                                closest = min(old_map, key=lambda op: abs(op - p)) if old_map else None
                                if closest and abs(closest - p) / max(p, 1) < 0.015:
                                    lv = old_map[closest]
                                    new_levels.append({"price": p, "bought": lv["bought"],
                                                       "entry": lv.get("entry"), "qty": lv.get("qty")})
                                else:
                                    new_levels.append({"price": p, "bought": False, "entry": None, "qty": None})
                            s["levels"]          = new_levels
                            s["dynamic_updated"] = _now()
                            s["dynamic_ticks"]   = 0
                    except Exception:
                        pass

            # ── Feature 2: Grid Trailing ──────────────────────────────────────
            if cfg.get("trailing_grid", False):
                n_lv = len(s["levels"])
                if n_lv > 1:
                    step = (cfg["upper_price"] - cfg["lower_price"]) / (n_lv - 1)
                    if step > 0 and price > cfg["upper_price"] * 1.001:
                        cfg["lower_price"] = round(cfg["lower_price"] + step, 2)
                        cfg["upper_price"] = round(cfg["upper_price"] + step, 2)
                        new_prices         = _grid_levels(cfg["lower_price"], cfg["upper_price"], n_lv)
                        s["levels"]        = [{"price": p, "bought": False, "entry": None, "qty": None}
                                              for p in new_prices]
                        s["trail_count"]  += 1

            # ── Feature 3: Protección de Tendencia ───────────────────────────
            if cfg.get("trend_protection", False):
                thr      = float(cfg.get("trend_threshold_pct", 3.0)) / 100
                drop_pct = (cfg["lower_price"] - price) / cfg["lower_price"] * 100
                if price < cfg["lower_price"] * (1 - thr):
                    s["auto_paused"]  = True
                    s["pause_reason"] = f"Precio cayó {drop_pct:.1f}% bajo el mínimo del grid"
                    bot["status"]     = "paused"
                    bot_store.update_status(bot_id, "paused")
                    _persist(bot_id)
                    await asyncio.sleep(30)
                    continue

            # ── Feature 4: Reinversión de beneficios (prep) ───────────────────
            open_slots     = sum(1 for lv in s["levels"] if not lv["bought"])
            avail          = s["available_profit"]
            reinvest_bonus = (avail / open_slots) if (
                cfg.get("reinvest_profits", False) and open_slots > 0 and avail > 0
            ) else 0.0
            bonus_used = 0.0

            # ── Lógica central del grid ────────────────────────────────────────
            levels = s["levels"]
            for i, lv in enumerate(levels):
                lp = lv["price"]

                # BUY: precio baja al/bajo el nivel
                if not lv["bought"] and price <= lp:
                    eff_qty = amount + reinvest_bonus
                    _, ep   = await _execute(bot_id, exchange, symbol, "buy", eff_qty, sandbox)
                    lv["bought"] = True
                    lv["entry"]  = ep
                    lv["qty"]    = eff_qty
                    s["total_buy_fills"] += 1
                    bonus_used += reinvest_bonus

                # SELL: precio sube al/sobre el nivel siguiente
                elif lv["bought"] and i + 1 < len(levels) and price >= levels[i + 1]["price"]:
                    sell_qty = lv.get("qty") or amount
                    _, ep    = await _execute(bot_id, exchange, symbol, "sell", sell_qty, sandbox)
                    profit   = (ep - (lv["entry"] or lp)) * sell_qty
                    lv["bought"] = False
                    lv["entry"]  = None
                    lv["qty"]    = None
                    s["realized_pnl"]     = round(s["realized_pnl"] + profit, 8)
                    s["completed_cycles"] += 1
                    s["total_sell_fills"] += 1
                    if cfg.get("reinvest_profits", False) and profit > 0:
                        s["available_profit"] = round(s["available_profit"] + profit, 8)

            if bonus_used > 0:
                s["available_profit"] = round(max(0.0, s["available_profit"] - bonus_used), 8)

            # ── Feature 5: Estadísticas avanzadas ─────────────────────────────
            completed  = s["completed_cycles"]
            buy_fills  = s["total_buy_fills"]
            sell_fills = s["total_sell_fills"]
            s["profit_per_cycle"] = round(s["realized_pnl"] / completed, 6) if completed > 0 else 0.0
            s["grid_efficiency"]  = round(sell_fills / max(1, buy_fills) * 100, 1)

            # ── P&L ────────────────────────────────────────────────────────────
            bought   = [lv for lv in levels if lv["bought"]]
            invested = sum((lv["entry"] or lv["price"]) * (lv.get("qty") or amount) for lv in bought)
            cur_val  = sum((lv.get("qty") or amount) * price for lv in bought)
            bot["total_invested"] = round(invested, 6)
            bot["current_value"]  = round(cur_val, 6)
            unrealized = cur_val - invested
            bot["pnl"]     = round(s["realized_pnl"] + unrealized, 6)
            bot["pnl_pct"] = round((cur_val / invested - 1) * 100, 4) if invested else 0
            bot["last_check"] = _now()

        except Exception as e:
            if _bots.get(bot_id):
                _bots[bot_id]["error"] = str(e)

        _persist(bot_id)
        await asyncio.sleep(30)


# ── Loop Signal ────────────────────────────────────────────────────────────────

async def _signal_loop(bot_id: str):
    while True:
        bot = _bots.get(bot_id)
        if not bot or bot["status"] == "stopped":
            break
        if bot["status"] == "paused":
            await asyncio.sleep(10)
            continue

        try:
            from app.services.signals_service import analyze_symbol
            cfg = bot["config"]
            exchange, symbol = cfg["exchange"], cfg["symbol"]
            tf = cfg.get("timeframe", "1h")

            analysis = await analyze_symbol(exchange, symbol, tf)
            indicators = analysis.get("indicators", {})
            rsi = (indicators.get("rsi") or {}).get("value")
            histogram = (indicators.get("macd") or {}).get("histogram")
            price = analysis.get("price")

            if price is None:
                await asyncio.sleep(60)
                continue

            s = bot["stats"]
            signal = None
            reason = ""

            if cfg.get("use_rsi", True) and rsi is not None:
                if rsi <= float(cfg.get("rsi_oversold", 30)):
                    signal, reason = "buy", f"RSI sobrevendido ({rsi:.1f})"
                elif rsi >= float(cfg.get("rsi_overbought", 70)):
                    signal, reason = "sell", f"RSI sobrecomprado ({rsi:.1f})"

            if signal is None and cfg.get("use_macd", True) and histogram is not None:
                if histogram > 0:
                    signal, reason = "buy", f"MACD alcista (hist {histogram:.4f})"
                elif histogram < 0:
                    signal, reason = "sell", f"MACD bajista (hist {histogram:.4f})"

            s["last_signal"] = {"timestamp": _now(), "rsi": rsi,
                                "histogram": histogram, "signal": signal, "reason": reason}
            s["total_signals"] += 1
            amount = float(cfg["amount"])

            if signal == "buy" and s["position"] == 0:
                _, ep = await _execute(bot_id, exchange, symbol, "buy", amount, bot["sandbox"])
                s["position"] = amount
                s["avg_entry"] = ep
                s["buy_signals"] += 1

            elif signal == "sell" and s["position"] > 0:
                _, ep = await _execute(bot_id, exchange, symbol, "sell", s["position"], bot["sandbox"])
                if ep > s["avg_entry"]:
                    s["win_trades"] += 1
                s["sell_signals"] += 1
                pnl_trade = (ep - s["avg_entry"]) * s["position"]
                bot["pnl"] = round(bot["pnl"] + pnl_trade, 6)
                s["position"] = 0.0
                s["avg_entry"] = 0.0

            # P&L no realizado mientras hay posición abierta
            if s["position"] > 0 and s["avg_entry"]:
                unr = (price - s["avg_entry"]) * s["position"]
                bot["pnl_pct"] = round((price / s["avg_entry"] - 1) * 100, 4)
                bot["current_value"] = round(s["position"] * price, 6)
                bot["total_invested"] = round(s["position"] * s["avg_entry"], 6)

            bot["last_check"] = _now()

        except Exception as e:
            if _bots.get(bot_id):
                _bots[bot_id]["error"] = str(e)

        _persist(bot_id)
        interval = int(_bots.get(bot_id, {}).get("config", {}).get("check_interval_minutes", 5)) * 60
        slept = 0
        while slept < interval:
            await asyncio.sleep(min(10, interval - slept))
            slept += 10
            if _bots.get(bot_id, {}).get("status") in ("stopped", "paused"):
                break


# ── Loop IA Dinámico ───────────────────────────────────────────────────────────

def _ia_score_analysis(analysis: dict, prediction: dict | None) -> tuple[int, list[str]]:
    """Puntúa un símbolo combinando indicadores técnicos + predicción IA."""
    score = 0
    reasons: list[str] = []
    ind = analysis.get("indicators", {})

    rsi_sig = (ind.get("rsi") or {}).get("signal")
    rsi_val = (ind.get("rsi") or {}).get("value")
    if rsi_sig == "buy":
        score += 2
        reasons.append(f"RSI sobrevendido ({rsi_val:.0f})" if rsi_val else "RSI sobrevendido")
    elif rsi_sig == "sell":
        score -= 2

    if (ind.get("macd") or {}).get("signal") == "buy":
        score += 2
        reasons.append("MACD alcista")
    elif (ind.get("macd") or {}).get("signal") == "sell":
        score -= 2

    if (ind.get("bollinger") or {}).get("signal") == "buy":
        score += 1
        reasons.append("Bollinger inferior")
    elif (ind.get("bollinger") or {}).get("signal") == "sell":
        score -= 1

    if prediction:
        tend = prediction.get("tendencia")
        conf = prediction.get("confianza", 50) / 100
        if tend == "alcista":
            bonus = max(1, round(3 * conf))
            score += bonus
            reasons.append(f"IA alcista ({prediction.get('confianza', 0):.0f}%)")
        elif tend == "bajista":
            score -= max(1, round(2 * conf))

    return score, reasons


async def _ia_dynamic_scan(bot_id: str):
    """Un ciclo completo de análisis + rebalanceo de cartera."""
    from app.services.signals_service import analyze_symbol
    from app.services.exchange_service import get_exchange

    bot = _bots[bot_id]
    cfg = bot["config"]
    exchange_name   = cfg["exchange"]
    quote           = cfg.get("quote_currency", "USDT").upper()
    max_pos         = max(1, min(10, int(cfg.get("max_positions", 3))))
    cap_per         = float(cfg.get("capital_per_position", 100))
    min_score       = int(cfg.get("min_score", 2))
    top_n           = max(10, min(100, int(cfg.get("top_n_volume", 30))))
    use_ai          = bool(cfg.get("use_ai", True))
    sandbox         = bot["sandbox"]
    s               = bot["stats"]

    s["total_scans"] = s.get("total_scans", 0) + 1
    s["last_scan"]   = _now()

    # 1. Obtener los N pares con más volumen en la moneda de cotización
    exc = get_exchange(exchange_name)
    raw_tickers = exc.fetch_tickers()
    valid = [
        (sym, t) for sym, t in raw_tickers.items()
        if sym.endswith(f"/{quote}")
        and t.get("quoteVolume") and t["quoteVolume"] > 0
        and t.get("last") and t["last"] > 0
    ]
    valid.sort(key=lambda x: x[1].get("quoteVolume", 0), reverse=True)
    top_symbols = [sym for sym, _ in valid[:top_n]]

    if not top_symbols:
        bot["error"] = f"No se encontraron pares {quote} con volumen en {exchange_name}"
        return

    # 2. Calcular indicadores técnicos para cada símbolo (en paralelo)
    analyses = await asyncio.gather(
        *[analyze_symbol(exchange_name, sym, "1h") for sym in top_symbols],
        return_exceptions=True,
    )

    # 3. Puntuación inicial (sin IA) → filtrar top candidatos
    candidates: list[tuple[int, list, dict, str]] = []
    for sym, result in zip(top_symbols, analyses):
        if isinstance(result, Exception):
            continue
        score, reasons = _ia_score_analysis(result, None)
        candidates.append((score, reasons, result, sym))
    candidates.sort(key=lambda x: x[0], reverse=True)

    # 4. Predicción IA solo para los mejores candidatos (top max_pos*2 + posiciones actuales)
    ai_targets = {sym for _, _, _, sym in candidates[: max(max_pos * 2, 6)]}
    ai_targets |= set(s.get("positions", {}).keys())  # siempre re-evaluar posiciones abiertas

    ranked: list[dict] = []
    for score_base, reasons, analysis, sym in candidates:
        pred = None
        if use_ai and sym in ai_targets:
            try:
                from app.services.prediction_service import predict_price
                pred = await predict_price(exchange_name, sym, "1h", 4)
            except Exception:
                pass
        final_score, final_reasons = _ia_score_analysis(analysis, pred)
        ranked.append({
            "symbol":      sym,
            "score":       final_score,
            "precio":      round(analysis.get("price") or 0, 8),
            "señal":       "compra" if final_score >= min_score else "venta" if final_score < 0 else "neutro",
            "tendencia_ia": (pred or {}).get("tendencia", "—"),
            "confianza_ia": (pred or {}).get("confianza", 0),
            "razones":     final_reasons[:3],
        })
    ranked.sort(key=lambda x: x["score"], reverse=True)
    s["ranking"] = ranked[:10]

    # 5. Determinar posiciones objetivo
    targets = {r["symbol"] for r in ranked[:max_pos] if r["score"] >= min_score}
    current_pos: dict = s.get("positions", {})

    # 6. Vender posiciones que ya no están en el ranking o tienen señal negativa
    to_sell = [
        sym for sym in list(current_pos.keys())
        if sym not in targets or next((r["score"] for r in ranked if r["symbol"] == sym), 0) < 0
    ]
    for sym in to_sell:
        pos = current_pos[sym]
        try:
            _, ep = await _execute(bot_id, exchange_name, sym, "sell", pos["qty"], sandbox)
            pnl = (ep - pos["avg_entry"]) * pos["qty"]
            s["realized_pnl"] = round(s.get("realized_pnl", 0) + pnl, 6)
            s["rotations"] = s.get("rotations", 0) + 1
            del current_pos[sym]
        except Exception as e:
            bot["error"] = f"Error vendiendo {sym}: {e}"

    # 7. Comprar nuevas posiciones objetivo
    to_buy = [sym for sym in targets if sym not in current_pos]
    for sym in to_buy:
        try:
            price = await _get_price(exchange_name, sym)
            base_qty = cap_per / price
            _, ep = await _execute(bot_id, exchange_name, sym, "buy", base_qty, sandbox)
            current_pos[sym] = {
                "qty": base_qty, "avg_entry": ep,
                "entry_date": _now(), "current_price": ep,
            }
        except Exception as e:
            bot["error"] = f"Error comprando {sym}: {e}"

    s["positions"] = current_pos

    # 8. Actualizar precios y P&L en tiempo real
    invested = 0.0
    cur_val  = 0.0
    for sym, pos in current_pos.items():
        try:
            cp = await _get_price(exchange_name, sym)
            pos["current_price"] = cp
            invested += pos["qty"] * pos["avg_entry"]
            cur_val  += pos["qty"] * cp
        except Exception:
            pass

    bot["total_invested"] = round(invested, 6)
    bot["current_value"]  = round(cur_val, 6)
    unrealized = cur_val - invested
    bot["pnl"]     = round(s["realized_pnl"] + unrealized, 6)
    bot["pnl_pct"] = round((cur_val / invested - 1) * 100, 4) if invested > 0 else 0.0
    bot["last_check"] = _now()


async def _ia_dynamic_loop(bot_id: str):
    while True:
        bot = _bots.get(bot_id)
        if not bot or bot["status"] == "stopped":
            break
        if bot["status"] == "paused":
            await asyncio.sleep(10)
            continue
        try:
            await _ia_dynamic_scan(bot_id)
        except Exception as e:
            if _bots.get(bot_id):
                _bots[bot_id]["error"] = str(e)

        _persist(bot_id)
        interval = int(_bots.get(bot_id, {}).get("config", {}).get("scan_interval_minutes", 60)) * 60
        slept = 0
        while slept < interval:
            await asyncio.sleep(min(10, interval - slept))
            slept += 10
            if _bots.get(bot_id, {}).get("status") in ("stopped", "paused"):
                break


# ── Loop Momentum ──────────────────────────────────────────────────────────────

def _calc_momentum_score(rsi, histogram, price, bb_middle) -> float:
    """Score 0-100 que indica la fuerza del momentum alcista."""
    score = 0.0
    if rsi is not None:
        score += min(40.0, max(0.0, rsi - 50))          # 0-40 pts: RSI sobre 50
    if histogram is not None and histogram > 0:
        score += 30.0                                    # 30 pts: MACD alcista
    if price is not None and bb_middle is not None and price > bb_middle:
        score += 20.0                                    # 20 pts: precio sobre media BB
    return round(min(100.0, score), 1)


async def _momentum_loop(bot_id: str):
    while True:
        bot = _bots.get(bot_id)
        if not bot or bot["status"] == "stopped":
            break
        if bot["status"] == "paused":
            await asyncio.sleep(5)
            continue

        try:
            from app.services.signals_service import analyze_symbol
            cfg               = bot["config"]
            exchange          = cfg["exchange"]
            symbol            = cfg["symbol"]
            tf                = cfg.get("timeframe", "1h")
            amount            = float(cfg["amount"])
            rsi_min           = float(cfg.get("rsi_min", 55))
            rsi_max           = float(cfg.get("rsi_max", 75))
            tp_pct            = float(cfg.get("take_profit_pct", 3.0)) / 100
            sl_pct            = float(cfg.get("stop_loss_pct", 2.0)) / 100
            trail_pct         = float(cfg.get("trailing_stop_pct", 1.5)) / 100
            max_hours         = int(cfg.get("max_open_hours", 24))
            sandbox           = bot["sandbox"]
            s                 = bot["stats"]

            analysis   = await analyze_symbol(exchange, symbol, tf)
            ind        = analysis.get("indicators", {})
            rsi        = (ind.get("rsi") or {}).get("value")
            histogram  = (ind.get("macd") or {}).get("histogram")
            bb_middle  = (ind.get("bollinger") or {}).get("middle")
            price      = analysis.get("price")

            if price is None:
                await asyncio.sleep(60)
                continue

            s["last_rsi"]       = round(rsi, 2) if rsi is not None else None
            s["last_macd_hist"] = round(histogram, 6) if histogram is not None else None
            s["momentum_score"] = _calc_momentum_score(rsi, histogram, price, bb_middle)

            # ── Gestión de posición abierta ────────────────────────────────────
            if s["position"] > 0 and s["entry_price"] > 0:
                # Actualizar precio máximo (para trailing stop)
                if price > (s.get("peak_price") or 0):
                    s["peak_price"] = price

                entry       = s["entry_price"]
                peak        = s.get("peak_price") or entry
                pnl_pct     = (price - entry) / entry
                exit_reason = None

                if pnl_pct >= tp_pct:
                    exit_reason = f"Take profit +{pnl_pct*100:.2f}%"
                elif price <= peak * (1 - trail_pct):
                    drawdown = (peak - price) / peak * 100
                    exit_reason = f"Trailing stop -{drawdown:.2f}% desde pico"
                elif pnl_pct <= -sl_pct:
                    exit_reason = f"Stop loss {pnl_pct*100:.2f}%"
                elif rsi is not None and rsi > rsi_max + 5:
                    exit_reason = f"RSI sobrecomprado ({rsi:.1f})"
                elif histogram is not None and histogram < 0:
                    exit_reason = "MACD giró bajista"
                elif s["entry_time"]:
                    try:
                        entry_ts  = datetime.fromisoformat(s["entry_time"]).timestamp()
                        elapsed_h = (datetime.now(timezone.utc).timestamp() - entry_ts) / 3600
                        if elapsed_h > max_hours:
                            exit_reason = f"Tiempo máximo ({elapsed_h:.0f}h)"
                    except Exception:
                        pass

                if exit_reason:
                    _, ep      = await _execute(bot_id, exchange, symbol, "sell", s["position"], sandbox)
                    pnl        = (ep - entry) * s["position"]
                    trade_pct  = (ep - entry) / entry * 100
                    s["realized_pnl"]   = round(s["realized_pnl"] + pnl, 8)
                    s["total_trades"]  += 1
                    if pnl >= 0:
                        s["winning_trades"] += 1
                    else:
                        s["losing_trades"]  += 1
                    n = s["total_trades"]
                    s["win_rate"]       = round(s["winning_trades"] / n * 100, 1)
                    s["avg_profit_pct"] = round(
                        (s["avg_profit_pct"] * (n - 1) + trade_pct) / n, 3
                    )
                    s["last_trade"] = {
                        "timestamp": _now(), "entry": round(entry, 6), "peak": round(peak, 6),
                        "exit": round(ep, 6), "pnl": round(pnl, 6),
                        "pnl_pct": round(trade_pct, 3), "reason": exit_reason,
                    }
                    s["position"]       = 0.0
                    s["entry_price"]    = 0.0
                    s["peak_price"]     = 0.0
                    s["entry_time"]     = None
                    s["current_signal"] = "salida"

            # ── Búsqueda de entrada ────────────────────────────────────────────
            elif s["position"] == 0:
                momentum_ok = (
                    rsi is not None and rsi_min <= rsi <= rsi_max and
                    histogram is not None and histogram > 0 and
                    bb_middle is not None and price > bb_middle
                )
                s["current_signal"] = "compra" if momentum_ok else "neutral"

                if momentum_ok:
                    _, ep             = await _execute(bot_id, exchange, symbol, "buy", amount, sandbox)
                    s["position"]     = amount
                    s["entry_price"]  = ep
                    s["peak_price"]   = ep
                    s["entry_time"]   = _now()
                    s["current_signal"] = "en posición"

            # ── P&L ────────────────────────────────────────────────────────────
            unrealized        = (price - s["entry_price"]) * s["position"] if s["position"] > 0 and s["entry_price"] > 0 else 0.0
            bot["pnl"]        = round(s["realized_pnl"] + unrealized, 6)
            bot["total_invested"] = round(s["entry_price"] * s["position"], 6) if s["position"] > 0 else 0.0
            bot["current_value"]  = round(price * s["position"], 6) if s["position"] > 0 else 0.0
            bot["pnl_pct"]    = round((price / s["entry_price"] - 1) * 100, 4) if s["position"] > 0 and s["entry_price"] > 0 else 0.0
            bot["last_check"] = _now()

        except Exception as e:
            if _bots.get(bot_id):
                _bots[bot_id]["error"] = str(e)

        _persist(bot_id)

        interval = int(_bots.get(bot_id, {}).get("config", {}).get("check_interval_minutes", 15)) * 60
        slept = 0
        while slept < interval:
            await asyncio.sleep(min(10, interval - slept))
            slept += 10
            if _bots.get(bot_id, {}).get("status") in ("stopped", "paused"):
                break


# ── Loop Mean Reversion ────────────────────────────────────────────────────────

async def _mean_reversion_loop(bot_id: str):
    while True:
        bot = _bots.get(bot_id)
        if not bot or bot["status"] == "stopped":
            break
        if bot["status"] == "paused":
            await asyncio.sleep(5)
            continue

        try:
            from app.services.signals_service import analyze_symbol
            cfg          = bot["config"]
            exchange     = cfg["exchange"]
            symbol       = cfg["symbol"]
            tf           = cfg.get("timeframe", "1h")
            amount       = float(cfg["amount"])
            rsi_confirm  = bool(cfg.get("rsi_confirm", True))
            rsi_oversold = float(cfg.get("rsi_oversold", 35))
            exit_at_mean = bool(cfg.get("exit_at_mean", True))
            sl_pct       = float(cfg.get("stop_loss_pct", 3.0)) / 100
            max_hours    = int(cfg.get("max_open_hours", 48))
            sandbox      = bot["sandbox"]
            s            = bot["stats"]

            analysis  = await analyze_symbol(exchange, symbol, tf)
            ind       = analysis.get("indicators", {})
            bb        = ind.get("bollinger") or {}
            rsi_val   = (ind.get("rsi") or {}).get("value")
            price     = analysis.get("price")

            bb_upper  = bb.get("upper")
            bb_middle = bb.get("middle")
            bb_lower  = bb.get("lower")
            pct_b     = bb.get("pct_b")

            if price is None or bb_middle is None:
                await asyncio.sleep(60)
                continue

            s["bb_upper"]      = bb_upper
            s["bb_middle"]     = bb_middle
            s["bb_lower"]      = bb_lower
            s["pct_b"]         = pct_b
            s["deviation_pct"] = round((price - bb_middle) / bb_middle * 100, 3)
            s["last_rsi"]      = round(rsi_val, 2) if rsi_val is not None else None

            # ── Gestión de posición abierta ────────────────────────────────────
            if s["position"] > 0 and s["entry_price"] > 0:
                entry    = s["entry_price"]
                pnl_pct  = (price - entry) / entry
                exit_reason = None

                if exit_at_mean and bb_middle and price >= bb_middle:
                    exit_reason = f"Precio recuperó la media (${bb_middle:,.2f})"
                elif not exit_at_mean and bb_upper and price >= bb_upper:
                    exit_reason = f"Precio alcanzó banda superior (${bb_upper:,.2f})"
                elif rsi_val is not None and rsi_val > 65:
                    exit_reason = f"RSI sobrecomprado ({rsi_val:.1f})"
                elif pnl_pct <= -sl_pct:
                    exit_reason = f"Stop loss ({pnl_pct*100:.2f}%)"
                elif s["entry_time"]:
                    try:
                        entry_ts   = datetime.fromisoformat(s["entry_time"]).timestamp()
                        elapsed_h  = (datetime.now(timezone.utc).timestamp() - entry_ts) / 3600
                        if elapsed_h > max_hours:
                            exit_reason = f"Tiempo máximo ({elapsed_h:.0f}h)"
                    except Exception:
                        pass

                if exit_reason:
                    _, ep     = await _execute(bot_id, exchange, symbol, "sell", s["position"], sandbox)
                    pnl       = (ep - entry) * s["position"]
                    trade_pct = (ep - entry) / entry * 100
                    s["realized_pnl"] = round(s["realized_pnl"] + pnl, 8)
                    s["total_trades"] += 1
                    if pnl >= 0:
                        s["winning_trades"] += 1
                    else:
                        s["losing_trades"] += 1
                    n = s["total_trades"]
                    s["win_rate"]       = round(s["winning_trades"] / n * 100, 1)
                    s["avg_profit_pct"] = round(
                        (s["avg_profit_pct"] * (n - 1) + trade_pct) / n, 3
                    )
                    s["last_trade"] = {
                        "timestamp": _now(), "entry": round(entry, 6),
                        "exit": round(ep, 6), "pnl": round(pnl, 6),
                        "pnl_pct": round(trade_pct, 3), "reason": exit_reason,
                    }
                    s["position"]       = 0.0
                    s["entry_price"]    = 0.0
                    s["entry_time"]     = None
                    s["current_signal"] = "salida"

            # ── Búsqueda de entrada ────────────────────────────────────────────
            elif s["position"] == 0:
                bb_buy = bb_lower is not None and price <= bb_lower
                rsi_ok = (not rsi_confirm) or (rsi_val is not None and rsi_val < rsi_oversold)
                s["current_signal"] = "compra" if (bb_buy and rsi_ok) else "neutral"

                if bb_buy and rsi_ok:
                    _, ep            = await _execute(bot_id, exchange, symbol, "buy", amount, sandbox)
                    s["position"]    = amount
                    s["entry_price"] = ep
                    s["entry_time"]  = _now()
                    s["current_signal"] = "en posición"

            # ── P&L ────────────────────────────────────────────────────────────
            unrealized      = (price - s["entry_price"]) * s["position"] if s["position"] > 0 and s["entry_price"] > 0 else 0.0
            bot["pnl"]      = round(s["realized_pnl"] + unrealized, 6)
            bot["total_invested"] = round(s["entry_price"] * s["position"], 6) if s["position"] > 0 else 0.0
            bot["current_value"]  = round(price * s["position"], 6) if s["position"] > 0 else 0.0
            bot["pnl_pct"]  = round((price / s["entry_price"] - 1) * 100, 4) if s["position"] > 0 and s["entry_price"] > 0 else 0.0
            bot["last_check"] = _now()

        except Exception as e:
            if _bots.get(bot_id):
                _bots[bot_id]["error"] = str(e)

        _persist(bot_id)

        interval = int(_bots.get(bot_id, {}).get("config", {}).get("check_interval_minutes", 15)) * 60
        slept = 0
        while slept < interval:
            await asyncio.sleep(min(10, interval - slept))
            slept += 10
            if _bots.get(bot_id, {}).get("status") in ("stopped", "paused"):
                break


# ── Loop Scalping ──────────────────────────────────────────────────────────────

async def _scalping_loop(bot_id: str):
    while True:
        bot = _bots.get(bot_id)
        if not bot or bot["status"] == "stopped":
            break
        if bot["status"] == "paused":
            await asyncio.sleep(5)
            continue

        try:
            from app.services.signals_service import analyze_symbol
            cfg          = bot["config"]
            exchange     = cfg["exchange"]
            symbol       = cfg["symbol"]
            tf           = cfg.get("timeframe", "5m")
            amount       = float(cfg["amount"])
            tp_pct       = float(cfg.get("take_profit_pct", 0.5)) / 100
            sl_pct       = float(cfg.get("stop_loss_pct", 0.3)) / 100
            rsi_entry    = float(cfg.get("rsi_entry", 45))
            max_mins     = int(cfg.get("max_open_minutes", 60))
            sandbox      = bot["sandbox"]
            s            = bot["stats"]

            analysis    = await analyze_symbol(exchange, symbol, tf)
            indicators  = analysis.get("indicators", {})
            rsi         = (indicators.get("rsi") or {}).get("value")
            histogram   = (indicators.get("macd") or {}).get("histogram")
            price       = analysis.get("price")

            if price is None:
                await asyncio.sleep(30)
                continue

            s["last_rsi"]       = round(rsi, 2) if rsi is not None else None
            s["last_macd_hist"] = round(histogram, 6) if histogram is not None else None

            # ── Gestión de posición abierta ────────────────────────────────────
            if s["position"] > 0 and s["entry_price"] > 0:
                entry    = s["entry_price"]
                pnl_pct  = (price - entry) / entry
                exit_reason = None

                if pnl_pct >= tp_pct:
                    exit_reason = f"Take profit +{pnl_pct*100:.2f}%"
                elif pnl_pct <= -sl_pct:
                    exit_reason = f"Stop loss {pnl_pct*100:.2f}%"
                elif rsi is not None and rsi > 70:
                    exit_reason = f"RSI sobrecomprado ({rsi:.1f})"
                elif histogram is not None and histogram < 0:
                    exit_reason = "MACD giró bajista"
                elif s["entry_time"]:
                    try:
                        entry_ts    = datetime.fromisoformat(s["entry_time"]).timestamp()
                        elapsed_min = (datetime.now(timezone.utc).timestamp() - entry_ts) / 60
                        if elapsed_min > max_mins:
                            exit_reason = f"Tiempo máximo ({elapsed_min:.0f} min)"
                    except Exception:
                        pass

                if exit_reason:
                    _, ep   = await _execute(bot_id, exchange, symbol, "sell", s["position"], sandbox)
                    pnl     = (ep - entry) * s["position"]
                    trade_pct = (ep - entry) / entry * 100
                    s["realized_pnl"] = round(s["realized_pnl"] + pnl, 8)
                    s["total_trades"] += 1
                    if pnl >= 0:
                        s["winning_trades"] += 1
                    else:
                        s["losing_trades"] += 1
                    n = s["total_trades"]
                    s["win_rate"]       = round(s["winning_trades"] / n * 100, 1)
                    s["avg_profit_pct"] = round(
                        (s["avg_profit_pct"] * (n - 1) + trade_pct) / n, 3
                    )
                    s["last_trade"] = {
                        "timestamp": _now(), "entry": round(entry, 6),
                        "exit": round(ep, 6), "pnl": round(pnl, 6),
                        "pnl_pct": round(trade_pct, 3), "reason": exit_reason,
                    }
                    s["position"]       = 0.0
                    s["entry_price"]    = 0.0
                    s["entry_time"]     = None
                    s["current_signal"] = "salida"

            # ── Búsqueda de entrada ────────────────────────────────────────────
            elif s["position"] == 0:
                buy = (
                    rsi is not None and rsi < rsi_entry and
                    histogram is not None and histogram > 0
                )
                s["current_signal"] = "compra" if buy else "neutral"
                if buy:
                    _, ep            = await _execute(bot_id, exchange, symbol, "buy", amount, sandbox)
                    s["position"]    = amount
                    s["entry_price"] = ep
                    s["entry_time"]  = _now()
                    s["current_signal"] = "en posición"

            # ── P&L ────────────────────────────────────────────────────────────
            unrealized = (price - s["entry_price"]) * s["position"] if s["position"] > 0 and s["entry_price"] > 0 else 0.0
            bot["pnl"]          = round(s["realized_pnl"] + unrealized, 6)
            bot["total_invested"] = round(s["entry_price"] * s["position"], 6) if s["position"] > 0 else 0.0
            bot["current_value"]  = round(price * s["position"], 6) if s["position"] > 0 else 0.0
            bot["pnl_pct"]      = round((price / s["entry_price"] - 1) * 100, 4) if s["position"] > 0 and s["entry_price"] > 0 else 0.0
            bot["last_check"]   = _now()

        except Exception as e:
            if _bots.get(bot_id):
                _bots[bot_id]["error"] = str(e)

        _persist(bot_id)

        interval = int(_bots.get(bot_id, {}).get("config", {}).get("check_interval", 30))
        slept = 0
        while slept < interval:
            await asyncio.sleep(min(5, interval - slept))
            slept += 5
            if _bots.get(bot_id, {}).get("status") in ("stopped", "paused"):
                break


# ── Loop Arbitraje ─────────────────────────────────────────────────────────────

async def _arbitrage_loop(bot_id: str):
    while True:
        bot = _bots.get(bot_id)
        if not bot or bot["status"] == "stopped":
            break
        if bot["status"] == "paused":
            await asyncio.sleep(5)
            continue

        try:
            cfg        = bot["config"]
            ex_a       = cfg["exchange_a"]
            ex_b       = cfg["exchange_b"]
            symbol     = cfg["symbol"]
            amount     = float(cfg["amount"])
            min_spread = float(cfg.get("min_spread_pct", 0.3)) / 100
            sandbox    = bot["sandbox"]
            s          = bot["stats"]

            if ex_a == ex_b:
                bot["error"] = "exchange_a y exchange_b deben ser distintos"
                await asyncio.sleep(30)
                continue

            # Precios de ambos exchanges en paralelo
            price_a, price_b = await asyncio.gather(
                _get_price(ex_a, symbol),
                _get_price(ex_b, symbol),
            )

            s["price_a"] = round(price_a, 8)
            s["price_b"] = round(price_b, 8)

            # Determinar dirección: siempre comprar en el más barato
            if price_a <= price_b:
                buy_ex,  sell_ex  = ex_a,    ex_b
                buy_price, sell_price = price_a, price_b
            else:
                buy_ex,  sell_ex  = ex_b,    ex_a
                buy_price, sell_price = price_b, price_a

            spread_pct = (sell_price - buy_price) / buy_price
            s["current_spread_pct"] = round(spread_pct * 100, 4)
            s["buy_exchange"]       = buy_ex
            s["sell_exchange"]      = sell_ex
            s["opportunities_scanned"] = s.get("opportunities_scanned", 0) + 1

            if spread_pct > (s.get("best_spread_pct") or 0) / 100:
                s["best_spread_pct"] = round(spread_pct * 100, 4)

            if spread_pct >= min_spread:
                s["opportunities_found"] = s.get("opportunities_found", 0) + 1
                base_qty = amount / buy_price

                _, ep_buy  = await _execute(bot_id, buy_ex,  symbol, "buy",  base_qty, sandbox)
                _, ep_sell = await _execute(bot_id, sell_ex, symbol, "sell", base_qty, sandbox)

                profit = (ep_sell - ep_buy) * base_qty
                s["realized_pnl"]    = round(s.get("realized_pnl", 0) + profit, 8)
                s["trades_executed"] = s.get("trades_executed", 0) + 1
                s["last_opportunity"] = {
                    "timestamp":  _now(),
                    "buy_ex":     buy_ex,
                    "sell_ex":    sell_ex,
                    "buy_price":  round(ep_buy, 6),
                    "sell_price": round(ep_sell, 6),
                    "spread_pct": round(spread_pct * 100, 4),
                    "profit":     round(profit, 6),
                }

                trades_done = s["trades_executed"]
                bot["total_invested"] = round(amount * trades_done, 4)
                bot["current_value"]  = round(amount * trades_done + s["realized_pnl"], 4)

            bot["pnl"]        = round(s.get("realized_pnl", 0), 6)
            bot["pnl_pct"]    = round(s["realized_pnl"] / bot["total_invested"] * 100, 4) if bot["total_invested"] > 0 else 0.0
            bot["last_check"] = _now()

        except Exception as e:
            if _bots.get(bot_id):
                _bots[bot_id]["error"] = str(e)

        _persist(bot_id)

        interval = int(_bots.get(bot_id, {}).get("config", {}).get("check_interval", 10))
        slept = 0
        while slept < interval:
            await asyncio.sleep(min(5, interval - slept))
            slept += 5
            if _bots.get(bot_id, {}).get("status") in ("stopped", "paused"):
                break


# ── Loop Market Making ─────────────────────────────────────────────────────────

async def _market_making_loop(bot_id: str):
    prev_price: float | None = None

    while True:
        bot = _bots.get(bot_id)
        if not bot or bot["status"] == "stopped":
            break
        if bot["status"] == "paused":
            await asyncio.sleep(5)
            continue

        try:
            cfg      = bot["config"]
            exchange = cfg["exchange"]
            symbol   = cfg["symbol"]
            half     = float(cfg.get("spread_pct", 0.5)) / 200   # mitad del spread como decimal
            qty      = float(cfg["order_size"])
            levels   = max(1, min(5, int(cfg.get("levels", 1))))
            max_inv  = float(cfg.get("max_inventory", qty * 5))
            sandbox  = bot["sandbox"]
            s        = bot["stats"]

            mid = await _get_price(exchange, symbol)

            # Niveles de precio: cada nivel i está (i+1)*half_spread alejado del mid
            bids = [round(mid * (1 - half * (i + 1)), 8) for i in range(levels)]
            asks = [round(mid * (1 + half * (i + 1)), 8) for i in range(levels)]

            s["mid_price"]    = round(mid, 8)
            s["bid_prices"]   = bids
            s["ask_prices"]   = asks
            s["last_refresh"] = _now()

            inv     = s.get("current_inventory", 0.0)
            avg_buy = s.get("avg_buy_price", 0.0)

            if prev_price is not None:
                # Precio bajó → detectar cruces de bids (fills de compra)
                if mid < prev_price:
                    for bid_lv in bids:
                        if prev_price > bid_lv >= mid and inv < max_inv:
                            _, ep   = await _execute(bot_id, exchange, symbol, "buy", qty, sandbox)
                            old_inv = inv
                            inv     = round(inv + qty, 8)
                            avg_buy = (avg_buy * old_inv + ep * qty) / inv
                            s["buy_fills"]   += 1
                            s["total_fills"] += 1
                            break

                # Precio subió → detectar cruces de asks (fills de venta)
                elif mid > prev_price:
                    for ask_lv in asks:
                        if prev_price < ask_lv <= mid and inv > 0:
                            fill_qty = min(qty, inv)
                            _, ep    = await _execute(bot_id, exchange, symbol, "sell", fill_qty, sandbox)
                            pnl      = (ep - avg_buy) * fill_qty if avg_buy > 0 else 0.0
                            s["realized_pnl"]  = round(s["realized_pnl"] + pnl, 8)
                            s["spread_earned"] = round(s["spread_earned"] + max(0.0, pnl), 8)
                            inv = round(max(0.0, inv - fill_qty), 8)
                            if inv <= 0:
                                avg_buy = 0.0
                            s["sell_fills"]  += 1
                            s["total_fills"] += 1
                            break

            prev_price             = mid
            s["current_inventory"] = inv
            s["avg_buy_price"]     = round(avg_buy, 8)

            # Actualizar P&L
            unrealized       = (mid - avg_buy) * inv if avg_buy > 0 and inv > 0 else 0.0
            bot["pnl"]       = round(s["realized_pnl"] + unrealized, 6)
            invested         = inv * avg_buy if avg_buy > 0 else 0.0
            cur_val          = inv * mid
            bot["total_invested"] = round(invested, 6)
            bot["current_value"]  = round(cur_val, 6)
            bot["pnl_pct"]        = round((cur_val / invested - 1) * 100, 4) if invested > 0 else 0.0
            bot["last_check"]     = _now()

        except Exception as e:
            if _bots.get(bot_id):
                _bots[bot_id]["error"] = str(e)

        _persist(bot_id)

        refresh = int(_bots.get(bot_id, {}).get("config", {}).get("refresh_interval", 30))
        slept = 0
        while slept < refresh:
            await asyncio.sleep(min(5, refresh - slept))
            slept += 5
            if _bots.get(bot_id, {}).get("status") in ("stopped", "paused"):
                break


# ── Loop Funding Rate Arbitrage ───────────────────────────────────────────────

async def _get_funding_rate(symbol: str, exchange: str = "binance") -> dict:
    """Obtiene el funding rate actual del perpetuo (API pública, sin auth)."""
    import httpx

    async with httpx.AsyncClient(timeout=10) as client:

        if exchange == "gateio":
            # Gate.io: símbolo en formato BTC_USDT
            contract = symbol.replace("/", "_").replace("USDT", "_USDT") \
                             .replace("__", "_").strip("_").upper()
            if not contract.endswith("_USDT"):
                contract = contract + "_USDT"
            url = f"https://fx-api.gateio.ws/api/v4/futures/usdt/contracts/{contract}"
            r = await client.get(url)
            if r.status_code != 200:
                raise ValueError(f"Gate.io: no se pudo obtener funding rate para {contract}: {r.text[:120]}")
            data = r.json()
            rate   = float(data.get("funding_rate", 0))
            mark   = float(data.get("mark_price", 0))
            return {
                "funding_rate":   rate,
                "mark_price":     mark,
                "next_funding_ts": 0,
                "annualized_pct":  round(rate * 3 * 365 * 100, 2),
            }

        elif exchange == "bybit":
            # Bybit: símbolo en formato BTCUSDT
            raw = symbol.replace("/", "").replace("_", "").replace(":USDT", "").upper()
            url = f"https://api.bybit.com/v5/market/tickers?category=linear&symbol={raw}"
            r = await client.get(url)
            if r.status_code != 200:
                raise ValueError(f"Bybit: error {r.status_code} para {raw}")
            data  = r.json()
            t     = data["result"]["list"][0]
            rate  = float(t.get("fundingRate", 0))
            mark  = float(t.get("markPrice", 0))
            next_ts = int(t.get("nextFundingTime", 0)) / 1000
            return {
                "funding_rate":    rate,
                "mark_price":      mark,
                "next_funding_ts": next_ts,
                "annualized_pct":  round(rate * 3 * 365 * 100, 2),
            }

        elif exchange == "okx":
            # OKX: instId en formato BTC-USDT-SWAP
            base = symbol.replace("/", "").replace("_", "").replace("USDT", "").upper()
            inst_id = f"{base}-USDT-SWAP"
            r_fr = await client.get(
                f"https://www.okx.com/api/v5/public/funding-rate?instId={inst_id}")
            r_mp = await client.get(
                f"https://www.okx.com/api/v5/public/mark-price?instType=SWAP&instId={inst_id}")
            if r_fr.status_code != 200:
                raise ValueError(f"OKX: error {r_fr.status_code} para {inst_id}")
            rate     = float(r_fr.json()["data"][0]["fundingRate"])
            next_ts  = int(r_fr.json()["data"][0]["fundingTime"]) / 1000
            mark     = float(r_mp.json()["data"][0]["markPx"]) if r_mp.status_code == 200 else 0
            return {
                "funding_rate":    rate,
                "mark_price":      mark,
                "next_funding_ts": next_ts,
                "annualized_pct":  round(rate * 3 * 365 * 100, 2),
            }

        else:  # binance (default)
            raw = symbol.replace("/", "").replace(":USDT", "").replace(":USD", "").upper()
            url = f"https://fapi.binance.com/fapi/v1/premiumIndex?symbol={raw}"
            r = await client.get(url)
            if r.status_code != 200:
                raise ValueError(f"Binance: no se pudo obtener funding rate para {raw}: {r.text[:120]}")
            data = r.json()
            rate   = float(data.get("lastFundingRate", 0))
            mark   = float(data.get("markPrice", 0))
            next_ts = int(data.get("nextFundingTime", 0)) / 1000
            return {
                "funding_rate":   rate,
                "mark_price":     mark,
                "next_funding_ts": next_ts,
                "annualized_pct":  round(rate * 3 * 365 * 100, 2),
            }


async def _funding_arb_loop(bot_id: str):
    while True:
        bot = _bots.get(bot_id)
        if not bot or bot["status"] == "stopped":
            break
        if bot["status"] == "paused":
            await asyncio.sleep(10)
            continue

        cfg = bot["config"]
        s   = bot["stats"]
        symbol    = cfg.get("symbol", "BTC/USDT")
        amount    = float(cfg.get("amount_usdt", 100))
        min_rate  = float(cfg.get("min_funding_rate_pct", 0.01)) / 100
        auto_exit = bool(cfg.get("auto_exit_on_negative", True))

        try:
            fd   = await _get_funding_rate(symbol, cfg.get("exchange", "binance"))
            rate = fd["funding_rate"]
            mark = fd["mark_price"]

            s["last_funding_rate_pct"] = round(rate * 100, 4)
            s["mark_price"]            = mark
            s["annualized_yield_pct"]  = fd["annualized_pct"]
            s["total_checks"]         += 1

            if not s["position_open"]:
                # Entrar si el funding supera el umbral mínimo
                if abs(rate) >= min_rate and mark > 0:
                    direction = "long_spot_short_perp" if rate >= 0 else "short_spot_long_perp"
                    qty       = round(amount / mark, 6)

                    if not bot["sandbox"]:
                        # Modo real: spot compra + apertura short en perpetuos
                        exchange_name = cfg.get("exchange", "binance")
                        side_spot = "buy"  if direction == "long_spot_short_perp" else "sell"
                        _, ep = await _execute(bot_id, exchange_name, symbol,
                                               side_spot, qty, False)
                        mark = ep  # usar precio de ejecución real
                        # Apertura de posición en futuros perpetuos
                        try:
                            from app.services.exchange_service import get_exchange_with_credentials
                            from app.services.exchange_key_service import get_credentials
                            import ccxt
                            uid   = bot.get("user_id")
                            creds = get_credentials(uid, exchange_name) if uid else None
                            if creds:
                                perp_cfg = {"apiKey": creds[0], "secret": creds[1],
                                            "enableRateLimit": True,
                                            "options": {"defaultType": "future"}}
                                perp_ex = getattr(ccxt, exchange_name)(perp_cfg)
                                perp_side = "sell" if direction == "long_spot_short_perp" else "buy"
                                perp_symbol = symbol.split("/")[0] + "/USDT:USDT"
                                perp_ex.create_order(perp_symbol, "market", perp_side, qty)
                        except Exception as perp_err:
                            bot["error"] = f"Perpetuo: {perp_err}"

                    now_ts = datetime.now(timezone.utc).timestamp()
                    s["position_open"]   = True
                    s["direction"]       = direction
                    s["entry_price"]     = mark
                    s["quantity"]        = qty
                    s["entry_time"]      = _now()
                    s["last_payment_ts"] = now_ts
                    bot["total_invested"]  = round(amount, 2)
                    bot["current_value"]   = round(amount, 2)
                    bot["last_check"]      = _now()

            else:
                # Posición abierta: registrar funding cada ~8 h
                now_ts      = datetime.now(timezone.utc).timestamp()
                hours_since = (now_ts - s["last_payment_ts"]) / 3600

                if hours_since >= 8:
                    notional  = s["quantity"] * s["entry_price"]
                    payment   = notional * abs(rate)
                    s["total_funding_collected"] = round(
                        s["total_funding_collected"] + payment, 6)
                    s["funding_payments"].append({
                        "amount":   round(payment, 6),
                        "rate_pct": round(rate * 100, 4),
                        "at":       _now(),
                    })
                    if len(s["funding_payments"]) > 200:
                        s["funding_payments"] = s["funding_payments"][-200:]
                    s["last_payment_ts"] = now_ts
                    bot["pnl"]     = round(s["total_funding_collected"], 6)
                    invested       = bot.get("total_invested", 1) or 1
                    bot["pnl_pct"] = round(bot["pnl"] / invested * 100, 4)

                # Auto-salida si el funding se invierte
                if auto_exit:
                    should_exit = (
                        (s["direction"] == "long_spot_short_perp"  and rate < 0) or
                        (s["direction"] == "short_spot_long_perp"  and rate > 0)
                    )
                    if should_exit:
                        if not bot["sandbox"]:
                            # Cerrar spot + perpetuo
                            exchange_name = cfg.get("exchange", "binance")
                            close_spot = "sell" if s["direction"] == "long_spot_short_perp" else "buy"
                            try:
                                await _execute(bot_id, exchange_name, symbol,
                                               close_spot, s["quantity"], False)
                            except Exception:
                                pass
                        s["position_open"] = False
                        s["direction"]     = None
                        s["exit_reason"]   = f"Funding negativo ({rate*100:.4f}%)"
                        s["exit_time"]     = _now()

            bot["last_check"] = _now()

        except Exception as e:
            if _bots.get(bot_id):
                _bots[bot_id]["error"] = str(e)

        _persist(bot_id)

        interval = int(cfg.get("check_interval_minutes", 30)) * 60
        slept = 0
        while slept < interval:
            await asyncio.sleep(min(60, interval - slept))
            slept += 60
            if _bots.get(bot_id, {}).get("status") in ("stopped", "paused"):
                break


# ── Carga desde DB y reanudación automática ────────────────────────────────────

async def load_and_resume() -> None:
    """Llamada al arrancar: carga bots desde SQLite y reanuda los activos."""
    from app.db import init_db

    init_db()
    bots = bot_store.load_all_bots()
    if not bots:
        return

    to_resume = []
    for bot in bots:
        saved_status = bot["status"]
        bot["status"] = "stopped"        # reset antes de arrancar
        _bots[bot["id"]] = bot
        if saved_status in ("running", "paused"):
            to_resume.append((bot["id"], saved_status))

    resumed = 0
    for bid, saved_status in to_resume:
        try:
            await start_bot(bid)
            if saved_status == "paused":
                pause_bot(bid)           # re-aplica la pausa
            resumed += 1
        except Exception as e:
            _bots[bid]["status"] = "error"
            _bots[bid]["error"]  = f"Error al reanudar: {e}"
            bot_store.update_status(bid, "error", _bots[bid]["error"])

    total = len(bots)
    print(f"[DB] {total} bot(s) cargado(s), {resumed} reanudado(s).")


# ── Cleanup al apagar ──────────────────────────────────────────────────────────

async def cleanup_all():
    for task in list(_tasks.values()):
        task.cancel()
    if _tasks:
        await asyncio.gather(*_tasks.values(), return_exceptions=True)
    _tasks.clear()
