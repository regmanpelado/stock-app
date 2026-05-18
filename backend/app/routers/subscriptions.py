from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from app.dependencies import get_current_user
from app.services import subscription_service

router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])


class CambiarPlanRequest(BaseModel):
    plan: str


class CheckoutRequest(BaseModel):
    plan: str   # "pro" | "pro_plus"


@router.get("/planes")
def listar_planes():
    return subscription_service.get_planes()


@router.get("/usuario")
def get_usuario(current_user: dict = Depends(get_current_user)):
    try:
        return subscription_service.get_usuario(current_user["sub"])
    except ValueError as e:
        raise HTTPException(404, str(e))


@router.post("/usuario/plan")
def cambiar_plan(req: CambiarPlanRequest, current_user: dict = Depends(get_current_user)):
    try:
        return subscription_service.cambiar_plan(req.plan, current_user["sub"])
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.post("/checkout")
def create_checkout(req: CheckoutRequest, current_user: dict = Depends(get_current_user)):
    """Crea una sesión de Stripe Checkout y devuelve la URL de pago."""
    if req.plan not in ("pro", "pro_plus"):
        raise HTTPException(400, "Plan no válido para pago")
    try:
        from app.services.stripe_service import create_checkout_session
        url = create_checkout_session(
            user_id    = current_user["sub"],
            user_email = current_user.get("email", ""),
            plan       = req.plan,
        )
        return {"checkout_url": url}
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, str(e))


@router.get("/permisos")
def get_permisos(current_user: dict = Depends(get_current_user)):
    uid = current_user["sub"]
    return {
        "puede_ia":           subscription_service.puede_usar_ia(uid),
        "puede_trading_real": subscription_service.puede_trading_real(uid),
        "max_bots":           subscription_service.max_bots(uid),
    }
