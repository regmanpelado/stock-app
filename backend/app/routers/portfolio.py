from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.dependencies import get_current_user
from app.services import exchange_service

router = APIRouter(prefix="/portfolio", tags=["portfolio"])

# Moneda de cotización preferida por exchange (para las ventas a "dinero")
_QUOTE_PRIORITY = {
    "binance":  ["USDT", "EUR", "USD"],
    "coinbase": ["USD",  "EUR", "USDT"],
    "kraken":   ["EUR",  "USD", "USDT"],
    "gateio":   ["USDT", "EUR", "USD"],
}
# Monedas que ya son "dinero" — no se venden
_BASE_QUOTES = {"EUR", "ZEUR", "EURT", "USD", "USDT", "BUSD", "ZUSD", "USDC", "USDP", "DAI"}


def _best_pair(exchange_name: str, asset: str) -> str | None:
    """Devuelve el mejor par para vender el asset (ej: ADA/EUR, ADA/USDT)."""
    exc = exchange_service.get_exchange(exchange_name)
    try:
        markets = exc.load_markets()
    except Exception:
        return None
    for quote in _QUOTE_PRIORITY.get(exchange_name, ["EUR", "USDT", "USD"]):
        sym = f"{asset}/{quote}"
        if sym in markets:
            return sym
    return None


# ── Read ────────────────────────────────────────────────────────────────────────

@router.get("/{exchange}/balance")
async def get_balance(exchange: str, current_user: dict = Depends(get_current_user)):
    try:
        return await exchange_service.fetch_balance(exchange, user_id=current_user["sub"])
    except Exception as e:
        raise HTTPException(400, str(e))


@router.get("/balance/all")
async def get_all_balances(current_user: dict = Depends(get_current_user)):
    all_balances = {}
    for name in exchange_service.list_exchanges():
        try:
            all_balances[name] = await exchange_service.fetch_balance(name, user_id=current_user["sub"])
        except Exception as e:
            all_balances[name] = {"error": str(e)}
    return all_balances


# ── Sell ────────────────────────────────────────────────────────────────────────

class SellRequest(BaseModel):
    asset:   str
    amount:  float
    sandbox: bool = True


class SellAllRequest(BaseModel):
    sandbox:        bool  = True
    min_value_eur:  float = 0.50   # no vende posiciones por debajo de este umbral


@router.post("/{exchange}/sell")
async def sell_asset(exchange: str, req: SellRequest,
                     current_user: dict = Depends(get_current_user)):
    """Vende una cantidad de un asset al mejor precio disponible."""
    if req.asset.upper() in _BASE_QUOTES:
        raise HTTPException(400, f"{req.asset} es moneda base — no se puede vender a sí misma.")

    symbol = _best_pair(exchange, req.asset)
    if not symbol:
        raise HTTPException(400, f"No se encontró par de venta para {req.asset} en {exchange}.")

    try:
        ticker = await exchange_service.fetch_ticker(exchange, symbol)
        price  = float(ticker["last"])
        cost   = round(price * req.amount, 6)

        if req.sandbox:
            return {
                "sandbox": True,
                "symbol": symbol,
                "side": "sell",
                "amount": req.amount,
                "price": price,
                "total": cost,
                "status": "simulado",
                "message": f"SANDBOX: venta simulada de {req.amount} {req.asset} a {price} → {cost:.4f} {symbol.split('/')[1]}",
            }

        # Verificar que el usuario tiene claves para este exchange
        from app.services.exchange_key_service import get_credentials
        creds = get_credentials(current_user["sub"], exchange)
        if not creds:
            raise ValueError(
                f"No tienes API keys configuradas para {exchange}. "
                "Ve a 'Mis Exchanges' para añadirlas."
            )
        order = await exchange_service.create_order(exchange, symbol, "sell", "market", req.amount)
        exec_price = float(order.get("price") or order.get("average") or price)
        return {
            "sandbox": False,
            "symbol": symbol,
            "side": "sell",
            "amount": req.amount,
            "price": exec_price,
            "total": round(exec_price * req.amount, 6),
            "status": order.get("status", "ok"),
            "order_id": order.get("id"),
        }
    except Exception as e:
        raise HTTPException(400, str(e))


@router.post("/{exchange}/sell_all")
async def sell_all(exchange: str, req: SellAllRequest,
                   current_user: dict = Depends(get_current_user)):
    """Vende todos los assets que no sean moneda base (EUR/USDT/USD)."""
    try:
        balances = await exchange_service.fetch_balance(exchange, user_id=current_user["sub"])
    except Exception as e:
        raise HTTPException(400, str(e))

    sellable = [
        b for b in balances
        if b["currency"].upper() not in _BASE_QUOTES
        and b["free"] > 0
        and (b.get("value_eur") or 0) >= req.min_value_eur
    ]

    if not sellable:
        return {"vendidos": [], "message": "No hay assets por encima del umbral mínimo para vender."}

    results = []
    for b in sellable:
        symbol = _best_pair(exchange, b["currency"])
        if not symbol:
            results.append({"asset": b["currency"], "error": "Par no encontrado", "sandbox": req.sandbox})
            continue
        try:
            ticker = await exchange_service.fetch_ticker(exchange, symbol)
            price  = float(ticker["last"])
            amount = b["free"]
            cost   = round(price * amount, 6)

            if req.sandbox:
                results.append({
                    "sandbox": True, "asset": b["currency"], "symbol": symbol,
                    "amount": amount, "price": price, "total": cost, "status": "simulado",
                })
            else:
                order = await exchange_service.create_order(exchange, symbol, "sell", "market", amount)
                exec_price = float(order.get("price") or order.get("average") or price)
                results.append({
                    "sandbox": False, "asset": b["currency"], "symbol": symbol,
                    "amount": amount, "price": exec_price,
                    "total": round(exec_price * amount, 6),
                    "status": order.get("status", "ok"),
                    "order_id": order.get("id"),
                })
        except Exception as e:
            results.append({"asset": b["currency"], "error": str(e), "sandbox": req.sandbox})

    return {"vendidos": results, "total": len(results), "sandbox": req.sandbox}
