"""Gestión de suscripciones SaaS con persistencia PostgreSQL/SQLite."""
import uuid
from datetime import datetime, timezone

from app.database import get_session
from app.models.orm import User

PLANES = {
    "free": {
        "id": "free", "nombre": "Free", "precio_eur": 0,
        "max_bots": 1, "trading_real": False, "predicciones_ia": False,
        "trial_days": 0,
        "descripcion": "Empieza gratis. 1 bot en sandbox, mercados y señales en solo lectura.",
        "features": [
            "1 bot (solo sandbox)",
            "Mercados en tiempo real (4 exchanges)",
            "Señales técnicas RSI / MACD / BB",
            "Portfolio en modo lectura",
            "Feed de noticias cripto",
        ],
    },
    "pro": {
        "id": "pro", "nombre": "Pro", "precio_eur": 9.99,
        "max_bots": 5, "trading_real": True, "predicciones_ia": False,
        "trial_days": 7,
        "descripcion": "Trading real con 5 bots, señales avanzadas y análisis de mercado.",
        "features": [
            "7 días gratis sin tarjeta",
            "5 bots (real + sandbox)",
            "Trading real en Binance, Coinbase, Kraken y Gate.io",
            "Señales RSI / MACD / Bollinger",
            "Portfolio con P&L en EUR",
            "Backtesting de estrategias",
            "Integración con TradingView",
            "Feed de noticias cripto en tiempo real",
            "Alertas por email",
        ],
    },
    "pro_plus": {
        "id": "pro_plus", "nombre": "Pro+", "precio_eur": 19.99,
        "max_bots": -1, "trading_real": True, "predicciones_ia": True,
        "trial_days": 7,
        "descripcion": "El plan definitivo: bots ilimitados, IA predictiva y todas las herramientas.",
        "features": [
            "7 días gratis sin tarjeta",
            "Bots ilimitados (real + sandbox)",
            "Bot IA Dinámico (selección automática top criptos)",
            "Predicciones IA con modelo GBR + LSTM-style",
            "Todo lo incluido en Pro",
            "Integración con TradingView (avanzada)",
            "Feed de noticias cripto + alertas IA",
            "Acceso anticipado a nuevas funciones",
            "Soporte prioritario 24/7",
        ],
    },
}

_DEMO_ID = "demo"


# ── Init del usuario demo ──────────────────────────────────────────────────────

def ensure_demo_user() -> None:
    """Crea el usuario demo si no existe en la BD."""
    with get_session() as s:
        if s.get(User, _DEMO_ID):
            return
        s.add(User(
            id=_DEMO_ID, email="demo@cryptoapp.es", nombre="Demo User",
            plan="pro_plus", activo=True,
            creado_en=datetime.now(timezone.utc).isoformat(),
            proxima_factura="2026-06-11",
            email_verificado=True,
        ))


# ── Helpers ────────────────────────────────────────────────────────────────────

def get_planes() -> list[dict]:
    return list(PLANES.values())


def get_plan(plan_id: str) -> dict:
    if plan_id not in PLANES:
        raise ValueError(f"Plan '{plan_id}' no existe")
    return PLANES[plan_id]


def _enrich(u: User) -> dict:
    d = u.to_dict()
    d["plan_detalle"] = PLANES.get(d["plan"], PLANES["free"])
    return d


def get_usuario(user_id: str = _DEMO_ID) -> dict:
    with get_session() as s:
        u = s.get(User, user_id)
        if not u:
            raise ValueError("Usuario no encontrado")
        return _enrich(u)


def cambiar_plan(nuevo_plan: str, user_id: str = _DEMO_ID) -> dict:
    if nuevo_plan not in PLANES:
        raise ValueError(f"Plan '{nuevo_plan}' no existe")
    with get_session() as s:
        u = s.get(User, user_id)
        if not u:
            raise ValueError("Usuario no encontrado")
        u.plan = nuevo_plan
    return get_usuario(user_id)


def crear_usuario(email: str, nombre: str, plan: str = "free") -> dict:
    uid = str(uuid.uuid4())[:8]
    with get_session() as s:
        s.add(User(
            id=uid, email=email, nombre=nombre, plan=plan,
            activo=True, creado_en=datetime.now(timezone.utc).isoformat(),
        ))
    return get_usuario(uid)


def _get_plan_field(user_id: str, field: str, default):
    with get_session() as s:
        u = s.get(User, user_id)
        if not u:
            return default
        return PLANES.get(u.plan, {}).get(field, default)


def puede_usar_ia(user_id: str = _DEMO_ID) -> bool:
    return _get_plan_field(user_id, "predicciones_ia", False)


def puede_trading_real(user_id: str = _DEMO_ID) -> bool:
    return _get_plan_field(user_id, "trading_real", False)


def max_bots(user_id: str = _DEMO_ID) -> int:
    return _get_plan_field(user_id, "max_bots", 1)


# ── Admin: gestión completa de usuarios ───────────────────────────────────────

def admin_list_users() -> list[dict]:
    """Devuelve todos los usuarios con sus detalles."""
    with get_session() as s:
        users = s.query(User).order_by(User.creado_en.desc()).all()
        return [_enrich(u) for u in users]


def admin_get_user(user_id: str) -> dict:
    with get_session() as s:
        u = s.get(User, user_id)
        if not u:
            raise ValueError("Usuario no encontrado")
        return _enrich(u)


def admin_update_plan(user_id: str, nuevo_plan: str) -> dict:
    if nuevo_plan not in PLANES:
        raise ValueError(f"Plan '{nuevo_plan}' no existe")
    with get_session() as s:
        u = s.get(User, user_id)
        if not u:
            raise ValueError("Usuario no encontrado")
        u.plan = nuevo_plan
    return admin_get_user(user_id)


def admin_toggle_status(user_id: str) -> dict:
    with get_session() as s:
        u = s.get(User, user_id)
        if not u:
            raise ValueError("Usuario no encontrado")
        u.activo = not u.activo
    return admin_get_user(user_id)


def admin_toggle_admin(user_id: str, requesting_admin_id: str) -> dict:
    if user_id == requesting_admin_id:
        raise ValueError("No puedes modificar tu propio rol de administrador")
    with get_session() as s:
        u = s.get(User, user_id)
        if not u:
            raise ValueError("Usuario no encontrado")
        u.is_admin = not u.is_admin
    return admin_get_user(user_id)


def admin_delete_user(user_id: str, requesting_admin_id: str) -> None:
    if user_id == requesting_admin_id:
        raise ValueError("No puedes eliminar tu propia cuenta de administrador")
    if user_id == _DEMO_ID:
        raise ValueError("No se puede eliminar el usuario demo")
    with get_session() as s:
        u = s.get(User, user_id)
        if not u:
            raise ValueError("Usuario no encontrado")
        s.delete(u)


def admin_reset_user_password(user_id: str) -> str:
    """Genera un token de reset sin necesitar el email del usuario."""
    from datetime import timedelta
    import secrets
    with get_session() as s:
        u = s.get(User, user_id)
        if not u:
            raise ValueError("Usuario no encontrado")
        reset_token = secrets.token_urlsafe(32)
        expiry = (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()
        u.token_reset_pass = reset_token
        u.token_reset_expiry = expiry
    return reset_token


def ensure_admin_from_env() -> None:
    """Si ADMIN_EMAIL está configurado, promueve ese usuario a admin."""
    from app.config import get_settings
    admin_email = get_settings().admin_email.strip().lower()
    if not admin_email:
        return
    with get_session() as s:
        u = s.query(User).filter(User.email == admin_email).first()
        if u and not u.is_admin:
            u.is_admin = True
            print(f"[Admin] {admin_email} promovido a administrador.")


# ── Métricas de admin ──────────────────────────────────────────────────────────

def metricas_admin() -> dict:
    from app.services import bot_service

    # Convertir a dicts dentro de la sesión para evitar DetachedInstanceError
    with get_session() as s:
        usuarios = [u.to_dict() for u in s.query(User).all()]

    bots    = bot_service.list_bots()
    activos = sum(1 for b in bots if b["status"] == "running")
    trades  = sum(len(b["trades"]) for b in bots)

    dist = {"free": 0, "pro": 0, "pro_plus": 0}
    for u in usuarios:
        dist[u["plan"]] = dist.get(u["plan"], 0) + 1

    ingresos_mes = dist["pro"] * 9.99 + dist["pro_plus"] * 19.99
    actividad = [
        {"dia": d, "bots_activos": max(activos, 1), "trades": trades // 7 + i}
        for i, d in enumerate(["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Hoy"])
    ]
    actividad[-1]["bots_activos"] = activos
    actividad[-1]["trades"] = trades

    return {
        "usuarios_total": len(usuarios),
        "usuarios_activos": sum(1 for u in usuarios if u["activo"]),
        "distribucion_planes": dist,
        "ingresos_mes_eur": round(ingresos_mes, 2),
        "ingresos_arr_eur": round(ingresos_mes * 12, 2),
        "bots_total": len(bots),
        "bots_activos": activos,
        "trades_total": trades,
        "actividad_semanal": actividad,
        "usuarios_recientes": [
            {"email": u["email"], "plan": u["plan"], "creado_en": u["creado_en"]}
            for u in usuarios[-5:]
        ],
    }
