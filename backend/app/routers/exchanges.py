from fastapi import APIRouter
from app.services.market_service import EXCHANGES

router = APIRouter(prefix="/exchanges", tags=["exchanges"])


@router.get("/")
def list_exchanges():
    """Lista de bolsas globales soportadas."""
    return {
        "exchanges": [
            {"id": k, "name": v["name"], "currency": v["currency"],
             "tz": v["tz"], "suffix": v["suffix"]}
            for k, v in EXCHANGES.items()
        ]
    }


@router.get("/status/all")
async def all_exchanges_status():
    """Estado de todas las bolsas (abierto/cerrado según horario)."""
    from datetime import datetime
    import pytz

    results = []
    now_utc = datetime.now(pytz.utc)
    for exchange_id, meta in EXCHANGES.items():
        try:
            tz = pytz.timezone(meta["tz"])
            local_time = now_utc.astimezone(tz)
            weekday = local_time.weekday()  # 0=lunes, 6=domingo
            hour = local_time.hour
            # Horario estándar: L-V 9-17 hora local (simplificado)
            is_open = weekday < 5 and 9 <= hour < 17
            results.append({
                "exchange":   exchange_id,
                "name":       meta["name"],
                "is_open":    is_open,
                "local_time": local_time.strftime("%H:%M"),
                "currency":   meta["currency"],
            })
        except Exception:
            results.append({"exchange": exchange_id, "name": meta["name"],
                            "is_open": False, "local_time": "--:--"})
    return results


@router.get("/{exchange}/status")
async def exchange_status(exchange: str):
    """Estado de una bolsa concreta."""
    from datetime import datetime
    import pytz

    meta = EXCHANGES.get(exchange.upper())
    if not meta:
        return {"exchange": exchange, "connected": False, "error": "Bolsa no soportada"}
    try:
        tz = pytz.timezone(meta["tz"])
        local_time = datetime.now(pytz.utc).astimezone(tz)
        weekday = local_time.weekday()
        hour = local_time.hour
        is_open = weekday < 5 and 9 <= hour < 17
        return {"exchange": exchange, "connected": True, "is_open": is_open,
                "local_time": local_time.strftime("%H:%M"), "name": meta["name"]}
    except Exception as e:
        return {"exchange": exchange, "connected": False, "error": str(e)}
