from fastapi import APIRouter, HTTPException
from app.services import exchange_service
from app.config import get_settings

router = APIRouter(prefix="/exchanges", tags=["exchanges"])


@router.get("/")
async def list_exchanges():
    return {"exchanges": exchange_service.list_exchanges()}


@router.get("/{exchange}/status")
async def exchange_status(exchange: str):
    return await exchange_service.check_exchange_status(exchange)


@router.get("/status/all")
async def all_exchanges_status():
    results = []
    for name in exchange_service.list_exchanges():
        results.append(await exchange_service.check_exchange_status(name))
    return results
