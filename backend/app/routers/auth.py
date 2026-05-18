from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel

from app.dependencies import get_current_user
from app.limiter import limiter
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    email: str
    nombre: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    password: str


@router.post("/register", status_code=201)
@limiter.limit("5/15minutes")
def register(request: Request, req: RegisterRequest):
    try:
        result = auth_service.register_user(req.email, req.nombre, req.password)
    except ValueError as e:
        raise HTTPException(400, str(e))

    from app.config import get_settings
    settings = get_settings()
    verify_url = f"{settings.app_url}/verify-email?token={result['token_verificacion']}"
    try:
        from app.services.email_service import send_verification_email
        send_verification_email(req.email, req.nombre, verify_url)
    except Exception:
        pass  # email falla en silencio si no hay SMTP

    return {
        "message": "Registro exitoso. Revisa tu email para verificar tu cuenta.",
        "verify_url": verify_url,  # devuelto también para entornos sin SMTP
    }


@router.post("/login")
@limiter.limit("5/15minutes")
def login(request: Request, req: LoginRequest):
    try:
        return auth_service.login_user(req.email, req.password)
    except ValueError as e:
        raise HTTPException(401, str(e))


@router.get("/verify-email")
def verify_email(token: str):
    success = auth_service.verify_email_token(token)
    if not success:
        raise HTTPException(400, "Token de verificación inválido o ya utilizado")
    return {"message": "Email verificado correctamente. Ya puedes iniciar sesión."}


@router.post("/forgot-password")
def forgot_password(req: ForgotPasswordRequest):
    reset_token = auth_service.request_password_reset(req.email)
    if reset_token:
        from app.config import get_settings
        settings = get_settings()
        reset_url = f"{settings.app_url}/reset-password?token={reset_token}"
        try:
            from app.services.email_service import send_reset_email
            send_reset_email(req.email, reset_url)
        except Exception:
            pass
    # Siempre responde igual (no revelar si el email existe)
    return {"message": "Si el email existe, recibirás un enlace para restablecer la contraseña."}


@router.post("/reset-password")
def reset_password(req: ResetPasswordRequest):
    try:
        success = auth_service.reset_password(req.token, req.password)
    except ValueError as e:
        raise HTTPException(400, str(e))
    if not success:
        raise HTTPException(400, "Token inválido o expirado")
    return {"message": "Contraseña actualizada correctamente. Ya puedes iniciar sesión."}


@router.get("/me")
def get_me(current_user: dict = Depends(get_current_user)):
    from app.services import subscription_service
    try:
        return subscription_service.get_usuario(current_user["sub"])
    except ValueError:
        raise HTTPException(404, "Usuario no encontrado")


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


@router.post("/change-password")
def change_password(req: ChangePasswordRequest, current_user: dict = Depends(get_current_user)):
    try:
        auth_service.change_password(current_user["sub"], req.current_password, req.new_password)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {"message": "Contraseña actualizada correctamente"}


@router.post("/refresh")
def refresh_token(current_user: dict = Depends(get_current_user)):
    """Renueva la sesión activa emitiendo un nuevo JWT de 30 minutos."""
    try:
        new_token = auth_service.refresh_session(
            current_user["sub"],
            current_user.get("is_admin", False),
            current_user.get("email", ""),
        )
        return {"access_token": new_token, "token_type": "bearer"}
    except ValueError as e:
        raise HTTPException(401, str(e))


class Verify2FARequest(BaseModel):
    totp_token: str
    code: str


@router.post("/2fa/verify")
@limiter.limit("10/15minutes")
def verify_2fa(request: Request, req: Verify2FARequest):
    try:
        return auth_service.verify_2fa_login(req.totp_token, req.code)
    except ValueError as e:
        raise HTTPException(401, str(e))
