from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.dependencies import get_current_user
from app.services import exchange_key_service

router = APIRouter(prefix="/exchange-keys", tags=["exchange-keys"])


class KeyPayload(BaseModel):
    exchange:   str
    api_key:    str
    api_secret: str
    label:      str = ""


@router.get("/")
def list_keys(user: dict = Depends(get_current_user)):
    return exchange_key_service.list_user_keys(user["sub"])


@router.post("/")
def upsert(payload: KeyPayload, user: dict = Depends(get_current_user)):
    try:
        return exchange_key_service.upsert_key(
            user["sub"], payload.exchange,
            payload.api_key, payload.api_secret, payload.label,
        )
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.delete("/{exchange}")
def delete(exchange: str, user: dict = Depends(get_current_user)):
    if not exchange_key_service.delete_key(user["sub"], exchange):
        raise HTTPException(404, "No se encontraron credenciales para este exchange")
    return {"ok": True}


@router.get("/{exchange}/test")
async def test(exchange: str, user: dict = Depends(get_current_user)):
    return await exchange_key_service.test_connection(user["sub"], exchange)
