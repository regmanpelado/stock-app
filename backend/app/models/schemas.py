from pydantic import BaseModel
from typing import Optional


class Ticker(BaseModel):
    symbol: str
    last: Optional[float]
    bid: Optional[float]
    ask: Optional[float]
    high: Optional[float]
    low: Optional[float]
    volume: Optional[float]
    change: Optional[float]
    percentage: Optional[float]
    exchange: str


class Balance(BaseModel):
    currency: str
    free: float
    used: float
    total: float
    exchange: str


class OrderRequest(BaseModel):
    exchange: str
    symbol: str
    side: str  # "buy" | "sell"
    order_type: str  # "market" | "limit"
    amount: float
    price: Optional[float] = None


class OrderResponse(BaseModel):
    id: str
    exchange: str
    symbol: str
    side: str
    type: str
    amount: float
    price: Optional[float]
    status: str
    timestamp: Optional[int]


class ExchangeStatus(BaseModel):
    exchange: str
    connected: bool
    error: Optional[str] = None


class OHLCV(BaseModel):
    timestamp: int
    open: float
    high: float
    low: float
    close: float
    volume: float
    exchange: str
    symbol: str
