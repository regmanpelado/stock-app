from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.dependencies import get_admin_user, get_current_user
from app.services import subscription_service, audit_service, totp_service
from app.database import get_session
from app.models.orm import User

router = APIRouter(prefix="/admin", tags=["admin"])


class PlanUpdate(BaseModel):
    plan: str

class TotpCodeRequest(BaseModel):
    code: str


# ── 2FA personal del admin ────────────────────────────────────────────────────

@router.get("/2fa/status")
def get_2fa_status(admin: dict = Depends(get_admin_user)):
    with get_session() as s:
        u = s.get(User, admin["sub"])
        if not u:
            raise HTTPException(404, "Usuario no encontrado")
        return {
            "totp_enabled":        bool(u.totp_enabled),
            "backup_codes_left":   totp_service.backup_codes_remaining(u.totp_backup_hash),
        }


@router.get("/2fa/setup")
def get_2fa_setup(admin: dict = Depends(get_admin_user)):
    """Genera (o regenera) el secreto TOTP y devuelve el URI para el QR. No activa 2FA aún."""
    with get_session() as s:
        u = s.get(User, admin["sub"])
        if not u:
            raise HTTPException(404, "Usuario no encontrado")
        if u.totp_enabled:
            raise HTTPException(400, "El 2FA ya está activo. Desactívalo primero.")
        secret = totp_service.generate_secret()
        u.totp_secret  = secret
        u.totp_enabled = False
    uri = totp_service.get_totp_uri(secret, admin["email"])
    return {"secret": secret, "totp_uri": uri}


@router.post("/2fa/enable")
def enable_2fa(req: TotpCodeRequest, admin: dict = Depends(get_admin_user)):
    """Verifica el primer código TOTP y activa 2FA. Devuelve los códigos de respaldo (única vez)."""
    with get_session() as s:
        u = s.get(User, admin["sub"])
        if not u or not u.totp_secret:
            raise HTTPException(400, "Primero genera el QR en /admin/2fa/setup.")
        if u.totp_enabled:
            raise HTTPException(400, "El 2FA ya está activo.")
        if not totp_service.verify_totp(u.totp_secret, req.code):
            raise HTTPException(401, "Código incorrecto. Comprueba tu app de autenticación.")
        plain_codes, hashes_json = totp_service.generate_backup_codes()
        u.totp_enabled     = True
        u.totp_backup_hash = hashes_json
    audit_service.log("2FA_ENABLED", user_id=admin["sub"], user_email=admin.get("email"))
    return {"ok": True, "backup_codes": plain_codes}


@router.post("/2fa/disable")
def disable_2fa(req: TotpCodeRequest, admin: dict = Depends(get_admin_user)):
    """Desactiva 2FA verificando el código TOTP actual o un código de respaldo."""
    with get_session() as s:
        u = s.get(User, admin["sub"])
        if not u or not u.totp_enabled or not u.totp_secret:
            raise HTTPException(400, "El 2FA no está activo.")
        code_clean = req.code.strip().replace(" ", "")
        ok = totp_service.verify_totp(u.totp_secret, code_clean)
        if not ok and u.totp_backup_hash:
            valid, remaining = totp_service.verify_backup_code(code_clean, u.totp_backup_hash)
            ok = valid
        if not ok:
            raise HTTPException(401, "Código incorrecto.")
        u.totp_enabled     = False
        u.totp_secret      = None
        u.totp_backup_hash = None
    audit_service.log("2FA_DISABLED", user_id=admin["sub"], user_email=admin.get("email"))
    return {"ok": True}


@router.post("/2fa/backup-codes/regenerate")
def regenerate_backup_codes(req: TotpCodeRequest, admin: dict = Depends(get_admin_user)):
    """Regenera los códigos de respaldo verificando el código TOTP actual."""
    with get_session() as s:
        u = s.get(User, admin["sub"])
        if not u or not u.totp_enabled or not u.totp_secret:
            raise HTTPException(400, "El 2FA no está activo.")
        if not totp_service.verify_totp(u.totp_secret, req.code.strip()):
            raise HTTPException(401, "Código incorrecto.")
        plain_codes, hashes_json = totp_service.generate_backup_codes()
        u.totp_backup_hash = hashes_json
    audit_service.log("2FA_BACKUP_REGENERATED", user_id=admin["sub"], user_email=admin.get("email"))
    return {"ok": True, "backup_codes": plain_codes}


# ── Dashboard ──────────────────────────────────────────────────────────────────

@router.get("/metricas")
def get_metricas(_: dict = Depends(get_admin_user)):
    return subscription_service.metricas_admin()


@router.get("/stripe-metrics")
def get_stripe_metrics(_: dict = Depends(get_admin_user)):
    from app.services.stripe_service import get_stripe_metrics
    return get_stripe_metrics()


# ── Audit Log ─────────────────────────────────────────────────────────────────

@router.get("/audit-log")
def get_audit_log(
    admin: dict = Depends(get_admin_user),
    user_id:   str | None = Query(None),
    action:    str | None = Query(None),
    date_from: str | None = Query(None),
    date_to:   str | None = Query(None),
    limit:     int        = Query(50, ge=1, le=200),
    offset:    int        = Query(0,  ge=0),
):
    rows  = audit_service.query_logs(user_id, action, date_from, date_to, limit, offset)
    total = audit_service.count_logs(user_id, action, date_from, date_to)
    return {"total": total, "offset": offset, "limit": limit, "rows": rows}


# ── Gestión de usuarios ────────────────────────────────────────────────────────

@router.get("/users")
def list_users(_: dict = Depends(get_admin_user)):
    return subscription_service.admin_list_users()


@router.get("/users/{user_id}")
def get_user(user_id: str, _: dict = Depends(get_admin_user)):
    try:
        return subscription_service.admin_get_user(user_id)
    except ValueError as e:
        raise HTTPException(404, str(e))


@router.put("/users/{user_id}/plan")
def update_plan(user_id: str, body: PlanUpdate, admin: dict = Depends(get_admin_user)):
    try:
        result = subscription_service.admin_update_plan(user_id, body.plan)
        audit_service.log("PLAN_CHANGED", user_id=admin["sub"],
                          user_email=admin.get("email"),
                          details={"target_user_id": user_id, "new_plan": body.plan})
        return result
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.put("/users/{user_id}/status")
def toggle_status(user_id: str, admin: dict = Depends(get_admin_user)):
    try:
        result = subscription_service.admin_toggle_status(user_id)
        action = "USER_ACTIVATED" if result.get("activo") else "USER_DEACTIVATED"
        audit_service.log(action, user_id=admin["sub"],
                          user_email=admin.get("email"),
                          details={"target_user_id": user_id,
                                   "target_email": result.get("email")})
        return result
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.put("/users/{user_id}/admin")
def toggle_admin(user_id: str, admin: dict = Depends(get_admin_user)):
    try:
        result = subscription_service.admin_toggle_admin(user_id, admin["sub"])
        action = "ADMIN_PROMOTED" if result.get("is_admin") else "ADMIN_REVOKED"
        audit_service.log(action, user_id=admin["sub"],
                          user_email=admin.get("email"),
                          details={"target_user_id": user_id,
                                   "target_email": result.get("email")})
        return result
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.delete("/users/{user_id}")
def delete_user(user_id: str, admin: dict = Depends(get_admin_user)):
    try:
        # Captura el email antes de borrar
        try:
            target = subscription_service.admin_get_user(user_id)
            target_email = target.get("email")
        except Exception:
            target_email = None
        subscription_service.admin_delete_user(user_id, admin["sub"])
        audit_service.log("USER_DELETED", user_id=admin["sub"],
                          user_email=admin.get("email"),
                          details={"target_user_id": user_id,
                                   "target_email": target_email})
        return {"ok": True}
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.post("/users/{user_id}/verify-email")
def admin_verify_email(user_id: str, admin: dict = Depends(get_admin_user)):
    """Verifica manualmente el email de un usuario (sin necesidad de SMTP)."""
    with get_session() as s:
        u = s.get(User, user_id)
        if not u:
            raise HTTPException(404, "Usuario no encontrado")
        if u.email_verificado:
            return {"ok": True, "message": "El email ya estaba verificado"}
        u.email_verificado     = True
        u.token_verificacion   = None
        target_email           = u.email
    audit_service.log("EMAIL_VERIFIED_ADMIN", user_id=admin["sub"],
                      user_email=admin.get("email"),
                      details={"target_user_id": user_id, "target_email": target_email})
    return {"ok": True, "message": f"Email de {target_email} verificado correctamente"}


@router.post("/users/{user_id}/reset-password")
def admin_reset_password(user_id: str, admin: dict = Depends(get_admin_user)):
    try:
        token = subscription_service.admin_reset_user_password(user_id)
        from app.config import get_settings
        settings = get_settings()
        reset_url = f"{settings.app_url}/reset-password?token={token}"
        try:
            target = subscription_service.admin_get_user(user_id)
            target_email = target.get("email")
        except Exception:
            target_email = None
        audit_service.log("PASSWORD_RESET", user_id=admin["sub"],
                          user_email=admin.get("email"),
                          details={"target_user_id": user_id,
                                   "target_email": target_email})
        return {"ok": True, "reset_url": reset_url, "token": token}
    except ValueError as e:
        raise HTTPException(400, str(e))
