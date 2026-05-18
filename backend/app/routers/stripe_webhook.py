"""Webhook de Stripe — endpoint público, verificado por firma."""
import json
import stripe
from fastapi import APIRouter, Request, HTTPException

from app.config import get_settings

router = APIRouter(prefix="/stripe", tags=["stripe"])


@router.post("/webhook")
async def stripe_webhook(request: Request):
    payload    = await request.body()
    sig_header = request.headers.get("stripe-signature", "")
    secret     = get_settings().stripe_webhook_secret

    if not secret:
        raise HTTPException(500, "Webhook secret no configurado")

    # Verificar firma de Stripe
    try:
        stripe.Webhook.construct_event(payload, sig_header, secret)
    except Exception as e:
        print(f"[Stripe] Firma inválida: {type(e).__name__}: {e}", flush=True)
        raise HTTPException(400, "Firma de webhook inválida")

    # Parsear el payload como JSON plano (evita problemas con StripeObject en 8.x)
    try:
        event = json.loads(payload)
    except Exception as e:
        raise HTTPException(400, f"JSON inválido: {e}")

    etype = event.get("type", "")
    data  = event.get("data", {}).get("object", {})

    print(f"[Stripe] Webhook: {etype}", flush=True)

    from app.services import stripe_service
    try:
        if etype == "checkout.session.completed":
            stripe_service.handle_checkout_completed(data)
            meta = data.get("metadata") or {}
            print(f"[Stripe] OK — user={meta.get('user_id')} plan={meta.get('plan')}", flush=True)
        elif etype in ("customer.subscription.updated", "customer.subscription.created"):
            stripe_service.handle_subscription_updated(data)
        elif etype == "customer.subscription.deleted":
            stripe_service.handle_subscription_deleted(data)
        elif etype == "invoice.payment_failed":
            stripe_service.handle_payment_failed(data)
    except Exception as exc:
        import traceback
        print(f"[Stripe] ERROR en {etype}: {type(exc).__name__}: {exc}", flush=True)
        print(traceback.format_exc(), flush=True)
        raise HTTPException(500, str(exc))

    return {"received": True}
