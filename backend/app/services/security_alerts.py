"""
Alertas de seguridad por email:
- >3 intentos de login fallidos desde la misma IP en 10 minutos
- Login exitoso desde una IP nueva para ese usuario
"""
import threading
import time
from collections import defaultdict

FAILED_WINDOW   = 600   # 10 minutos
FAILED_THRESHOLD = 3
ALERT_COOLDOWN  = 1800  # no repetir alerta para la misma IP antes de 30 min

_lock          = threading.Lock()
_failed: dict[str, list[float]] = defaultdict(list)   # ip → [timestamps]
_alerted: dict[str, float]      = {}                   # ip → last alert timestamp


# ── Intentos fallidos ──────────────────────────────────────────────────────────

def track_failed_login(ip: str | None, email_tried: str) -> None:
    """Registra un intento fallido. Envía alerta si se supera el umbral."""
    if not ip:
        return
    now = time.time()
    with _lock:
        _failed[ip] = [t for t in _failed[ip] if now - t < FAILED_WINDOW]
        _failed[ip].append(now)
        count = len(_failed[ip])
        last  = _alerted.get(ip, 0)
        should_alert = count >= FAILED_THRESHOLD and (now - last) > ALERT_COOLDOWN
        if should_alert:
            _alerted[ip] = now

    if should_alert:
        _fire_failed_alert(ip, email_tried, count)


def _fire_failed_alert(ip: str, email_tried: str, count: int) -> None:
    try:
        from app.config import get_settings
        from app.services.email_service import send_failed_login_alert
        admin_email = get_settings().admin_email
        if admin_email:
            send_failed_login_alert(admin_email, ip, count, email_tried)
    except Exception as e:
        print(f"[SecurityAlert] Error enviando alerta de intentos fallidos: {e}")


# ── IP nueva ───────────────────────────────────────────────────────────────────

def check_new_ip(user_id: str, user_email: str, ip: str | None) -> None:
    """Compara la IP actual con logins anteriores. Alerta si es nueva."""
    if not ip:
        return
    try:
        from app.services.audit_service import query_logs
        # Coge hasta 100 logins exitosos anteriores para construir IPs conocidas
        past = query_logs(user_id=user_id, action="LOGIN_OK", limit=100)
        known_ips = {r["ip"] for r in past if r["ip"]}

        # Solo alerta si el usuario ya había iniciado sesión antes (evita falsos positivos)
        if not known_ips:
            return
        if ip in known_ips:
            return

        _fire_new_ip_alert(user_email, ip)
    except Exception as e:
        print(f"[SecurityAlert] Error comprobando IP nueva: {e}")


def _fire_new_ip_alert(user_email: str, ip: str) -> None:
    try:
        from app.config import get_settings
        from app.services.email_service import send_new_ip_alert
        admin_email = get_settings().admin_email
        if admin_email:
            send_new_ip_alert(admin_email, user_email, ip)
    except Exception as e:
        print(f"[SecurityAlert] Error enviando alerta de IP nueva: {e}")
