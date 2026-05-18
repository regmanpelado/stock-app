"""Servicio de datos de mercado para bolsas globales usando yfinance + Twelve Data."""
import asyncio
import httpx
import yfinance as yf
from app.config import get_settings

# Bolsas soportadas con sus sufijos de yfinance
EXCHANGES = {
    "NYSE":     {"name": "New York Stock Exchange",   "suffix": "",       "currency": "USD", "tz": "America/New_York"},
    "NASDAQ":   {"name": "NASDAQ",                    "suffix": "",       "currency": "USD", "tz": "America/New_York"},
    "LSE":      {"name": "London Stock Exchange",     "suffix": ".L",     "currency": "GBP", "tz": "Europe/London"},
    "EURONEXT": {"name": "Euronext (París)",           "suffix": ".PA",    "currency": "EUR", "tz": "Europe/Paris"},
    "XETRA":    {"name": "Frankfurt (Xetra)",          "suffix": ".DE",    "currency": "EUR", "tz": "Europe/Berlin"},
    "TSE":      {"name": "Tokyo Stock Exchange",       "suffix": ".T",     "currency": "JPY", "tz": "Asia/Tokyo"},
    "HKEX":     {"name": "Hong Kong Exchange",         "suffix": ".HK",    "currency": "HKD", "tz": "Asia/Hong_Kong"},
    "BSE":      {"name": "Bombay Stock Exchange",      "suffix": ".BO",    "currency": "INR", "tz": "Asia/Kolkata"},
    "BME":      {"name": "Bolsa de Madrid",            "suffix": ".MC",    "currency": "EUR", "tz": "Europe/Madrid"},
}

# Índices de referencia
INDICES = {
    "^GSPC":  "S&P 500",
    "^IXIC":  "NASDAQ Composite",
    "^DJI":   "Dow Jones",
    "^FTSE":  "FTSE 100",
    "^GDAXI": "DAX",
    "^FCHI":  "CAC 40",
    "^N225":  "Nikkei 225",
    "^HSI":   "Hang Seng",
}


def _ticker(symbol: str, exchange: str) -> str:
    """Construye el símbolo completo para yfinance."""
    suffix = EXCHANGES.get(exchange, {}).get("suffix", "")
    if suffix and not symbol.endswith(suffix):
        return symbol + suffix
    return symbol


async def get_quote(symbol: str, exchange: str = "NYSE") -> dict:
    """Precio actual de una acción."""
    full = _ticker(symbol, exchange)
    loop = asyncio.get_event_loop()
    data = await loop.run_in_executor(None, lambda: yf.Ticker(full).fast_info)
    return {
        "symbol":   symbol,
        "exchange": exchange,
        "price":    round(float(data.last_price or 0), 4),
        "prev_close": round(float(data.previous_close or 0), 4),
        "change_pct": round(
            ((data.last_price - data.previous_close) / data.previous_close * 100)
            if data.previous_close else 0, 2
        ),
        "currency": EXCHANGES.get(exchange, {}).get("currency", "USD"),
    }


async def get_history(symbol: str, exchange: str = "NYSE",
                      period: str = "1mo", interval: str = "1d") -> list[dict]:
    """Historial OHLCV de una acción."""
    full = _ticker(symbol, exchange)
    loop = asyncio.get_event_loop()

    def _fetch():
        hist = yf.Ticker(full).history(period=period, interval=interval)
        return [
            {
                "timestamp": str(idx),
                "open":  round(float(row.Open),  4),
                "high":  round(float(row.High),  4),
                "low":   round(float(row.Low),   4),
                "close": round(float(row.Close), 4),
                "volume": int(row.Volume),
            }
            for idx, row in hist.iterrows()
        ]

    return await loop.run_in_executor(None, _fetch)


async def get_indices() -> dict:
    """Valores actuales de los principales índices."""
    loop = asyncio.get_event_loop()

    def _fetch():
        result = {}
        for ticker, name in INDICES.items():
            try:
                info = yf.Ticker(ticker).fast_info
                prev = float(info.previous_close or 0)
                last = float(info.last_price or 0)
                result[ticker] = {
                    "name":       name,
                    "price":      round(last, 2),
                    "change_pct": round((last - prev) / prev * 100 if prev else 0, 2),
                }
            except Exception:
                pass
        return result

    return await loop.run_in_executor(None, _fetch)


async def search_stocks(query: str, exchange: str = "NYSE") -> list[dict]:
    """Busca acciones por nombre o símbolo usando Twelve Data."""
    settings = get_settings()
    if not settings.twelve_data_api_key:
        # Fallback sin API key: resultados estáticos
        return [{"symbol": query.upper(), "name": query.upper(), "exchange": exchange}]
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(
                "https://api.twelvedata.com/symbol_search",
                params={"symbol": query, "apikey": settings.twelve_data_api_key},
            )
            data = r.json().get("data", [])
            return [
                {"symbol": d["symbol"], "name": d["instrument_name"],
                 "exchange": d.get("exchange", exchange)}
                for d in data[:10]
            ]
    except Exception:
        return []
