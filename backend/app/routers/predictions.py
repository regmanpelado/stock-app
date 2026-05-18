from fastapi import APIRouter, Query
from app.services import prediction_service

router = APIRouter(prefix="/predictions", tags=["predictions"])

PARES_DEFAULT = [
    ("binance",  "BTC/USDT"),
    ("coinbase", "BTC/USD"),
    ("kraken",   "BTC/EUR"),
]


@router.get("/btc")
async def predict_btc_all(timeframe: str = Query("1h")):
    """Predicción de BTC en los tres exchanges principales."""
    results = await prediction_service.predict_multi(PARES_DEFAULT, timeframe)
    return results


@router.get("/{exchange}/{symbol:path}")
async def predict_symbol(
    exchange: str,
    symbol: str,
    timeframe: str = Query("1h"),
    horizon:   int  = Query(24, ge=1, le=48),
):
    return await prediction_service.predict_price(exchange, symbol, timeframe, horizon)
