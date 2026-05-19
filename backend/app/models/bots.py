from pydantic import BaseModel
from typing import Literal, Optional


class DCAStockConfig(BaseModel):
    """Compra periódica de una acción a intervalos regulares."""
    symbol:            str
    exchange:          str   = "NYSE"
    amount_usd:        float                  # importe en USD por compra
    interval_minutes:  int   = 1440           # default: diario
    take_profit_pct:   float = 0.0            # % ganancia para cerrar (0=off)
    stop_loss_pct:     float = 0.0            # % pérdida máxima (0=off)
    sandbox:           bool  = True


class MomentumStockConfig(BaseModel):
    """Sigue tendencias alcistas con trailing stop dinámico."""
    symbol:               str
    exchange:             str   = "NYSE"
    amount_usd:           float
    rsi_min:              float = 55    # RSI mínimo para entrar
    rsi_max:              float = 75    # RSI máximo para entrar (evitar sobrecompra)
    take_profit_pct:      float = 5.0
    stop_loss_pct:        float = 3.0
    trailing_stop_pct:    float = 2.0
    check_interval_minutes: int = 60
    sandbox:              bool  = True


class SignalStockConfig(BaseModel):
    """Compra/vende según señales RSI y MACD."""
    symbol:                 str
    exchange:               str   = "NYSE"
    amount_usd:             float
    rsi_oversold:           float = 35
    rsi_overbought:         float = 65
    use_macd:               bool  = True
    check_interval_minutes: int   = 60
    sandbox:                bool  = True


class RebalanceConfig(BaseModel):
    """Mantiene proporciones fijas en una cartera y rebalancea automáticamente."""
    exchange:               str          = "NYSE"
    targets:                dict         # {"AAPL": 30, "MSFT": 30, "GOOGL": 40} (% suma 100)
    total_capital_usd:      float        # capital total a gestionar
    rebalance_threshold_pct: float = 5.0  # rebalancea si desviación > X%
    check_interval_minutes:  int   = 1440 # default: diario
    sandbox:                 bool  = True


class CreateBotRequest(BaseModel):
    type: Literal["dca_stock", "momentum_stock", "signal_stock", "rebalance"]
    name: Optional[str] = None
    config: dict
    sandbox: bool = True
