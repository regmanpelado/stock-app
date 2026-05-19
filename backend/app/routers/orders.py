from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.dependencies import get_current_user

router = APIRouter(prefix="/orders", tags=["orders"])


class OrderRequest(BaseModel):
    symbol: str
    qty:    float
    side:   str   # "buy" | "sell"


@router.post("/")
def place_order(req: OrderRequest, current_user: dict = Depends(get_current_user)):
    """Coloca una orden en Alpaca (paper o real según configuración)."""
    try:
        from app.services import alpaca_service
        return alpaca_service.place_order(req.symbol, req.qty, req.side)
    except Exception as e:
        raise HTTPException(400, str(e))


@router.get("/")
def list_orders(current_user: dict = Depends(get_current_user)):
    """Lista las últimas órdenes de Alpaca."""
    try:
        from app.services import alpaca_service
        return alpaca_service.get_orders()
    except Exception as e:
        raise HTTPException(400, str(e))
