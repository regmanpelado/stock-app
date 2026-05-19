"""Señales técnicas para acciones usando yfinance + numpy."""
import asyncio
from app.services.market_service import _full_symbol, _safe_float, POPULAR


def _rsi(closes: list, period: int = 14) -> float:
    import numpy as np
    if len(closes) < period + 1:
        return 50.0
    deltas = np.diff(closes)
    gains  = np.where(deltas > 0, deltas, 0.0)
    losses = np.where(deltas < 0, -deltas, 0.0)
    avg_gain = np.mean(gains[-period:])
    avg_loss = np.mean(losses[-period:])
    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return round(100 - (100 / (1 + rs)), 2)


def _ema(data, span: int):
    k = 2 / (span + 1)
    result = [data[0]]
    for v in data[1:]:
        result.append(v * k + result[-1] * (1 - k))
    import numpy as np
    return np.array(result)


def _macd(closes: list) -> dict:
    import numpy as np
    if len(closes) < 26:
        return {"macd": 0.0, "signal": 0.0, "histogram": 0.0}
    arr     = np.array(closes, dtype=float)
    macd_arr = _ema(arr, 12) - _ema(arr, 26)
    sig_arr  = _ema(macd_arr, 9)
    return {
        "macd":      round(float(macd_arr[-1]), 4),
        "signal":    round(float(sig_arr[-1]),  4),
        "histogram": round(float(macd_arr[-1] - sig_arr[-1]), 4),
    }


def _sma(closes: list, period: int) -> float:
    import numpy as np
    if len(closes) < period:
        return round(float(closes[-1]), 4) if closes else 0.0
    return round(float(np.mean(closes[-period:])), 4)


def _signal_for_symbol(symbol: str, exchange: str = "NYSE") -> dict:
    import yfinance as yf
    full = _full_symbol(symbol, exchange)
    hist = yf.Ticker(full).history(period="6mo", interval="1d")

    if hist.empty or len(hist) < 20:
        return {"symbol": symbol, "exchange": exchange, "error": "Sin datos suficientes"}

    closes = hist["Close"].tolist()
    last   = closes[-1]
    rsi    = _rsi(closes)
    macd   = _macd(closes)
    sma20  = _sma(closes, 20)
    sma50  = _sma(closes, 50)
    sma200 = _sma(closes, 200)

    bull, bear = 0, 0
    if rsi < 40:            bull += 1
    if rsi > 60:            bear += 1
    if macd["histogram"] > 0: bull += 1
    if macd["histogram"] < 0: bear += 1
    if last > sma20:        bull += 1
    if last < sma20:        bear += 1
    if sma20 > sma50:       bull += 1
    if sma20 < sma50:       bear += 1

    signal = "BUY" if bull >= 3 else ("SELL" if bear >= 3 else "NEUTRAL")

    info = yf.Ticker(full).fast_info  # yf already imported above
    prev = _safe_float(info.previous_close)
    change_pct = round((last - prev) / prev * 100, 2) if prev else 0.0

    return {
        "symbol":       symbol,
        "exchange":     exchange,
        "price":        round(float(last), 4),
        "change_pct":   change_pct,
        "signal":       signal,
        "rsi":          rsi,
        "macd":         macd,
        "sma20":        sma20,
        "sma50":        sma50,
        "sma200":       sma200,
        "above_sma20":  last > sma20,
        "above_sma50":  last > sma50,
        "above_sma200": last > sma200,
    }


async def get_signals_for_symbol(symbol: str, exchange: str = "NYSE") -> dict:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(
        None, lambda: _signal_for_symbol(symbol, exchange)
    )


async def get_screener(exchange: str, limit: int = 10) -> list[dict]:
    """Screener técnico para las acciones populares de una bolsa."""
    symbols = POPULAR.get(exchange.upper(), POPULAR["NYSE"])[:limit]
    loop    = asyncio.get_event_loop()

    def _scan():
        out = []
        for sym in symbols:
            try:
                out.append(_signal_for_symbol(sym, exchange))
            except Exception as e:
                out.append({"symbol": sym, "exchange": exchange, "error": str(e)})
        return out

    results = await loop.run_in_executor(None, _scan)
    valid   = [r for r in results if "error" not in r]
    return sorted(valid, key=lambda x: abs(x.get("rsi", 50) - 50), reverse=True)
