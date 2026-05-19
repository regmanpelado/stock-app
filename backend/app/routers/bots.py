from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from app.dependencies import get_current_user
from app.models.bots import CreateBotRequest
from app.services import bot_service
from app.services.audit_service import log as audit_log

router = APIRouter(prefix="/bots", tags=["bots"])


def _assert_owns(bot_id: str, user_id: str) -> dict:
    try:
        bot = bot_service.get_bot(bot_id)
    except ValueError as e:
        raise HTTPException(404, str(e))
    if bot.get("user_id") != user_id:
        raise HTTPException(403, "No tienes permiso para acceder a este bot")
    return bot


@router.post("/", status_code=201)
async def create_bot(req: CreateBotRequest, current_user: dict = Depends(get_current_user)):
    try:
        bot = bot_service.create_bot(req.type, req.config, req.sandbox, req.name,
                                     user_id=current_user["sub"])
        audit_log("BOT_CREATED", user_id=current_user["sub"],
                  user_email=current_user.get("email"),
                  details={"bot_id": bot["id"], "name": bot["name"],
                           "type": bot["type"], "sandbox": bot["sandbox"],
                           "exchange": req.config.get("exchange")})
        return bot
    except Exception as e:
        raise HTTPException(400, str(e))


@router.get("/")
def list_bots(current_user: dict = Depends(get_current_user)):
    return bot_service.list_bots(user_id=current_user["sub"])


@router.get("/{bot_id}")
def get_bot(bot_id: str, current_user: dict = Depends(get_current_user)):
    return _assert_owns(bot_id, current_user["sub"])


@router.post("/{bot_id}/start")
async def start_bot(bot_id: str, current_user: dict = Depends(get_current_user)):
    bot = _assert_owns(bot_id, current_user["sub"])
    try:
        await bot_service.start_bot(bot_id)
        result = bot_service.get_bot(bot_id)
        audit_log("BOT_STARTED", user_id=current_user["sub"],
                  user_email=current_user.get("email"),
                  details={"bot_id": bot_id, "name": bot.get("name")})
        return result
    except ValueError as e:
        raise HTTPException(404, str(e))


@router.post("/{bot_id}/pause")
def pause_bot(bot_id: str, current_user: dict = Depends(get_current_user)):
    bot = _assert_owns(bot_id, current_user["sub"])
    bot_service.pause_bot(bot_id)
    audit_log("BOT_PAUSED", user_id=current_user["sub"],
              user_email=current_user.get("email"),
              details={"bot_id": bot_id, "name": bot.get("name")})
    return bot_service.get_bot(bot_id)


@router.post("/{bot_id}/stop")
def stop_bot(bot_id: str, current_user: dict = Depends(get_current_user)):
    bot = _assert_owns(bot_id, current_user["sub"])
    bot_service.stop_bot(bot_id)
    audit_log("BOT_STOPPED", user_id=current_user["sub"],
              user_email=current_user.get("email"),
              details={"bot_id": bot_id, "name": bot.get("name")})
    return bot_service.get_bot(bot_id)


@router.delete("/{bot_id}")
def delete_bot(bot_id: str, current_user: dict = Depends(get_current_user)):
    bot = _assert_owns(bot_id, current_user["sub"])
    bot_service.delete_bot(bot_id)
    audit_log("BOT_DELETED", user_id=current_user["sub"],
              user_email=current_user.get("email"),
              details={"bot_id": bot_id, "name": bot.get("name")})
    return {"deleted": bot_id}


# ── Asesor IA ──────────────────────────────────────────────────────────────────

_ADVISOR_SYSTEM = """Eres un asesor experto en trading algorítmico de acciones en bolsas globales. Tu función es recomendar configuraciones para los bots de Stock App.

SIEMPRE termina con este aviso exacto:
"⚠️ Recomendación orientativa. La decisión final es tuya. Invertir en bolsa conlleva riesgo de pérdida de capital."

## Bots disponibles

### DCA Acciones (dca_stock)
Compra una acción periódicamente con importe fijo para promediar el precio de entrada.
Parámetros: symbol (ej: AAPL), exchange (NYSE/NASDAQ/BME/LSE...), amount_usd, interval_minutes (1440=diario), take_profit_pct (0=off), stop_loss_pct (0=off)
Ideal para: acumulación a largo plazo, inversión periódica automatizada.

### Momentum (momentum_stock)
Compra cuando el RSI muestra fuerza alcista y vende con trailing stop dinámico.
Parámetros: symbol, exchange, amount_usd, rsi_min (def 55), rsi_max (def 75), take_profit_pct, stop_loss_pct, trailing_stop_pct, check_interval_minutes
Ideal para: mercados en tendencia alcista, acciones con momentum fuerte.

### Señales RSI/MACD (signal_stock)
Compra en sobreventa RSI + confirmación MACD, vende en sobrecompra.
Parámetros: symbol, exchange, amount_usd, rsi_oversold (def 35), rsi_overbought (def 65), use_macd (true/false), check_interval_minutes
Ideal para: acciones con ciclos técnicos claros.

### Rebalanceo (rebalance)
Mantiene proporciones fijas en una cartera y rebalancea automáticamente.
Parámetros: exchange, targets ({"AAPL": 40, "MSFT": 30, "GOOGL": 30}), total_capital_usd, rebalance_threshold_pct (def 5), check_interval_minutes (def 1440)
Ideal para: gestión pasiva de cartera diversificada.

## Bolsas disponibles
NYSE, NASDAQ (acciones USA) · BME (España/IBEX35) · LSE (UK) · EURONEXT (Francia) · XETRA (Alemania) · TSE (Japón) · HKEX (Hong Kong)

## Sandbox vs Real
- Sandbox: simula operaciones sin dinero real. Recomendado para empezar siempre.
- Real: requiere cuenta Alpaca configurada en ajustes.

## Instrucciones
1. Recomienda el bot más adecuado al objetivo del usuario
2. Da la configuración con valores concretos y símbolo real (ej: AAPL, SAN.MC)
3. Explica en 2-3 líneas por qué esa configuración es adecuada
4. Menciona el riesgo principal
5. Sugiere empezar en sandbox
6. Responde siempre en español. Máximo 200 palabras antes del aviso."""


class AdvisorRequest(BaseModel):
    message: str


@router.post("/advisor")
async def bot_advisor(req: AdvisorRequest, current_user: dict = Depends(get_current_user)):
    """Asesor IA de configuración de bots usando Gemini Flash."""
    import os
    import httpx

    api_key = os.getenv("GEMINI_API_KEY", "")
    if not api_key:
        raise HTTPException(
            503,
            "El asesor IA no está disponible. Configura GEMINI_API_KEY en Railway.",
        )
    if not req.message.strip():
        raise HTTPException(400, "El mensaje no puede estar vacío.")

    url = (
        "https://generativelanguage.googleapis.com/v1beta/models"
        f"/gemini-2.5-flash:generateContent?key={api_key}"
    )
    payload = {
        "system_instruction": {"parts": [{"text": _ADVISOR_SYSTEM}]},
        "contents": [{"role": "user", "parts": [{"text": req.message.strip()}]}],
        "generationConfig": {"maxOutputTokens": 800, "temperature": 0.4},
    }

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(url, json=payload)

        if r.status_code == 400:
            raise HTTPException(400, "Petición inválida al asesor.")
        if r.status_code == 401 or r.status_code == 403:
            raise HTTPException(503, "API key de Gemini inválida o sin permisos.")
        if r.status_code == 429:
            raise HTTPException(429, "Demasiadas consultas al asesor. Espera un momento.")
        if r.status_code != 200:
            raise HTTPException(500, f"Error del asesor ({r.status_code}).")

        data = r.json()
        text = data["candidates"][0]["content"]["parts"][0]["text"]
        return {"response": text}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Error del asesor: {str(e)[:120]}")
