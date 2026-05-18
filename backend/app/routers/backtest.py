from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services import backtest_service

router = APIRouter(prefix="/backtest", tags=["backtest"])


class BacktestRequest(BaseModel):
    exchange: str
    symbol: str
    strategy: str       # dca | grid | signal
    period: str         # 1m | 3m | 6m | 1y
    initial_capital: float
    params: dict = {}


@router.post("/run")
async def run_backtest(req: BacktestRequest):
    try:
        return await backtest_service.run_backtest(
            req.exchange, req.symbol, req.strategy,
            req.period, req.initial_capital, req.params,
        )
    except ValueError as e:
        raise HTTPException(400, str(e))
