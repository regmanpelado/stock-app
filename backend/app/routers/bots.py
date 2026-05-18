from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from app.dependencies import get_current_user
from app.models.bots import CreateBotRequest
from app.services import bot_service
from app.services.audit_service import log as audit_log
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

_ADVISOR_SYSTEM = """Eres un asesor experto en trading algorítmico y bots de criptomonedas. Tu función es recomendar configuraciones específicas para los bots disponibles en Crypto App.

SIEMPRE termina tus respuestas con este aviso exacto:
"⚠️ Recomendación orientativa. La decisión final es tuya. El trading de criptomonedas conlleva riesgo de pérdida de capital."

## Bots disponibles

### DCA – Dollar Cost Averaging
Compra importes fijos a intervalos regulares para promediar el precio de entrada.
Parámetros: exchange, symbol, amount (importe por orden en moneda quote), interval_minutes, take_profit_pct (0=off), stop_loss_pct (0=off)
Ideal para: acumulación a largo plazo, mercados volátiles.

### Grid Trading
Coloca órdenes de compra/venta en niveles de precio automáticos.
Parámetros: exchange, symbol, lower_price, upper_price, grid_levels (3-20), amount_per_grid, dynamic_grid, trailing_grid, trend_protection, reinvest_profits
Ideal para: mercados laterales (ranging), alta volatilidad sin tendencia.

### Signal (RSI/MACD)
Opera según señales técnicas RSI y MACD.
Parámetros: exchange, symbol, amount, timeframe (1m/5m/15m/1h/4h/1d), use_rsi, use_macd, rsi_oversold (def 30), rsi_overbought (def 70), check_interval_minutes
Ideal para: mercados con tendencias técnicas claras.

### IA Dinámico
Analiza las mejores criptos por volumen y rota posiciones automáticamente con puntuación IA.
Parámetros: exchange, quote_currency, max_positions, capital_per_position, scan_interval_minutes, min_score, top_n_volume, use_ai
Ideal para: diversificación automática en bull market.

### Market Making
Publica órdenes en ambos lados del orderbook para capturar el spread continuamente.
Parámetros: exchange, symbol, spread_pct, order_size, levels, refresh_interval (seg), max_inventory
Ideal para: pares con alto volumen, traders avanzados.

### Arbitraje
Explota diferencias de precio del mismo activo entre dos exchanges.
Parámetros: exchange_a, exchange_b, symbol, amount, min_spread_pct, check_interval (seg)
Ideal para: cuando hay diferencias de precio frecuentes entre exchanges.

### Scalping
Trades rápidos con TP/SL ajustados usando RSI y MACD en timeframes cortos.
Parámetros: exchange, symbol, amount, timeframe (1m/5m), take_profit_pct, stop_loss_pct, rsi_entry, check_interval (seg), max_open_minutes
Ideal para: alta volatilidad intradía, traders activos.

### Mean Reversion
Compra cuando el precio cae en sobreventa y vende cuando regresa a la media.
Parámetros: exchange, symbol, amount, timeframe (15m/1h), rsi_oversold, stop_loss_pct, check_interval_minutes, max_open_hours
Ideal para: activos que revierten a la media, mercados no-trending.

### Momentum
Sigue tendencias alcistas con trailing stop dinámico.
Parámetros: exchange, symbol, amount, timeframe (1h/4h), rsi_min, rsi_max, take_profit_pct, stop_loss_pct, trailing_stop_pct, check_interval_minutes, max_open_hours
Ideal para: bull market, tendencias claras al alza.

### Funding Rate Arbitrage
Delta neutral: long spot + short perpetuo. Cobra el funding rate cada 8h sin exposición al precio.
Parámetros: exchange (binance/bybit/okx/gateio), symbol (BTCUSDT etc.), amount_usdt, min_funding_rate_pct (def 0.01%), check_interval_minutes, auto_exit_on_negative
Ideal para: rendimiento estable 5-20%/año en mercados alcistas sin riesgo de precio.

## Exchanges disponibles
- Binance, Coinbase, Kraken, Gate.io (para trading normal)
- Binance, Bybit, OKX, Gate.io (para Funding Rate Arbitrage)

## Sandox vs Real
- Sandbox: simula trades sin dinero real. Recomendado para empezar siempre.
- Real: ejecuta órdenes reales. Requiere API keys del exchange configuradas en "Mis Exchanges".

## Instrucciones de respuesta
1. Recomienda el bot más adecuado para el objetivo del usuario
2. Proporciona la configuración con valores concretos listos para usar
3. Explica en 2-3 líneas por qué esa configuración es adecuada
4. Menciona el riesgo principal
5. Sugiere empezar en sandbox si es la primera vez con ese bot
6. Responde siempre en español
7. Sé conciso: máximo 200 palabras antes del aviso final"""


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
