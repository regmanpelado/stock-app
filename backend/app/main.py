from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from app.config import get_settings
from app.limiter import limiter
from app.routers import (
    exchanges, markets, orders, portfolio,
    signals, bots, predictions, subscriptions, admin, backtest, currency, news, auth,
    exchange_keys, stripe_webhook,
)
from app.services import bot_service

settings = get_settings()


def _run_migrations() -> None:
    """Aplica todas las migraciones Alembic pendientes al arrancar."""
    from pathlib import Path
    from alembic.config import Config
    from alembic import command
    from app.database import DATABASE_URL

    cfg = Config(str(Path(__file__).parent.parent / "alembic.ini"))
    cfg.set_main_option("sqlalchemy.url", DATABASE_URL)
    cfg.set_main_option("script_location", str(Path(__file__).parent.parent / "alembic"))
    command.upgrade(cfg, "head")
    print("[Alembic] Migraciones aplicadas.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    import asyncio
    print("[STARTUP] 1 - iniciando migraciones", flush=True)
    _run_migrations()
    print("[STARTUP] 2 - importando ensure_demo_user", flush=True)
    from app.services.subscription_service import ensure_demo_user, ensure_admin_from_env
    print("[STARTUP] 3 - llamando ensure_demo_user", flush=True)
    ensure_demo_user()
    print("[STARTUP] 4 - llamando ensure_admin_from_env", flush=True)
    ensure_admin_from_env()
    print("[STARTUP] 5 - creando tarea bots", flush=True)
    asyncio.create_task(bot_service.load_and_resume())
    print("[STARTUP] 6 - yield", flush=True)
    yield
    # Shutdown: persiste estado final
    from app.services import bot_store
    for bot in bot_service.list_bots():
        bot_store.update_bot(bot)
    await bot_service.cleanup_all()


app = FastAPI(
    title="Stock App API",
    description="Dashboard de bolsas globales con bots, señales IA y portfolio",
    version="2.0.0",
    lifespan=lifespan,
)

app.state.limiter = limiter

_origins = settings.origins_list
# SlowAPIMiddleware va primero (inner); CORSMiddleware envuelve todo (outer)
# para que las respuestas 429 incluyan cabeceras CORS
app.add_middleware(SlowAPIMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
)


# Manejador global: captura excepciones no tratadas y devuelve JSON con CORS headers.
# Sin esto, los 500 producidos por errores CCXT escapan del middleware CORS
# y el navegador recibe una respuesta sin Access-Control-Allow-Origin.
def _cors_headers(request: Request) -> dict:
    origin = request.headers.get("origin", "")
    allowed = origin if origin in _origins else (_origins[0] if _origins else "*")
    return {
        "Access-Control-Allow-Origin": allowed,
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
        "Access-Control-Allow-Headers": "*",
    }


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={"detail": "Demasiados intentos, espera 15 minutos"},
        headers=_cors_headers(request),
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors()},
        headers=_cors_headers(request),
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    msg = str(exc)
    if "451" in msg or "restricted location" in msg:
        detail = "Binance no está disponible desde esta región (servidor en EE.UU.). Usa Coinbase, Kraken o Gate.io."
        status = 503
    else:
        detail = msg
        status = 500
    return JSONResponse(
        status_code=status,
        content={"detail": detail},
        headers=_cors_headers(request),
    )


app.include_router(auth.router)
app.include_router(exchanges.router)
app.include_router(markets.router)
app.include_router(orders.router)
app.include_router(portfolio.router)
app.include_router(signals.router)
app.include_router(bots.router)
app.include_router(predictions.router)
app.include_router(subscriptions.router)
app.include_router(admin.router)
app.include_router(backtest.router)
app.include_router(currency.router)
app.include_router(news.router)
app.include_router(exchange_keys.router)
app.include_router(stripe_webhook.router)


@app.middleware("http")
async def request_context_middleware(request: Request, call_next):
    from app.services.audit_service import set_request_ip
    forwarded = request.headers.get("X-Forwarded-For")
    ip = forwarded.split(",")[0].strip() if forwarded else (
        request.client.host if request.client else None
    )
    set_request_ip(ip)
    return await call_next(request)


@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"]  = "nosniff"
    response.headers["X-Frame-Options"]         = "DENY"
    response.headers["X-XSS-Protection"]        = "1; mode=block"
    response.headers["Referrer-Policy"]         = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"]      = "camera=(), microphone=(), geolocation=()"
    response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload"
    return response


@app.get("/")
async def root():
    return {"message": "Stock App API — Bolsas Globales", "version": "2.0.0"}


@app.get("/health")
async def health():
    return {"status": "ok"}
