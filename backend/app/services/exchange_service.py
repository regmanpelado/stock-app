import ccxt
from typing import Optional
from app.config import get_settings

settings = get_settings()

EXCHANGE_CONFIG = {
    "binance": {
        "class": ccxt.binance,
        "apiKey": settings.binance_api_key,
        "secret": settings.binance_secret_key,
    },
    "coinbase": {
        "class": ccxt.coinbase,
        "apiKey": settings.coinbase_api_key,
        # coinbase_pem_secret convierte los \n literales del .env a saltos de línea reales
        "secret": settings.coinbase_pem_secret,
    },
    "kraken": {
        "class": ccxt.kraken,
        "apiKey": settings.kraken_api_key,
        "secret": settings.kraken_secret_key,
    },
    "gateio": {
        "class": ccxt.gateio,
        "apiKey": settings.gate_api_key,
        "secret": settings.gate_secret_key,
    },
}

_instances: dict[str, ccxt.Exchange] = {}


def get_exchange(name: str) -> ccxt.Exchange:
    if name not in EXCHANGE_CONFIG:
        raise ValueError(f"Exchange '{name}' not supported.")
    if name not in _instances:
        cfg = EXCHANGE_CONFIG[name]
        _instances[name] = cfg["class"](
            {"apiKey": cfg["apiKey"], "secret": cfg["secret"], "enableRateLimit": True}
        )
    return _instances[name]


def get_exchange_with_credentials(name: str, api_key: str, api_secret: str) -> ccxt.Exchange:
    """Instancia de exchange con credenciales específicas del usuario (no cacheada)."""
    if name not in EXCHANGE_CONFIG:
        raise ValueError(f"Exchange '{name}' not supported.")
    return EXCHANGE_CONFIG[name]["class"](
        {"apiKey": api_key, "secret": api_secret, "enableRateLimit": True}
    )


def list_exchanges() -> list[str]:
    return list(EXCHANGE_CONFIG.keys())


async def fetch_ticker(exchange_name: str, symbol: str) -> dict:
    exchange = get_exchange(exchange_name)
    ticker = exchange.fetch_ticker(symbol)
    ticker["exchange"] = exchange_name
    return ticker


async def fetch_tickers(exchange_name: str, symbols: Optional[list[str]] = None) -> list[dict]:
    exchange = get_exchange(exchange_name)
    if symbols:
        tickers = [exchange.fetch_ticker(s) for s in symbols]
    else:
        raw = exchange.fetch_tickers()
        tickers = list(raw.values())[:50]
    for t in tickers:
        t["exchange"] = exchange_name
    return tickers


async def fetch_balance(exchange_name: str, user_id: str | None = None) -> list[dict]:
    from app.services.currency_service import get_eurusd_rate

    if user_id:
        from app.services.exchange_key_service import get_credentials
        creds = get_credentials(user_id, exchange_name)
        if not creds:
            raise ValueError(
                f"No tienes API keys configuradas para {exchange_name}. "
                "Ve a 'Mis Exchanges' para añadirlas."
            )
        exchange = get_exchange_with_credentials(exchange_name, creds[0], creds[1])
    else:
        exchange = get_exchange(exchange_name)
    raw         = exchange.fetch_balance()
    eur_usd     = await get_eurusd_rate()   # cuántos USD vale 1 EUR (ej: 1.18)

    EUR_CURRENCIES = {"EUR", "ZEUR", "EURT"}
    USD_CURRENCIES = {"USD", "USDT", "BUSD", "ZUSD", "USDC", "USDP"}

    balances = []
    for currency, total in raw["total"].items():
        if not total or total <= 0:
            continue

        value_eur: float | None = None

        if currency in EUR_CURRENCIES:
            value_eur = total
        elif currency in USD_CURRENCIES:
            value_eur = total / eur_usd
        else:
            # Para cripto: intenta EUR directo, luego USDT/USD con conversión
            for quote, divisor in [("EUR", 1.0), ("USDT", eur_usd), ("USD", eur_usd)]:
                try:
                    ticker = exchange.fetch_ticker(f"{currency}/{quote}")
                    price  = float(ticker["last"])
                    if price > 0:
                        value_eur = total * price / divisor
                        break
                except Exception:
                    continue

        balances.append({
            "currency":  currency,
            "free":      raw["free"].get(currency, 0) or 0,
            "used":      raw["used"].get(currency, 0) or 0,
            "total":     total,
            "value_eur": round(value_eur, 4) if value_eur is not None else None,
            "exchange":  exchange_name,
        })
    return balances


async def create_order(
    exchange_name: str,
    symbol: str,
    side: str,
    order_type: str,
    amount: float,
    price: Optional[float] = None,
) -> dict:
    exchange = get_exchange(exchange_name)
    order = exchange.create_order(symbol, order_type, side, amount, price)
    order["exchange"] = exchange_name
    return order


async def fetch_ohlcv(
    exchange_name: str,
    symbol: str,
    timeframe: str = "1h",
    limit: int = 100,
) -> list[dict]:
    exchange = get_exchange(exchange_name)
    raw = exchange.fetch_ohlcv(symbol, timeframe, limit=limit)
    return [
        {
            "timestamp": c[0],
            "open": c[1],
            "high": c[2],
            "low": c[3],
            "close": c[4],
            "volume": c[5],
            "exchange": exchange_name,
            "symbol": symbol,
        }
        for c in raw
    ]


async def check_exchange_status(exchange_name: str) -> dict:
    try:
        exchange = get_exchange(exchange_name)
        exchange.load_markets()
        return {"exchange": exchange_name, "connected": True}
    except Exception as e:
        return {"exchange": exchange_name, "connected": False, "error": str(e)}
