from fastapi import APIRouter, Query, HTTPException
from app.services import signals_service
from app.services.market_service import EXCHANGES

router = APIRouter(prefix="/signals", tags=["signals"])


@router.get("/screener/{exchange}")
async def screener(
    exchange: str,
    limit: int = Query(10, ge=1, le=20),
):
    """Screener técnico de las acciones más populares de una bolsa."""
    if exchange.upper() not in EXCHANGES:
        raise HTTPException(404, f"Bolsa '{exchange}' no soportada.")
    return await signals_service.get_screener(exchange.upper(), limit)


@router.get("/{exchange}/{symbol}")
async def symbol_signals(exchange: str, symbol: str):
    """Señales técnicas de una acción concreta."""
    result = await signals_service.get_signals_for_symbol(
        symbol.upper(), exchange.upper()
    )
    if "error" in result:
        raise HTTPException(400, result["error"])
    return result
