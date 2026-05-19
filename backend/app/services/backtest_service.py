"""Motor de backtesting: DCA, Señales sobre datos OHLCV históricos."""
from datetime import datetime, timezone
from app.services.signals_service import compute_rsi, compute_macd, compute_bollinger


async def fetch_ohlcv(exchange: str, symbol: str, timeframe: str = "1d", limit: int = 365):
    """Adaptador: obtiene OHLCV de yfinance para backtesting de acciones."""
    import yfinance as yf
    period_map = {"1m": "1mo", "5m": "3mo", "15m": "3mo", "1h": "6mo",
                  "4h": "1y", "1d": "2y", "1w": "5y"}
    period = period_map.get(timeframe, "1y")
    interval_map = {"1m": "1m", "5m": "5m", "15m": "15m", "1h": "1h",
                    "4h": "1h", "1d": "1d", "1w": "1wk"}
    interval = interval_map.get(timeframe, "1d")
    from app.services.market_service import _full_symbol
    full = _full_symbol(symbol, exchange) if symbol else symbol
    hist = yf.Ticker(full).history(period=period, interval=interval)
    if hist.empty:
        return []
    return [
        {"timestamp": int(idx.timestamp() * 1000),
         "open": float(row.Open), "high": float(row.High),
         "low": float(row.Low), "close": float(row.Close),
         "volume": int(row.Volume)}
        for idx, row in hist.iterrows()
    ]

PERIOD_LIMITS = {"1m": 30, "3m": 90, "6m": 180, "1y": 365}


def _date(ts_ms: int) -> str:
    return datetime.fromtimestamp(ts_ms / 1000, tz=timezone.utc).strftime("%Y-%m-%d")


def _grid_levels(low: float, high: float, n: int) -> list[float]:
    step = (high - low) / max(n - 1, 1)
    return [round(low + step * i, 8) for i in range(n)]


def _summary(trades: list, initial: float, final: float, candles: list) -> dict:
    start_price = candles[0]["close"]
    end_price   = candles[-1]["close"]
    bh_final    = initial / start_price * end_price
    bh_pct      = (bh_final / initial - 1) * 100

    closed = [t for t in trades if t.get("pnl") is not None]
    best   = max(closed, key=lambda t: t["pnl"], default=None)
    worst  = min(closed, key=lambda t: t["pnl"], default=None)
    wins   = [t for t in closed if t["pnl"] > 0]

    return {
        "capital_inicial":   round(initial, 2),
        "capital_final":     round(final, 2),
        "rentabilidad_pct":  round((final / initial - 1) * 100, 2),
        "rentabilidad_eur":  round(final - initial, 2),
        "num_operaciones":   len(trades),
        "operaciones_cerradas": len(closed),
        "win_rate":          round(len(wins) / len(closed) * 100, 1) if closed else 0,
        "mejor_operacion":   best,
        "peor_operacion":    worst,
        "buy_hold_pct":      round(bh_pct, 2),
        "buy_hold_final":    round(bh_final, 2),
        "periodo_inicio":    _date(candles[0]["timestamp"]),
        "periodo_fin":       _date(candles[-1]["timestamp"]),
        "num_velas":         len(candles),
    }


# ── DCA ────────────────────────────────────────────────────────────────────────

def _dca(candles: list, initial: float, params: dict) -> dict:
    amount    = float(params.get("amount_per_order", max(10, initial * 0.1)))
    interval  = max(1, int(params.get("interval_days", 7)))

    cash = initial
    qty  = 0.0
    trades: list = []
    curve: list  = []
    start_price  = candles[0]["close"]

    for i, c in enumerate(candles):
        price = c["close"]
        date  = _date(c["timestamp"])

        if i % interval == 0 and cash >= amount:
            bought = amount / price
            cash  -= amount
            qty   += bought
            trades.append({
                "fecha": date, "tipo": "compra",
                "precio": round(price, 4), "cantidad": round(bought, 8),
                "importe": round(amount, 2), "pnl": None, "pnl_pct": None,
            })

        portfolio = cash + qty * price
        curve.append({
            "fecha": date,
            "capital":   round(portfolio, 2),
            "buy_hold":  round(initial / start_price * price, 2),
        })

    final_price  = candles[-1]["close"]
    final_capital = cash + qty * final_price

    # P&L de cada compra respecto al precio final
    for t in trades:
        val = t["cantidad"] * final_price
        t["pnl"]     = round(val - t["importe"], 2)
        t["pnl_pct"] = round((val / t["importe"] - 1) * 100, 2)

    return {"resumen": _summary(trades, initial, final_capital, candles),
            "curva_capital": curve, "operaciones": trades}


# ── Grid ───────────────────────────────────────────────────────────────────────

def _grid(candles: list, initial: float, params: dict) -> dict:
    first_price  = candles[0]["close"]
    lower  = float(params.get("lower_price",  round(first_price * 0.85, 2)))
    upper  = float(params.get("upper_price",  round(first_price * 1.15, 2)))
    n_lv   = max(2, min(20, int(params.get("grid_levels", 5))))
    per_lv = float(params.get("amount_per_grid", round(initial / (n_lv * 2), 2)))

    levels  = _grid_levels(lower, upper, n_lv)
    cash    = initial
    bought: dict[int, dict] = {}   # {level_idx: {qty, buy_price}}
    trades: list = []
    curve:  list = []
    start_price  = candles[0]["close"]

    for c in candles:
        price = c["close"]
        date  = _date(c["timestamp"])

        for j, lv in enumerate(levels):
            # Buy trigger: price at/below level and not already held
            if j not in bought and price <= lv and cash >= per_lv:
                q = per_lv / price
                cash -= per_lv
                bought[j] = {"qty": q, "buy_price": price}
                trades.append({
                    "fecha": date, "tipo": "compra",
                    "precio": round(price, 4), "cantidad": round(q, 8),
                    "importe": round(per_lv, 2), "pnl": None, "pnl_pct": None,
                })

            # Sell trigger: held level and price reached next level
            elif j in bought and j + 1 < n_lv and price >= levels[j + 1]:
                h    = bought.pop(j)
                val  = h["qty"] * price
                cost = h["qty"] * h["buy_price"]
                pnl  = val - cost
                cash += val
                trades.append({
                    "fecha": date, "tipo": "venta",
                    "precio": round(price, 4), "cantidad": round(h["qty"], 8),
                    "importe": round(val, 2),
                    "pnl":     round(pnl, 2),
                    "pnl_pct": round(pnl / cost * 100, 2),
                })

        hv = sum(h["qty"] * price for h in bought.values())
        curve.append({
            "fecha": date,
            "capital":  round(cash + hv, 2),
            "buy_hold": round(initial / start_price * price, 2),
        })

    fp  = candles[-1]["close"]
    final_capital = cash + sum(h["qty"] * fp for h in bought.values())
    return {"resumen": _summary(trades, initial, final_capital, candles),
            "curva_capital": curve, "operaciones": trades}


# ── Señales (RSI) ──────────────────────────────────────────────────────────────

def _signal(candles: list, initial: float, params: dict) -> dict:
    oversold    = float(params.get("rsi_oversold",  30))
    overbought  = float(params.get("rsi_overbought", 70))
    trade_amt   = float(params.get("amount_per_trade", initial * 0.5))
    warmup      = 15

    cash        = initial
    holdings    = 0.0
    avg_entry   = 0.0
    trades: list = []
    curve:  list = []
    closes       = [c["close"] for c in candles]
    start_price  = candles[0]["close"]

    for i, c in enumerate(candles):
        price = c["close"]
        date  = _date(c["timestamp"])

        if i >= warmup:
            rsi = compute_rsi(closes[: i + 1]) or 50.0

            if rsi <= oversold and holdings == 0 and cash >= trade_amt:
                q      = trade_amt / price
                cash  -= trade_amt
                holdings  = q
                avg_entry = price
                trades.append({
                    "fecha": date, "tipo": "compra",
                    "precio": round(price, 4), "cantidad": round(q, 8),
                    "importe": round(trade_amt, 2),
                    "pnl": None, "pnl_pct": None,
                    "rsi": round(rsi, 1),
                })

            elif rsi >= overbought and holdings > 0:
                val  = holdings * price
                cost = holdings * avg_entry
                pnl  = val - cost
                cash += val
                trades.append({
                    "fecha": date, "tipo": "venta",
                    "precio": round(price, 4), "cantidad": round(holdings, 8),
                    "importe": round(val, 2),
                    "pnl":     round(pnl, 2),
                    "pnl_pct": round(pnl / cost * 100, 2),
                    "rsi": round(rsi, 1),
                })
                holdings  = 0.0
                avg_entry = 0.0

        curve.append({
            "fecha": date,
            "capital":  round(cash + holdings * price, 2),
            "buy_hold": round(initial / start_price * price, 2),
        })

    fp  = candles[-1]["close"]
    final_capital = cash + holdings * fp
    return {"resumen": _summary(trades, initial, final_capital, candles),
            "curva_capital": curve, "operaciones": trades}


# ── IA Dinámico ────────────────────────────────────────────────────────────────

def _ia_dynamic(candles: list, initial: float, params: dict) -> dict:
    capital_per_pos = float(params.get("capital_per_position", max(50, initial * 0.2)))
    min_score       = max(1, min(3, int(params.get("min_score", 2))))
    rsi_oversold    = float(params.get("rsi_oversold",  35))
    rsi_overbought  = float(params.get("rsi_overbought", 65))

    cash        = initial
    holdings    = 0.0
    avg_entry   = 0.0
    trades: list = []
    curve:  list = []
    closes       = [c["close"] for c in candles]
    start_price  = candles[0]["close"]
    warmup       = 35  # necesitamos slow EMA (26) + señal MACD (9)

    for i, c in enumerate(candles):
        price = c["close"]
        date  = _date(c["timestamp"])

        if i >= warmup:
            slice_c = closes[: i + 1]
            rsi       = compute_rsi(slice_c) or 50.0
            _, _, histo = compute_macd(slice_c)
            bb_up, _, bb_low = compute_bollinger(slice_c)

            # Puntuación de compra (0-3)
            buy_score = sum([
                rsi <= rsi_oversold,
                histo is not None and histo > 0,
                bb_low is not None and price <= bb_low,
            ])
            # Puntuación de venta (0-3)
            sell_score = sum([
                rsi >= rsi_overbought,
                histo is not None and histo < 0,
                bb_up is not None and price >= bb_up,
            ])

            if buy_score >= min_score and holdings == 0 and cash >= capital_per_pos:
                q         = capital_per_pos / price
                cash     -= capital_per_pos
                holdings  = q
                avg_entry = price
                trades.append({
                    "fecha": date, "tipo": "compra",
                    "precio": round(price, 4), "cantidad": round(q, 8),
                    "importe": round(capital_per_pos, 2),
                    "pnl": None, "pnl_pct": None,
                    "rsi": round(rsi, 1),
                })

            elif sell_score >= min_score and holdings > 0:
                val  = holdings * price
                cost = holdings * avg_entry
                pnl  = val - cost
                cash += val
                trades.append({
                    "fecha": date, "tipo": "venta",
                    "precio": round(price, 4), "cantidad": round(holdings, 8),
                    "importe": round(val, 2),
                    "pnl":     round(pnl, 2),
                    "pnl_pct": round(pnl / cost * 100, 2),
                    "rsi": round(rsi, 1),
                })
                holdings  = 0.0
                avg_entry = 0.0

        curve.append({
            "fecha": date,
            "capital":  round(cash + holdings * price, 2),
            "buy_hold": round(initial / start_price * price, 2),
        })

    fp  = candles[-1]["close"]
    final_capital = cash + holdings * fp
    return {"resumen": _summary(trades, initial, final_capital, candles),
            "curva_capital": curve, "operaciones": trades}


# ── Market Making ─────────────────────────────────────────────────────────────

def _market_making(candles: list, initial: float, params: dict) -> dict:
    spread_pct     = float(params.get("spread_pct", 0.5)) / 100
    order_size_pct = float(params.get("order_size_pct", 10)) / 100
    max_inv_pct    = float(params.get("max_inventory_pct", 30)) / 100
    half           = spread_pct / 2

    cash        = initial
    inventory   = 0.0
    avg_buy     = 0.0
    trades: list = []
    curve: list  = []
    start_price  = candles[0]["close"]

    for c in candles:
        o     = c.get("open",  c["close"])
        high  = c.get("high",  c["close"])
        low   = c.get("low",   c["close"])
        price = c["close"]
        date  = _date(c["timestamp"])

        bid = o * (1 - half)
        ask = o * (1 + half)
        order_cash = initial * order_size_pct
        max_inv    = initial * max_inv_pct / max(o, 1e-8)

        # Buy fill — precio intradiario baja al bid
        if low <= bid and cash >= order_cash and inventory < max_inv:
            base_qty   = order_cash / bid
            old_inv    = inventory
            inventory += base_qty
            cash      -= order_cash
            avg_buy    = (avg_buy * old_inv + bid * base_qty) / inventory
            trades.append({
                "fecha": date, "tipo": "compra",
                "precio": round(bid, 4), "cantidad": round(base_qty, 8),
                "importe": round(order_cash, 2), "pnl": None, "pnl_pct": None,
            })

        # Sell fill — precio intradiario sube al ask
        if high >= ask and inventory > 0:
            sell_qty  = min(order_cash / ask, inventory)
            val       = sell_qty * ask
            cost      = sell_qty * avg_buy if avg_buy > 0 else val
            pnl       = val - cost
            cash     += val
            inventory -= sell_qty
            if inventory <= 0:
                inventory = 0.0
                avg_buy   = 0.0
            trades.append({
                "fecha": date, "tipo": "venta",
                "precio": round(ask, 4), "cantidad": round(sell_qty, 8),
                "importe": round(val, 2),
                "pnl": round(pnl, 2),
                "pnl_pct": round(pnl / cost * 100, 2) if cost > 0 else 0,
            })

        curve.append({
            "fecha": date,
            "capital":  round(cash + inventory * price, 2),
            "buy_hold": round(initial / start_price * price, 2),
        })

    fp = candles[-1]["close"]
    return {"resumen": _summary(trades, initial, cash + inventory * fp, candles),
            "curva_capital": curve, "operaciones": trades}


# ── Arbitraje ──────────────────────────────────────────────────────────────────

def _arbitrage(candles: list, initial: float, params: dict) -> dict:
    min_spread  = float(params.get("min_spread_pct", 0.3)) / 100
    trade_amt   = float(params.get("amount_per_trade", initial * 0.1))

    cash        = initial
    trades: list = []
    curve: list  = []
    start_price  = candles[0]["close"]

    for c in candles:
        price = c["close"]
        high  = c.get("high",  price)
        low   = c.get("low",   price)
        date  = _date(c["timestamp"])

        daily_range = (high - low) / price if price > 0 else 0

        # Hay oportunidad si el rango del día supera 2× el spread mínimo
        if daily_range > 2 * min_spread and cash >= trade_amt:
            captured  = min(min_spread * 1.5, daily_range / 3)   # conservador
            profit    = trade_amt * captured
            cash     += profit
            trades.append({
                "fecha":   date, "tipo": "venta",
                "precio":  round(price, 4),
                "cantidad": round(trade_amt / price, 8),
                "importe": round(trade_amt, 2),
                "pnl":     round(profit, 4),
                "pnl_pct": round(captured * 100, 4),
                "motivo":  f"Spread {daily_range*100:.2f}% > umbral {min_spread*100:.2f}%",
            })

        curve.append({
            "fecha":    date,
            "capital":  round(cash, 2),
            "buy_hold": round(initial / start_price * price, 2),
        })

    return {"resumen": _summary(trades, initial, cash, candles),
            "curva_capital": curve, "operaciones": trades}


# ── Scalping ───────────────────────────────────────────────────────────────────

def _scalping(candles: list, initial: float, params: dict) -> dict:
    rsi_entry  = float(params.get("rsi_entry",  45))
    tp_pct     = float(params.get("take_profit_pct", 0.5)) / 100
    sl_pct     = float(params.get("stop_loss_pct",   0.3)) / 100
    trade_amt  = float(params.get("amount_per_trade", initial * 0.5))
    warmup     = 15

    cash        = initial
    holdings    = 0.0
    entry_price = 0.0
    trades: list = []
    curve: list  = []
    closes       = [c["close"] for c in candles]
    start_price  = candles[0]["close"]

    for i, c in enumerate(candles):
        price = c["close"]
        high  = c.get("high", price)
        low   = c.get("low",  price)
        date  = _date(c["timestamp"])

        if i >= warmup:
            slice_c     = closes[:i + 1]
            rsi         = compute_rsi(slice_c) or 50.0
            _, _, histo = compute_macd(slice_c)

            # ── Gestión de posición abierta ───────────────────────────────────
            if holdings > 0 and entry_price > 0:
                sl_price = entry_price * (1 - sl_pct)
                tp_price = entry_price * (1 + tp_pct)

                if low <= sl_price:
                    exit_p, motivo = sl_price, "Stop Loss"
                elif high >= tp_price:
                    exit_p, motivo = tp_price, "Take Profit"
                elif rsi > 70 or (histo is not None and histo < 0):
                    exit_p, motivo = price, "Señal girada"
                else:
                    exit_p, motivo = None, None

                if exit_p:
                    val  = holdings * exit_p
                    cost = holdings * entry_price
                    pnl  = val - cost
                    cash += val
                    trades.append({
                        "fecha": date, "tipo": "venta",
                        "precio": round(exit_p, 4), "cantidad": round(holdings, 8),
                        "importe": round(val, 2),
                        "pnl": round(pnl, 2), "pnl_pct": round(pnl / cost * 100, 2),
                        "rsi": round(rsi, 1), "motivo": motivo,
                    })
                    holdings = 0.0
                    entry_price = 0.0

            # ── Búsqueda de entrada ────────────────────────────────────────────
            elif holdings == 0 and rsi < rsi_entry and histo is not None and histo > 0 and cash >= trade_amt:
                q = trade_amt / price
                cash -= trade_amt
                holdings = q
                entry_price = price
                trades.append({
                    "fecha": date, "tipo": "compra",
                    "precio": round(price, 4), "cantidad": round(q, 8),
                    "importe": round(trade_amt, 2),
                    "pnl": None, "pnl_pct": None, "rsi": round(rsi, 1),
                })

        curve.append({
            "fecha":    date,
            "capital":  round(cash + holdings * price, 2),
            "buy_hold": round(initial / start_price * price, 2),
        })

    fp = candles[-1]["close"]
    return {"resumen": _summary(trades, initial, cash + holdings * fp, candles),
            "curva_capital": curve, "operaciones": trades}


# ── Mean Reversion ─────────────────────────────────────────────────────────────

def _mean_reversion(candles: list, initial: float, params: dict) -> dict:
    rsi_oversold = float(params.get("rsi_oversold", 35))
    rsi_confirm  = bool(params.get("rsi_confirm",  True))
    exit_at_mean = bool(params.get("exit_at_mean", True))
    sl_pct       = float(params.get("stop_loss_pct", 3.0)) / 100
    trade_amt    = float(params.get("amount_per_trade", initial * 0.5))
    warmup       = 20

    cash        = initial
    holdings    = 0.0
    entry_price = 0.0
    trades: list = []
    curve: list  = []
    closes       = [c["close"] for c in candles]
    start_price  = candles[0]["close"]

    for i, c in enumerate(candles):
        price = c["close"]
        date  = _date(c["timestamp"])

        if i >= warmup:
            slice_c             = closes[:i + 1]
            rsi                 = compute_rsi(slice_c) or 50.0
            bb_up, bb_mid, bb_low = compute_bollinger(slice_c)
            _, _, histo         = compute_macd(slice_c)

            # ── Gestión de posición abierta ───────────────────────────────────
            if holdings > 0 and entry_price > 0:
                sl_price    = entry_price * (1 - sl_pct)
                exit_p, motivo = None, None

                if price <= sl_price:
                    exit_p, motivo = price, "Stop Loss"
                elif exit_at_mean and bb_mid and price >= bb_mid:
                    exit_p, motivo = price, "Media recuperada"
                elif not exit_at_mean and bb_up and price >= bb_up:
                    exit_p, motivo = price, "Banda superior"
                elif rsi > 65:
                    exit_p, motivo = price, f"RSI sobrecomprado ({rsi:.0f})"

                if exit_p:
                    val  = holdings * exit_p
                    cost = holdings * entry_price
                    pnl  = val - cost
                    cash += val
                    trades.append({
                        "fecha": date, "tipo": "venta",
                        "precio": round(exit_p, 4), "cantidad": round(holdings, 8),
                        "importe": round(val, 2),
                        "pnl": round(pnl, 2), "pnl_pct": round(pnl / cost * 100, 2),
                        "rsi": round(rsi, 1), "motivo": motivo,
                    })
                    holdings = 0.0
                    entry_price = 0.0

            # ── Búsqueda de entrada ────────────────────────────────────────────
            elif holdings == 0 and bb_low is not None and price <= bb_low and cash >= trade_amt:
                rsi_ok = (not rsi_confirm) or (rsi < rsi_oversold)
                if rsi_ok:
                    q = trade_amt / price
                    cash -= trade_amt
                    holdings = q
                    entry_price = price
                    trades.append({
                        "fecha": date, "tipo": "compra",
                        "precio": round(price, 4), "cantidad": round(q, 8),
                        "importe": round(trade_amt, 2),
                        "pnl": None, "pnl_pct": None, "rsi": round(rsi, 1),
                    })

        curve.append({
            "fecha":    date,
            "capital":  round(cash + holdings * price, 2),
            "buy_hold": round(initial / start_price * price, 2),
        })

    fp = candles[-1]["close"]
    return {"resumen": _summary(trades, initial, cash + holdings * fp, candles),
            "curva_capital": curve, "operaciones": trades}


# ── Momentum ───────────────────────────────────────────────────────────────────

def _momentum(candles: list, initial: float, params: dict) -> dict:
    rsi_min    = float(params.get("rsi_min",   55))
    rsi_max    = float(params.get("rsi_max",   75))
    tp_pct     = float(params.get("take_profit_pct",   3.0)) / 100
    sl_pct     = float(params.get("stop_loss_pct",     2.0)) / 100
    trail_pct  = float(params.get("trailing_stop_pct", 1.5)) / 100
    trade_amt  = float(params.get("amount_per_trade", initial * 0.5))
    warmup     = 35

    cash        = initial
    holdings    = 0.0
    entry_price = 0.0
    peak_price  = 0.0
    trades: list = []
    curve: list  = []
    closes       = [c["close"] for c in candles]
    start_price  = candles[0]["close"]

    for i, c in enumerate(candles):
        price = c["close"]
        high  = c.get("high", price)
        date  = _date(c["timestamp"])

        if i >= warmup:
            slice_c             = closes[:i + 1]
            rsi                 = compute_rsi(slice_c) or 50.0
            _, _, histo         = compute_macd(slice_c)
            bb_up, bb_mid, _    = compute_bollinger(slice_c)

            # Actualizar precio pico
            if holdings > 0:
                peak_price = max(peak_price, high)

            # ── Gestión de posición abierta ───────────────────────────────────
            if holdings > 0 and entry_price > 0:
                tp_price    = entry_price * (1 + tp_pct)
                sl_price    = entry_price * (1 - sl_pct)
                trail_price = peak_price * (1 - trail_pct) if peak_price > 0 else sl_price

                exit_p, motivo = None, None

                if price >= tp_price:
                    exit_p, motivo = tp_price, "Take Profit"
                elif price <= trail_price:
                    exit_p, motivo = trail_price, "Trailing Stop"
                elif price <= sl_price:
                    exit_p, motivo = sl_price, "Stop Loss"
                elif rsi > rsi_max + 5:
                    exit_p, motivo = price, f"RSI sobrecomprado ({rsi:.0f})"
                elif histo is not None and histo < 0:
                    exit_p, motivo = price, "MACD bajista"

                if exit_p:
                    val  = holdings * exit_p
                    cost = holdings * entry_price
                    pnl  = val - cost
                    cash += val
                    trades.append({
                        "fecha": date, "tipo": "venta",
                        "precio": round(exit_p, 4), "cantidad": round(holdings, 8),
                        "importe": round(val, 2),
                        "pnl": round(pnl, 2), "pnl_pct": round(pnl / cost * 100, 2),
                        "rsi": round(rsi, 1), "motivo": motivo,
                    })
                    holdings = 0.0
                    entry_price = 0.0
                    peak_price  = 0.0

            # ── Búsqueda de entrada ────────────────────────────────────────────
            elif holdings == 0 and cash >= trade_amt:
                bb_ok = bb_mid is not None and price > bb_mid
                if rsi_min <= rsi <= rsi_max and histo is not None and histo > 0 and bb_ok:
                    q = trade_amt / price
                    cash -= trade_amt
                    holdings = q
                    entry_price = price
                    peak_price  = high
                    trades.append({
                        "fecha": date, "tipo": "compra",
                        "precio": round(price, 4), "cantidad": round(q, 8),
                        "importe": round(trade_amt, 2),
                        "pnl": None, "pnl_pct": None, "rsi": round(rsi, 1),
                    })

        curve.append({
            "fecha":    date,
            "capital":  round(cash + holdings * price, 2),
            "buy_hold": round(initial / start_price * price, 2),
        })

    fp = candles[-1]["close"]
    return {"resumen": _summary(trades, initial, cash + holdings * fp, candles),
            "curva_capital": curve, "operaciones": trades}


# ── API pública ────────────────────────────────────────────────────────────────

async def run_backtest(exchange: str, symbol: str, strategy: str,
                       period: str, initial_capital: float, params: dict) -> dict:
    limit   = PERIOD_LIMITS.get(period, 90)
    candles = await fetch_ohlcv(exchange, symbol, "1d", limit)

    if len(candles) < 10:
        raise ValueError("Datos históricos insuficientes para este par/periodo.")

    fn = {
        "dca":           _dca,
        "grid":          _grid,
        "signal":        _signal,
        "ia_dynamic":    _ia_dynamic,
        "market_making": _market_making,
        "arbitrage":     _arbitrage,
        "scalping":      _scalping,
        "mean_reversion": _mean_reversion,
        "momentum":      _momentum,
    }.get(strategy)
    if not fn:
        raise ValueError(f"Estrategia desconocida: {strategy}")

    result = fn(candles, initial_capital, params)
    result["exchange"] = exchange
    result["symbol"]   = symbol
    result["strategy"] = strategy
    result["period"]   = period
    return result
