from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError

security = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    from app.config import get_settings
    settings = get_settings()
    token = credentials.credentials
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
        user_id: str = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")
        if payload.get("totp_pending"):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                                detail="Verificación 2FA pendiente")
        return payload
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido o expirado")


def get_admin_user(
    current_user: dict = Depends(get_current_user),
) -> dict:
    """Verifica en BD que el usuario es admin. Lanza 403 si no lo es."""
    from app.database import get_session
    from app.models.orm import User
    with get_session() as s:
        u = s.get(User, current_user["sub"])
        if not u or not u.is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acceso restringido. Se requieren privilegios de administrador.",
            )
    return current_user
