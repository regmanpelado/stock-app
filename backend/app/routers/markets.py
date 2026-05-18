from fastapi import APIRouter, Query
from typing import Optional
from app.services import exchange_service

router = APIRouter(prefix="/markets", tags=["markets"])


@router.get("/{exchange}/ticker/{symbol:path}")
async def get_ticker(exchange: str, symbol: str):
    return await exchange_service.fetch_ticker(exchange, symbol)


@router.get("/{exchange}/tickers")
async def get_tickers(
    exchange: str,
    symbols: Optional[str] = Query(None, description="Comma-separated symbols"),
):
    symbol_list = [s.strip() for s in symbols.split(",")] if symbols else None
    return await exchange_service.fetch_tickers(exchange, symbol_list)


@router.get("/{exchange}/ohlcv/{symbol:path}")
async def get_ohlcv(
    exchange: str,
    symbol: str,
    timeframe: str = Query("1h", description="1m 5m 15m 1h 4h 1d"),
    limit: int = Query(100, ge=1, le=500),
):
    return await exchange_service.fetch_ohlcv(exchange, symbol, timeframe, limit)
