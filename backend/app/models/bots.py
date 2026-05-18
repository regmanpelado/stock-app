from pydantic import BaseModel
from typing import Literal, Optional


class DCAConfig(BaseModel):
    exchange: str
    symbol: str
    amount: float
    interval_minutes: int = 60
    take_profit_pct: float = 0.0   # % ganancia para vender todo y reiniciar ciclo (0 = desactivado)
    stop_loss_pct:   float = 0.0   # % pérdida máxima para cortar (0 = desactivado)


class GridConfig(BaseModel):
    exchange: str
    symbol: str
    lower_price: float
    upper_price: float
    grid_levels: int = 5
    amount_per_grid: float
    dynamic_grid: bool = False
    trailing_grid: bool = False
    trend_protection: bool = False
    trend_threshold_pct: float = 3.0
    reinvest_profits: bool = False


class SignalConfig(BaseModel):
    exchange: str
    symbol: str
    amount: float
    timeframe: str = "1h"
    use_rsi: bool = True
    use_macd: bool = True
    rsi_oversold: float = 30
    rsi_overbought: float = 70
    check_interval_minutes: int = 5


class IADynamicConfig(BaseModel):
    exchange: str
    quote_currency: str = "USDT"     # moneda de cotización para filtrar pares
    max_positions: int = 3            # cuántas criptos mantener a la vez (3-5)
    capital_per_position: float       # capital a invertir por posición
    scan_interval_minutes: int = 60   # cada cuánto escanear
    min_score: int = 2                # puntuación mínima para entrar
    top_n_volume: int = 30            # analizar las N con más volumen
    use_ai: bool = True               # incluir predicción IA en la puntuación


class MarketMakingConfig(BaseModel):
    exchange: str
    symbol: str
    spread_pct: float = 0.5        # spread total en %
    order_size: float               # cantidad en moneda base por orden
    levels: int = 1                 # niveles por lado (1-5)
    refresh_interval: int = 30      # segundos entre ciclos
    max_inventory: float            # máx. moneda base a acumular


class ArbitrageConfig(BaseModel):
    exchange_a: str               # exchange donde se compra
    exchange_b: str               # exchange donde se vende
    symbol: str
    amount: float                 # capital en moneda quote por operación
    min_spread_pct: float = 0.3   # spread mínimo para ejecutar (%)
    check_interval: int = 10      # segundos entre escaneos


class ScalpingConfig(BaseModel):
    exchange: str
    symbol: str
    amount: float                    # cantidad en moneda base por operación
    timeframe: str = "5m"            # timeframe para indicadores
    take_profit_pct: float = 0.5     # % ganancia para cerrar posición
    stop_loss_pct: float = 0.3       # % pérdida máxima (stop-loss)
    rsi_entry: float = 45            # RSI máximo para entrar en largo
    check_interval: int = 30         # segundos entre ciclos
    max_open_minutes: int = 60       # tiempo máximo con posición abierta


class MeanReversionConfig(BaseModel):
    exchange: str
    symbol: str
    amount: float                      # cantidad en moneda base
    timeframe: str = "1h"              # timeframe para Bollinger Bands
    rsi_confirm: bool = True           # confirmar entrada con RSI
    rsi_oversold: float = 35           # RSI máximo para confirmación
    exit_at_mean: bool = True          # True=salir en la media, False=salir en banda superior
    stop_loss_pct: float = 3.0         # stop-loss % bajo precio de entrada
    check_interval_minutes: int = 15   # minutos entre ciclos
    max_open_hours: int = 48           # horas máximas con posición abierta


class MomentumConfig(BaseModel):
    exchange: str
    symbol: str
    amount: float
    timeframe: str = "1h"
    rsi_min: float = 55             # RSI mínimo para entrar (momentum positivo)
    rsi_max: float = 75             # RSI máximo para entrar (evitar sobrecompra)
    take_profit_pct: float = 3.0    # TP%
    stop_loss_pct: float = 2.0      # SL%
    trailing_stop_pct: float = 1.5  # trailing stop desde el precio máximo
    check_interval_minutes: int = 15
    max_open_hours: int = 24


class FundingArbConfig(BaseModel):
    exchange: str = "binance"           # solo exchanges con perpetuos (Binance, Gate.io)
    symbol: str   = "BTC/USDT"
    amount_usdt: float = 100.0          # capital total a desplegar (spot + margen perp)
    min_funding_rate_pct: float = 0.01  # % por cada 8 h para entrar (0.01 % ≈ 10.95 %/año)
    check_interval_minutes: int = 30
    auto_exit_on_negative: bool = True  # cierra si el funding se vuelve negativo


class CreateBotRequest(BaseModel):
    type: Literal["dca", "grid", "signal", "ia_dynamic", "market_making", "arbitrage",
                  "scalping", "mean_reversion", "momentum", "funding_arb"]
    name: Optional[str] = None
    config: dict
    sandbox: bool = True
