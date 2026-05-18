"""Servicio de trading via Alpaca (paper + live). Reemplaza a CCXT."""
from app.config import get_settings


def _client():
    from alpaca.trading.client import TradingClient
    s = get_settings()
    if not s.alpaca_api_key:
        raise ValueError("Alpaca no configurado. Añade ALPACA_API_KEY y ALPACA_SECRET_KEY.")
    return TradingClient(s.alpaca_api_key, s.alpaca_secret_key, paper=s.alpaca_paper)


def get_account() -> dict:
    c = _client()
    acc = c.get_account()
    return {
        "cash":          float(acc.cash),
        "portfolio_value": float(acc.portfolio_value),
        "buying_power":  float(acc.buying_power),
        "paper":         get_settings().alpaca_paper,
    }


def get_positions() -> list[dict]:
    c = _client()
    return [
        {
            "symbol":     p.symbol,
            "qty":        float(p.qty),
            "avg_entry":  float(p.avg_entry_price),
            "market_value": float(p.market_value),
            "unrealized_pnl": float(p.unrealized_pl),
            "unrealized_pnl_pct": float(p.unrealized_plpc) * 100,
        }
        for p in c.get_all_positions()
    ]


def place_order(symbol: str, qty: float, side: str,
                order_type: str = "market") -> dict:
    from alpaca.trading.requests import MarketOrderRequest
    from alpaca.trading.enums import OrderSide, TimeInForce

    c = _client()
    req = MarketOrderRequest(
        symbol=symbol,
        qty=qty,
        side=OrderSide.BUY if side == "buy" else OrderSide.SELL,
        time_in_force=TimeInForce.DAY,
    )
    order = c.submit_order(req)
    return {"id": str(order.id), "symbol": symbol, "side": side,
            "qty": qty, "status": str(order.status)}


def get_orders(status: str = "all") -> list[dict]:
    from alpaca.trading.requests import GetOrdersRequest
    from alpaca.trading.enums import QueryOrderStatus

    c = _client()
    req = GetOrdersRequest(status=QueryOrderStatus.ALL, limit=50)
    return [
        {"id": str(o.id), "symbol": o.symbol, "side": str(o.side),
         "qty": float(o.qty or 0), "status": str(o.status),
         "filled_at": str(o.filled_at or "")}
        for o in c.get_orders(req)
    ]
