"""Lógica de autenticación: registro, login, verificación de email y reset de contraseña."""
import re
import secrets
import uuid
from datetime import datetime, timezone, timedelta

import bcrypt as _bcrypt
from jose import jwt

from app.database import get_session
from app.models.orm import User


def hash_password(password: str) -> str:
    return _bcrypt.hashpw(password.encode("utf-8"), _bcrypt.gensalt(rounds=12)).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    return _bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))


def _get_settings():
    from app.config import get_settings
    return get_settings()


def _validate_password(password: str) -> None:
    """Lanza ValueError si la contraseña no cumple la política de seguridad."""
    if len(password) < 8:
        raise ValueError("La contraseña debe tener al menos 8 caracteres")
    if not re.search(r"[A-Z]", password):
        raise ValueError("La contraseña debe contener al menos una letra mayúscula")
    if not re.search(r"[a-z]", password):
        raise ValueError("La contraseña debe contener al menos una letra minúscula")
    if not re.search(r"\d", password):
        raise ValueError("La contraseña debe contener al menos un número")
    if not re.search(r"[!@#$%^&*(),.?\":{}|<>_\-+=\[\]\\;'/`~]", password):
        raise ValueError("La contraseña debe contener al menos un carácter especial (!@#$%...)")


SESSION_MINUTES = 30  # sliding window — renovable en cada petición


def create_access_token(user_id: str, email: str, is_admin: bool = False) -> str:
    settings = _get_settings()
    now = datetime.now(timezone.utc)
    return jwt.encode(
        {
            "sub":      user_id,
            "email":    email,
            "is_admin": is_admin,
            "iat":      int(now.timestamp()),
            "jti":      secrets.token_hex(16),
            "exp":      now + timedelta(minutes=SESSION_MINUTES),
        },
        settings.jwt_secret,
        algorithm="HS256",
    )


def refresh_session(user_id: str, is_admin: bool, email: str) -> str:
    """Emite un nuevo token de 30 min verificando que el usuario sigue activo en BD."""
    with get_session() as s:
        u = s.get(User, user_id)
        if not u or not u.activo:
            raise ValueError("Cuenta inactiva o no encontrada")
        return create_access_token(u.id, u.email, is_admin=bool(u.is_admin))


def create_totp_pending_token(user_id: str, email: str) -> str:
    """Token de vida corta (5 min) exclusivo para la verificación 2FA. No da acceso a la API."""
    settings = _get_settings()
    now = datetime.now(timezone.utc)
    return jwt.encode(
        {
            "sub": user_id,
            "email": email,
            "totp_pending": True,
            "iat": int(now.timestamp()),
            "exp": now + timedelta(minutes=5),
        },
        settings.jwt_secret,
        algorithm="HS256",
    )


def register_user(email: str, nombre: str, password: str) -> dict:
    from app.services.audit_service import log as audit_log
    _validate_password(password)
    with get_session() as s:
        existing = s.query(User).filter(User.email == email.lower().strip()).first()
        if existing:
            raise ValueError("Este email ya está registrado")
        uid = str(uuid.uuid4())
        token_ver = secrets.token_urlsafe(32)
        s.add(User(
            id=uid,
            email=email.lower().strip(),
            nombre=nombre.strip(),
            password_hash=hash_password(password),
            plan="free",
            activo=True,
            creado_en=datetime.now(timezone.utc).isoformat(),
            email_verificado=False,
            token_verificacion=token_ver,
        ))
    audit_log("REGISTER", user_id=uid, user_email=email.lower().strip(),
              details={"nombre": nombre.strip()})
    return {"id": uid, "email": email, "nombre": nombre, "token_verificacion": token_ver}


def verify_email_token(token: str) -> bool:
    with get_session() as s:
        u = s.query(User).filter(User.token_verificacion == token).first()
        if not u:
            return False
        u.email_verificado = True
        u.token_verificacion = None
        return True


def login_user(email: str, password: str) -> dict:
    from app.services.audit_service import log as audit_log
    clean_email = email.lower().strip()
    with get_session() as s:
        u = s.query(User).filter(User.email == clean_email).first()
        if not u or not u.password_hash:
            audit_log("LOGIN_FAIL", user_email=clean_email,
                      details={"reason": "user_not_found"})
            from app.services.security_alerts import track_failed_login
            from app.services.audit_service import get_request_ip
            track_failed_login(get_request_ip(), clean_email)
            raise ValueError("Credenciales incorrectas")
        if not verify_password(password, u.password_hash):
            audit_log("LOGIN_FAIL", user_id=u.id, user_email=u.email,
                      details={"reason": "wrong_password"})
            from app.services.security_alerts import track_failed_login
            from app.services.audit_service import get_request_ip
            track_failed_login(get_request_ip(), u.email)
            raise ValueError("Credenciales incorrectas")
        if not u.email_verificado:
            audit_log("LOGIN_FAIL", user_id=u.id, user_email=u.email,
                      details={"reason": "email_not_verified"})
            raise ValueError("Debes verificar tu email antes de iniciar sesión. Revisa tu bandeja de entrada.")
        if not u.activo:
            audit_log("LOGIN_FAIL", user_id=u.id, user_email=u.email,
                      details={"reason": "account_disabled"})
            raise ValueError("Cuenta desactivada. Contacta con soporte.")
        # Si el admin tiene 2FA activo, devuelve un token pendiente en lugar del acceso completo
        if u.is_admin and u.totp_enabled and u.totp_secret:
            pending = create_totp_pending_token(u.id, u.email)
            audit_log("LOGIN_2FA_REQUIRED", user_id=u.id, user_email=u.email)
            return {"requires_2fa": True, "totp_token": pending}

        token = create_access_token(u.id, u.email, is_admin=bool(u.is_admin))
        result = {"access_token": token, "token_type": "bearer", "user": u.to_dict()}
        audit_log("LOGIN_OK", user_id=u.id, user_email=u.email)
        from app.services.security_alerts import check_new_ip
        from app.services.audit_service import get_request_ip
        check_new_ip(u.id, u.email, get_request_ip())
        return result


def verify_2fa_login(totp_token: str, code: str) -> dict:
    """Segunda fase del login: verifica el código TOTP o un código de respaldo."""
    from app.services import totp_service
    from app.services.audit_service import log as audit_log
    settings = _get_settings()
    try:
        payload = jwt.decode(totp_token, settings.jwt_secret, algorithms=["HS256"])
    except Exception:
        raise ValueError("Token inválido o expirado. Inicia sesión de nuevo.")
    if not payload.get("totp_pending"):
        raise ValueError("Token inválido.")
    user_id = payload["sub"]

    with get_session() as s:
        u = s.get(User, user_id)
        if not u or not u.totp_enabled or not u.totp_secret:
            raise ValueError("2FA no está configurado en esta cuenta.")

        code_clean = code.strip().replace(" ", "")

        def _complete_2fa_login(user, method: str) -> dict:
            tok = create_access_token(user.id, user.email, is_admin=bool(user.is_admin))
            res = {"access_token": tok, "token_type": "bearer", "user": user.to_dict()}
            audit_log("LOGIN_OK", user_id=user.id, user_email=user.email,
                      details={"method": method})
            from app.services.security_alerts import check_new_ip
            from app.services.audit_service import get_request_ip
            check_new_ip(user.id, user.email, get_request_ip())
            return res

        # Intenta código TOTP normal
        if totp_service.verify_totp(u.totp_secret, code_clean):
            return _complete_2fa_login(u, "totp")

        # Intenta código de respaldo (8 hex chars)
        if u.totp_backup_hash:
            valid, remaining_json = totp_service.verify_backup_code(code_clean, u.totp_backup_hash)
            if valid:
                u.totp_backup_hash = remaining_json
                return _complete_2fa_login(u, "backup_code")

        audit_log("2FA_FAIL", user_id=u.id, user_email=u.email)
        raise ValueError("Código incorrecto. Comprueba tu app de autenticación.")


def request_password_reset(email: str) -> str | None:
    """Genera un token de reset. Devuelve el token o None si el email no existe."""
    with get_session() as s:
        u = s.query(User).filter(User.email == email.lower().strip()).first()
        if not u or not u.password_hash:
            return None
        reset_token = secrets.token_urlsafe(32)
        expiry = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
        u.token_reset_pass = reset_token
        u.token_reset_expiry = expiry
    return reset_token


def change_password(user_id: str, current_password: str, new_password: str) -> None:
    """Cambia la contraseña verificando la actual. Lanza ValueError si algo falla."""
    _validate_password(new_password)
    with get_session() as s:
        u = s.get(User, user_id)
        if not u or not u.password_hash:
            raise ValueError("Usuario no encontrado")
        if not verify_password(current_password, u.password_hash):
            raise ValueError("La contraseña actual es incorrecta")
        u.password_hash = hash_password(new_password)


def reset_password(token: str, new_password: str) -> bool:
    _validate_password(new_password)
    with get_session() as s:
        u = s.query(User).filter(User.token_reset_pass == token).first()
        if not u:
            return False
        if u.token_reset_expiry:
            expiry = datetime.fromisoformat(u.token_reset_expiry)
            if datetime.now(timezone.utc) > expiry:
                return False
        u.password_hash = hash_password(new_password)
        u.token_reset_pass = None
        u.token_reset_expiry = None
        return True
