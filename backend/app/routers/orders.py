from fastapi import APIRouter, HTTPException
from app.models.schemas import OrderRequest
from app.services import exchange_service

router = APIRouter(prefix="/orders", tags=["orders"])


@router.post("/")
async def place_order(order: OrderRequest):
    try:
        result = await exchange_service.create_order(
            order.exchange,
            order.symbol,
            order.side,
            order.order_type,
            order.amount,
            order.price,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
