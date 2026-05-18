from fastapi import APIRouter
from app.services import currency_service

router = APIRouter(prefix="/currency", tags=["currency"])


@router.get("/eurusd")
async def get_eurusd():
    rate = await currency_service.get_eurusd_rate()
    return {"eur_usd": rate, "usd_eur": round(1 / rate, 6)}
