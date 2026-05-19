"""Tipo de cambio EUR/USD en tiempo real desde yfinance."""
import time

_cache: dict = {}
_CACHE_TTL = 300  # 5 minutos


async def get_eurusd_rate() -> float:
    """Devuelve el precio de 1 EUR en USD (ej: 1.09)."""
    import asyncio
    now = time.time()
    if _cache.get("ts") and now - _cache["ts"] < _CACHE_TTL:
        return _cache["rate"]

    try:
        loop = asyncio.get_event_loop()

        def _fetch():
            import yfinance as yf
            info = yf.Ticker("EURUSD=X").fast_info
            return float(info.last_price or 0)

        rate = await loop.run_in_executor(None, _fetch)
        if 0.5 < rate < 2.0:
            _cache.update({"rate": rate, "ts": now})
            return rate
    except Exception:
        pass

    return _cache.get("rate", 1.09)  # fallback
