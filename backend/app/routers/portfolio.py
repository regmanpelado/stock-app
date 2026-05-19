from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.dependencies import get_current_user
from app.services import portfolio_service

router = APIRouter(prefix="/portfolio", tags=["portfolio"])


class AddPositionRequest(BaseModel):
    symbol:    str
    exchange:  str = "NYSE"
    shares:    float
    avg_price: float
    currency:  str = "USD"
    name:      str = ""
    notes:     str = ""


class UpdatePositionRequest(BaseModel):
    shares:    float
    avg_price: float
    notes:     Optional[str] = None


# ── Portfolio manual ──────────────────────────────────────────────────────────

@router.get("/")
async def get_portfolio(current_user: dict = Depends(get_current_user)):
    """Portfolio manual con precios actuales y P&L."""
    return await portfolio_service.get_portfolio(current_user["sub"])


@router.post("/positions", status_code=201)
def add_position(req: AddPositionRequest,
                 current_user: dict = Depends(get_current_user)):
    """Añade una posición manual al portfolio."""
    try:
        return portfolio_service.add_position(
            user_id=current_user["sub"],
            symbol=req.symbol, exchange=req.exchange,
            shares=req.shares, avg_price=req.avg_price,
            currency=req.currency, name=req.name, notes=req.notes,
        )
    except Exception as e:
        raise HTTPException(400, str(e))


@router.put("/positions/{position_id}")
def update_position(position_id: str, req: UpdatePositionRequest,
                    current_user: dict = Depends(get_current_user)):
    """Actualiza shares o precio medio de una posición."""
    try:
        return portfolio_service.update_position(
            position_id, current_user["sub"],
            req.shares, req.avg_price, req.notes,
        )
    except ValueError as e:
        raise HTTPException(404, str(e))


@router.delete("/positions/{position_id}")
def delete_position(position_id: str,
                    current_user: dict = Depends(get_current_user)):
    """Elimina una posición del portfolio."""
    try:
        portfolio_service.delete_position(position_id, current_user["sub"])
        return {"deleted": position_id}
    except ValueError as e:
        raise HTTPException(404, str(e))


# ── Alpaca ────────────────────────────────────────────────────────────────────

@router.get("/alpaca")
async def get_alpaca(current_user: dict = Depends(get_current_user)):
    """Portfolio y cuenta de Alpaca (paper o real)."""
    return await portfolio_service.get_alpaca_portfolio()


@router.post("/alpaca/order")
def place_alpaca_order(
    symbol: str, qty: float, side: str,
    current_user: dict = Depends(get_current_user),
):
    """Coloca una orden en Alpaca (paper o real)."""
    try:
        from app.services import alpaca_service
        return alpaca_service.place_order(symbol, qty, side)
    except Exception as e:
        raise HTTPException(400, str(e))
