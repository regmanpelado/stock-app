from fastapi import APIRouter, Query, HTTPException
from app.services import market_service

router = APIRouter(prefix="/markets", tags=["markets"])


@router.get("/indices")
async def get_indices():
    """Índices mundiales en tiempo real."""
    return await market_service.get_indices()


@router.get("/currencies")
async def get_currencies():
    """Divisas y materias primas."""
    return await market_service.get_currencies()


@router.get("/sectors")
async def get_sectors():
    """Rendimiento de sectores del S&P500."""
    return await market_service.get_sectors()


@router.get("/exchanges")
async def list_exchanges():
    """Lista de bolsas disponibles."""
    return [
        {"id": k, "name": v["name"], "currency": v["currency"], "tz": v["tz"]}
        for k, v in market_service.EXCHANGES.items()
    ]


@router.get("/popular/{exchange}")
async def get_popular(exchange: str):
    """Acciones más populares de una bolsa."""
    if exchange.upper() not in market_service.EXCHANGES:
        raise HTTPException(404, f"Bolsa '{exchange}' no soportada.")
    return await market_service.get_popular(exchange.upper())


@router.get("/search")
async def search(q: str = Query(..., min_length=1)):
    """Busca acciones por símbolo."""
    return await market_service.search_stocks(q)


@router.get("/quote/{symbol}")
async def get_quote(
    symbol: str,
    exchange: str = Query("NYSE"),
):
    """Precio actual de una acción."""
    try:
        return await market_service.get_quote(symbol, exchange.upper())
    except Exception as e:
        raise HTTPException(400, str(e))


@router.get("/history/{symbol}")
async def get_history(
    symbol: str,
    exchange: str = Query("NYSE"),
    period: str  = Query("6mo", description="1d 5d 1mo 3mo 6mo 1y 2y 5y"),
    interval: str = Query("1d", description="1m 5m 15m 1h 1d 1wk 1mo"),
):
    """Historial OHLCV de una acción."""
    try:
        return await market_service.get_history(symbol, exchange.upper(), period, interval)
    except Exception as e:
        raise HTTPException(400, str(e))
