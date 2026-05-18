"""Tipo de cambio EUR/USD en tiempo real desde Kraken."""
import time
from app.services.exchange_service import fetch_ticker

_cache: dict = {}
_CACHE_TTL = 300  # 5 minutos


async def get_eurusd_rate() -> float:
    """Devuelve el precio de 1 EUR en USD (ej: 1.09)."""
    now = time.time()
    if _cache.get("ts") and now - _cache["ts"] < _CACHE_TTL:
        return _cache["rate"]

    # Método 1: par EUR/USD directo en Kraken
    try:
        ticker = await fetch_ticker("kraken", "EUR/USD")
        rate = float(ticker["last"])
        if 0.5 < rate < 2.0:
            _cache.update({"rate": rate, "ts": now})
            return rate
    except Exception:
        pass

    # Método 2: derivar de BTC/EUR y BTC/USDT
    try:
        btc_usd = await fetch_ticker("binance", "BTC/USDT")
        btc_eur = await fetch_ticker("kraken",  "BTC/EUR")
        rate = float(btc_usd["last"]) / float(btc_eur["last"])
        if 0.5 < rate < 2.0:
            _cache.update({"rate": rate, "ts": now})
            return rate
    except Exception:
        pass

    return _cache.get("rate", 1.09)  # fallback
