from fastapi import APIRouter, Query
from app.services import signals_service

router = APIRouter(prefix="/signals", tags=["signals"])


@router.get("/alerts/all")
async def get_all_alerts(timeframe: str = Query("1h")):
    return await signals_service.get_all_alerts(timeframe)


@router.get("/{exchange}")
async def get_screener(exchange: str, timeframe: str = Query("1h")):
    return await signals_service.get_screener(exchange, timeframe)


@router.get("/{exchange}/{symbol:path}")
async def get_symbol_signals(
    exchange: str,
    symbol: str,
    timeframe: str = Query("1h"),
):
    return await signals_service.analyze_symbol(exchange, symbol, timeframe)
