"""Servicio de datos de mercado para bolsas globales usando yfinance."""
import asyncio
import yfinance as yf

# ── Bolsas con sufijos yfinance ───────────────────────────────────────────────
EXCHANGES = {
    "NYSE":     {"name": "New York Stock Exchange", "suffix": "",    "currency": "USD", "tz": "America/New_York"},
    "NASDAQ":   {"name": "NASDAQ",                  "suffix": "",    "currency": "USD", "tz": "America/New_York"},
    "BME":      {"name": "Bolsa de Madrid",          "suffix": ".MC", "currency": "EUR", "tz": "Europe/Madrid"},
    "LSE":      {"name": "London Stock Exchange",    "suffix": ".L",  "currency": "GBP", "tz": "Europe/London"},
    "EURONEXT": {"name": "Euronext (París)",          "suffix": ".PA", "currency": "EUR", "tz": "Europe/Paris"},
    "XETRA":    {"name": "Frankfurt (Xetra)",         "suffix": ".DE", "currency": "EUR", "tz": "Europe/Berlin"},
    "TSE":      {"name": "Tokyo Stock Exchange",      "suffix": ".T",  "currency": "JPY", "tz": "Asia/Tokyo"},
    "HKEX":     {"name": "Hong Kong Exchange",        "suffix": ".HK", "currency": "HKD", "tz": "Asia/Hong_Kong"},
}

# ── Índices mundiales ─────────────────────────────────────────────────────────
INDICES = {
    "^GSPC":  {"name": "S&P 500",         "region": "USA"},
    "^IXIC":  {"name": "NASDAQ Composite","region": "USA"},
    "^DJI":   {"name": "Dow Jones",       "region": "USA"},
    "^IBEX":  {"name": "IBEX 35",         "region": "España"},
    "^FTSE":  {"name": "FTSE 100",        "region": "UK"},
    "^GDAXI": {"name": "DAX",             "region": "Alemania"},
    "^FCHI":  {"name": "CAC 40",          "region": "Francia"},
    "^N225":  {"name": "Nikkei 225",      "region": "Japón"},
    "^HSI":   {"name": "Hang Seng",       "region": "Hong Kong"},
}

# ── Divisas y materias primas ─────────────────────────────────────────────────
CURRENCIES = {
    "EURUSD=X": {"name": "EUR/USD", "type": "forex"},
    "GBPUSD=X": {"name": "GBP/USD", "type": "forex"},
    "USDJPY=X": {"name": "USD/JPY", "type": "forex"},
    "USDCHF=X": {"name": "USD/CHF", "type": "forex"},
    "GC=F":     {"name": "Oro (USD/oz)",  "type": "commodity"},
    "CL=F":     {"name": "Petróleo WTI",  "type": "commodity"},
    "SI=F":     {"name": "Plata (USD/oz)", "type": "commodity"},
}

# ── Acciones populares por bolsa ──────────────────────────────────────────────
POPULAR = {
    "NYSE":     ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "BRK-B", "JPM", "V"],
    "NASDAQ":   ["AAPL", "MSFT", "NVDA", "AMZN", "META", "TSLA", "AVGO", "COST", "NFLX", "AMD"],
    "BME":      ["ITX.MC", "SAN.MC", "BBVA.MC", "IBE.MC", "REP.MC", "TEF.MC", "AMS.MC", "CABK.MC", "BKT.MC", "ENG.MC"],
    "LSE":      ["SHEL.L", "AZN.L", "HSBA.L", "ULVR.L", "BP.L", "RIO.L", "GSK.L", "VOD.L", "LLOY.L", "BARC.L"],
    "EURONEXT": ["MC.PA", "TTE.PA", "SAN.PA", "AI.PA", "OR.PA", "BNP.PA", "DG.PA", "AIR.PA", "SU.PA", "RI.PA"],
    "XETRA":    ["SAP.DE", "SIE.DE", "ALV.DE", "MRK.DE", "BMW.DE", "BAYN.DE", "DB1.DE", "MBG.DE", "DHL.DE", "EOAN.DE"],
    "TSE":      ["7203.T", "6758.T", "9432.T", "6861.T", "8306.T", "9984.T", "6954.T", "7974.T", "4063.T", "6367.T"],
    "HKEX":     ["0700.HK", "0941.HK", "9988.HK", "0005.HK", "0883.HK", "2318.HK", "1299.HK", "0388.HK", "3690.HK", "9618.HK"],
}

# ── ETFs por sector (USA) ─────────────────────────────────────────────────────
SECTORS = {
    "Tecnología":        "XLK",
    "Salud":             "XLV",
    "Financiero":        "XLF",
    "Consumo discrecional": "XLY",
    "Consumo básico":    "XLP",
    "Energía":           "XLE",
    "Industriales":      "XLI",
    "Materiales":        "XLB",
    "Utilities":         "XLU",
    "Inmobiliario":      "XLRE",
    "Comunicaciones":    "XLC",
}


def _full_symbol(symbol: str, exchange: str) -> str:
    suffix = EXCHANGES.get(exchange, {}).get("suffix", "")
    if suffix and not symbol.upper().endswith(suffix.upper()):
        return symbol + suffix
    return symbol


def _safe_float(val, default=0.0) -> float:
    try:
        v = float(val)
        return v if v == v else default  # NaN check
    except Exception:
        return default


async def get_quote(symbol: str, exchange: str = "NYSE") -> dict:
    """Precio actual de una acción."""
    full = _full_symbol(symbol, exchange)
    loop = asyncio.get_event_loop()

    def _fetch():
        t = yf.Ticker(full)
        info = t.fast_info
        prev = _safe_float(info.previous_close)
        last = _safe_float(info.last_price)
        change = round((last - prev) / prev * 100, 2) if prev else 0.0
        return {
            "symbol":      symbol.upper(),
            "full_symbol": full,
            "exchange":    exchange,
            "name":        getattr(info, "name", symbol),
            "price":       round(last, 4),
            "prev_close":  round(prev, 4),
            "change":      round(last - prev, 4),
            "change_pct":  change,
            "volume":      int(_safe_float(info.three_month_average_volume, 0)),
            "market_cap":  int(_safe_float(getattr(info, "market_cap", 0), 0)),
            "currency":    EXCHANGES.get(exchange, {}).get("currency", "USD"),
        }

    return await loop.run_in_executor(None, _fetch)


async def get_history(symbol: str, exchange: str = "NYSE",
                      period: str = "6mo", interval: str = "1d") -> list[dict]:
    """Historial OHLCV."""
    full = _full_symbol(symbol, exchange)
    loop = asyncio.get_event_loop()

    def _fetch():
        hist = yf.Ticker(full).history(period=period, interval=interval)
        return [
            {
                "timestamp": str(idx)[:10] if interval == "1d" else str(idx),
                "open":   round(_safe_float(row.Open),  4),
                "high":   round(_safe_float(row.High),  4),
                "low":    round(_safe_float(row.Low),   4),
                "close":  round(_safe_float(row.Close), 4),
                "volume": int(_safe_float(row.Volume, 0)),
            }
            for idx, row in hist.iterrows()
        ]

    return await loop.run_in_executor(None, _fetch)


async def get_indices() -> list[dict]:
    """Valores actuales de los principales índices mundiales."""
    loop = asyncio.get_event_loop()

    def _fetch():
        result = []
        for ticker, meta in INDICES.items():
            try:
                info = yf.Ticker(ticker).fast_info
                prev = _safe_float(info.previous_close)
                last = _safe_float(info.last_price)
                result.append({
                    "ticker":     ticker,
                    "name":       meta["name"],
                    "region":     meta["region"],
                    "price":      round(last, 2),
                    "change_pct": round((last - prev) / prev * 100, 2) if prev else 0.0,
                    "change":     round(last - prev, 2),
                })
            except Exception:
                pass
        return result

    return await loop.run_in_executor(None, _fetch)


async def get_currencies() -> list[dict]:
    """Divisas y materias primas."""
    loop = asyncio.get_event_loop()

    def _fetch():
        result = []
        for ticker, meta in CURRENCIES.items():
            try:
                info = yf.Ticker(ticker).fast_info
                prev = _safe_float(info.previous_close)
                last = _safe_float(info.last_price)
                result.append({
                    "ticker":     ticker,
                    "name":       meta["name"],
                    "type":       meta["type"],
                    "price":      round(last, 4),
                    "change_pct": round((last - prev) / prev * 100, 2) if prev else 0.0,
                })
            except Exception:
                pass
        return result

    return await loop.run_in_executor(None, _fetch)


async def get_sectors() -> list[dict]:
    """Rendimiento de sectores del S&P500 usando ETFs."""
    loop = asyncio.get_event_loop()

    def _fetch():
        result = []
        for name, etf in SECTORS.items():
            try:
                info = yf.Ticker(etf).fast_info
                prev = _safe_float(info.previous_close)
                last = _safe_float(info.last_price)
                result.append({
                    "sector":     name,
                    "etf":        etf,
                    "price":      round(last, 2),
                    "change_pct": round((last - prev) / prev * 100, 2) if prev else 0.0,
                })
            except Exception:
                pass
        return sorted(result, key=lambda x: x["change_pct"], reverse=True)

    return await loop.run_in_executor(None, _fetch)


async def get_popular(exchange: str) -> list[dict]:
    """Acciones populares de una bolsa con precios actuales."""
    symbols = POPULAR.get(exchange.upper(), POPULAR["NYSE"])
    loop = asyncio.get_event_loop()

    def _fetch():
        result = []
        for sym in symbols:
            try:
                info = yf.Ticker(sym).fast_info
                prev = _safe_float(info.previous_close)
                last = _safe_float(info.last_price)
                result.append({
                    "symbol":     sym,
                    "price":      round(last, 4),
                    "change_pct": round((last - prev) / prev * 100, 2) if prev else 0.0,
                    "volume":     int(_safe_float(info.three_month_average_volume, 0)),
                })
            except Exception:
                result.append({"symbol": sym, "price": 0, "change_pct": 0, "volume": 0})
        return result

    return await loop.run_in_executor(None, _fetch)


async def search_stocks(query: str) -> list[dict]:
    """Busca acciones por símbolo o nombre usando yfinance directamente."""
    loop = asyncio.get_event_loop()
    q = query.upper().strip()

    def _fetch():
        results = []
        # Intenta el símbolo exacto y variantes comunes
        candidates = [q]
        for suffix in [".MC", ".L", ".PA", ".DE", ".T", ".HK"]:
            if not q.endswith(suffix):
                candidates.append(q + suffix)

        for sym in candidates[:5]:
            try:
                t = yf.Ticker(sym)
                info = t.fast_info
                last = _safe_float(info.last_price)
                if last > 0:
                    # Detecta bolsa por sufijo
                    exchange = "NYSE"
                    for exc, meta in EXCHANGES.items():
                        if meta["suffix"] and sym.endswith(meta["suffix"]):
                            exchange = exc
                            break
                    results.append({
                        "symbol":   sym,
                        "name":     sym,
                        "exchange": exchange,
                        "price":    round(last, 4),
                        "currency": EXCHANGES.get(exchange, {}).get("currency", "USD"),
                    })
            except Exception:
                pass
        return results

    return await loop.run_in_executor(None, _fetch)
