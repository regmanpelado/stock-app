from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Alpaca (paper + live trading)
    alpaca_api_key:    str = ""
    alpaca_secret_key: str = ""
    alpaca_paper:      bool = True   # True = paper trading, False = live

    # Twelve Data (mercados globales en tiempo real)
    twelve_data_api_key: str = ""

    # Crypto exchanges (heredados del fork, usados por exchange_service/bot_service)
    binance_api_key:    str = ""
    binance_secret_key: str = ""
    coinbase_api_key:   str = ""
    coinbase_pem_secret: str = ""
    kraken_api_key:     str = ""
    kraken_secret_key:  str = ""
    gate_api_key:       str = ""
    gate_secret_key:    str = ""

    # Auth
    jwt_secret:      str = "CHANGE_ME_TO_A_LONG_RANDOM_SECRET_IN_PRODUCTION"
    jwt_expire_days: int = 7

    # App
    backend_host: str = "0.0.0.0"
    backend_port: int = 8000
    debug:        bool = True
    allowed_origins: str = (
        "http://localhost:3000,"
        "http://localhost:5173,"
        "https://stock-app-production.up.railway.app"
    )

    app_url:     str = "http://localhost:3000"
    admin_email: str = ""

    # Stripe
    stripe_secret_key:     str = ""
    stripe_webhook_secret: str = ""
    stripe_price_pro:      str = ""
    stripe_price_pro_plus: str = ""

    # Email
    brevo_api_key:      str = ""
    brevo_sender_email: str = ""
    brevo_sender_name:  str = "Stock App"

    # AI advisor
    gemini_api_key: str = ""

    @property
    def origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",")]

    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    return Settings()
