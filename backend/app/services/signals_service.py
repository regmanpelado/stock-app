from app.services.exchange_service import fetch_ohlcv

EXCHANGE_SYMBOLS = {
    "binance": ["BTC/USDT", "ETH/USDT", "BNB/USDT", "SOL/USDT", "XRP/USDT",
                "ADA/USDT", "DOGE/USDT", "AVAX/USDT", "DOT/USDT", "LINK/USDT"],
    "coinbase": ["BTC/USD", "ETH/USD", "SOL/USD", "XRP/USD", "ADA/USD",
                 "AVAX/USD", "DOGE/USD", "LINK/USD"],
    "kraken": ["BTC/USD", "ETH/USD", "SOL/USD", "XRP/USD", "ADA/USD",
               "AVAX/USD", "DOT/USD", "LINK/USD"],
    "gateio": ["BTC/USDT", "ETH/USDT", "SOL/USDT", "XRP/USDT", "ADA/USDT",
               "DOGE/USDT", "AVAX/USDT", "LINK/USDT"],
}


# ── Indicadores ────────────────────────────────────────────────────────────────

def _ema(values: list[float], period: int) -> list[float]:
    if len(values) < period:
        return []
    k = 2 / (period + 1)
    result = [sum(values[:period]) / period]
    for v in values[period:]:
        result.append(v * k + result[-1] * (1 - k))
    return result


def compute_rsi(closes: list[float], period: int = 14) -> float | None:
    if len(closes) < period + 1:
        return None
    deltas = [closes[i] - closes[i - 1] for i in range(1, len(closes))]
    gains = [max(d, 0.0) for d in deltas]
    losses = [max(-d, 0.0) for d in deltas]
    avg_g = sum(gains[:period]) / period
    avg_l = sum(losses[:period]) / period
    for i in range(period, len(gains)):
        avg_g = (avg_g * (period - 1) + gains[i]) / period
        avg_l = (avg_l * (period - 1) + losses[i]) / period
    if avg_l == 0:
        return 100.0
    rs = avg_g / avg_l
    return round(100 - (100 / (1 + rs)), 2)


def compute_macd(closes: list[float], fast: int = 12, slow: int = 26, signal: int = 9):
    if len(closes) < slow + signal:
        return None, None, None
    ema_fast = _ema(closes, fast)
    ema_slow = _ema(closes, slow)
    offset = slow - fast
    macd_line = [ema_fast[i + offset] - ema_slow[i] for i in range(len(ema_slow))]
    if len(macd_line) < signal:
        return None, None, None
    sig_line = _ema(macd_line, signal)
    last_macd = macd_line[-1]
    last_sig = sig_line[-1]
    return round(last_macd, 8), round(last_sig, 8), round(last_macd - last_sig, 8)


def compute_bollinger(closes: list[float], period: int = 20, num_std: float = 2.0):
    if len(closes) < period:
        return None, None, None
    recent = closes[-period:]
    sma = sum(recent) / period
    std = (sum((x - sma) ** 2 for x in recent) / period) ** 0.5
    return round(sma + num_std * std, 8), round(sma, 8), round(sma - num_std * std, 8)


# ── Señales por indicador ──────────────────────────────────────────────────────

def _rsi_signal(rsi: float | None) -> str:
    if rsi is None:
        return "neutral"
    if rsi <= 30:
        return "buy"
    if rsi >= 70:
        return "sell"
    return "neutral"


def _macd_signal(histogram: float | None) -> str:
    if histogram is None:
        return "neutral"
    if histogram > 0:
        return "buy"
    if histogram < 0:
        return "sell"
    return "neutral"


def _bb_signal(price: float | None, upper: float | None, lower: float | None) -> str:
    if None in (price, upper, lower):
        return "neutral"
    if price <= lower:
        return "buy"
    if price >= upper:
        return "sell"
    return "neutral"


def _overall(signals: list[str]) -> str:
    buy = signals.count("buy")
    sell = signals.count("sell")
    if buy >= 2:
        return "buy"
    if sell >= 2:
        return "sell"
    return "neutral"


# ── Alertas ────────────────────────────────────────────────────────────────────

def _build_alerts(symbol: str, exchange: str, rsi, histogram, price, upper, lower) -> list[dict]:
    alerts = []
    if rsi is not None:
        if rsi <= 25:
            alerts.append({"type": "danger", "message": f"{symbol} ({exchange}): RSI extremadamente sobrevendido ({rsi:.1f})"})
        elif rsi <= 30:
            alerts.append({"type": "warning", "message": f"{symbol} ({exchange}): RSI sobrevendido ({rsi:.1f}) — posible rebote"})
        elif rsi >= 75:
            alerts.append({"type": "danger", "message": f"{symbol} ({exchange}): RSI extremadamente sobrecomprado ({rsi:.1f})"})
        elif rsi >= 70:
            alerts.append({"type": "warning", "message": f"{symbol} ({exchange}): RSI sobrecomprado ({rsi:.1f}) — posible corrección"})
    if None not in (price, upper, lower):
        if price <= lower:
            alerts.append({"type": "buy", "message": f"{symbol} ({exchange}): Precio bajo la banda inferior de Bollinger — señal de compra"})
        elif price >= upper:
            alerts.append({"type": "sell", "message": f"{symbol} ({exchange}): Precio sobre la banda superior de Bollinger — señal de venta"})
    if histogram is not None and abs(histogram) > 0:
        cross = "cruce alcista MACD" if histogram > 0 else "cruce bajista MACD"
        alerts.append({"type": "info", "message": f"{symbol} ({exchange}): {cross}"})
    return alerts


# ── Cómputo principal ──────────────────────────────────────────────────────────

async def analyze_symbol(exchange_name: str, symbol: str, timeframe: str = "1h", limit: int = 120) -> dict:
    try:
        candles = await fetch_ohlcv(exchange_name, symbol, timeframe, limit)
        closes = [c["close"] for c in candles]
        rsi_history = [c["timestamp"] for c in candles[-50:]]
        close_history = closes[-50:]
        price = closes[-1] if closes else None

        rsi = compute_rsi(closes)
        macd_val, sig_val, histogram = compute_macd(closes)
        bb_upper, bb_mid, bb_lower = compute_bollinger(closes)

        rsi_sig = _rsi_signal(rsi)
        macd_sig = _macd_signal(histogram)
        bb_sig = _bb_signal(price, bb_upper, bb_lower)
        overall = _overall([rsi_sig, macd_sig, bb_sig])

        alerts = _build_alerts(symbol, exchange_name, rsi, histogram, price, bb_upper, bb_lower)

        return {
            "symbol": symbol,
            "exchange": exchange_name,
            "price": price,
            "signal": overall,
            "timeframe": timeframe,
            "indicators": {
                "rsi": {
                    "value": rsi,
                    "signal": rsi_sig,
                    "overbought": rsi is not None and rsi >= 70,
                    "oversold": rsi is not None and rsi <= 30,
                },
                "macd": {
                    "macd": macd_val,
                    "signal_line": sig_val,
                    "histogram": histogram,
                    "signal": macd_sig,
                },
                "bollinger": {
                    "upper": bb_upper,
                    "middle": bb_mid,
                    "lower": bb_lower,
                    "price": price,
                    "signal": bb_sig,
                    "pct_b": round((price - bb_lower) / (bb_upper - bb_lower) * 100, 1)
                    if None not in (price, bb_upper, bb_lower) and bb_upper != bb_lower else None,
                },
            },
            "history": [
                {"timestamp": rsi_history[i], "close": close_history[i]}
                for i in range(len(rsi_history))
            ],
            "alerts": alerts,
        }
    except Exception as e:
        return {
            "symbol": symbol,
            "exchange": exchange_name,
            "price": None,
            "signal": "error",
            "timeframe": timeframe,
            "indicators": {},
            "history": [],
            "alerts": [],
            "error": str(e),
        }


async def get_screener(exchange_name: str, timeframe: str = "1h") -> list[dict]:
    symbols = EXCHANGE_SYMBOLS.get(exchange_name, [])
    results = []
    for symbol in symbols:
        result = await analyze_symbol(exchange_name, symbol, timeframe)
        results.append(result)
    return results


async def get_all_alerts(timeframe: str = "1h") -> list[dict]:
    all_alerts = []
    for exchange_name, symbols in EXCHANGE_SYMBOLS.items():
        for symbol in symbols[:4]:  # primeros 4 por exchange para no saturar
            result = await analyze_symbol(exchange_name, symbol, timeframe, limit=60)
            all_alerts.extend(result.get("alerts", []))
    return all_alerts
