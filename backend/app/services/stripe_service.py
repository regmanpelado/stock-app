"""Integración con Stripe Billing — Checkout, webhooks y métricas."""
import stripe as _stripe

from app.config import get_settings


def _api() -> _stripe:
    _stripe.api_key = get_settings().stripe_secret_key
    return _stripe


PLAN_MAP = {
    "pro":      lambda: get_settings().stripe_price_pro,
    "pro_plus": lambda: get_settings().stripe_price_pro_plus,
}


# ── Checkout ───────────────────────────────────────────────────────────────────

def create_checkout_session(user_id: str, user_email: str, plan: str) -> str:
    """Crea una sesión de Stripe Checkout. Devuelve la URL de pago."""
    st       = _api()
    settings = get_settings()
    price_id = PLAN_MAP.get(plan, lambda: "")()

    if not settings.stripe_secret_key:
        raise ValueError("Stripe no está configurado. Contacta con el administrador.")
    if not price_id:
        raise ValueError(f"El plan '{plan}' no tiene precio de Stripe configurado.")

    # Reutiliza el customer si ya existe
    from app.database import get_session
    from app.models.orm import User
    customer_id = None
    with get_session() as db:
        u = db.query(User).filter(User.id == user_id).first()
        if u:
            customer_id = u.stripe_customer_id

    app_url = settings.app_url.rstrip("/")
    kwargs  = {
        "line_items":          [{"price": price_id, "quantity": 1}],
        "mode":                "subscription",
        "success_url":         f"{app_url}/payment/success?session_id={{CHECKOUT_SESSION_ID}}",
        "cancel_url":          f"{app_url}/payment/cancel",
        "metadata":            {"user_id": user_id, "plan": plan},
        "subscription_data":   {"metadata": {"user_id": user_id, "plan": plan}},
        "allow_promotion_codes": True,
    }
    if customer_id:
        kwargs["customer"] = customer_id
    else:
        kwargs["customer_email"] = user_email

    session = st.checkout.Session.create(**kwargs)
    return session.url


# ── Webhook handlers ───────────────────────────────────────────────────────────

def handle_checkout_completed(session: dict) -> None:
    """Pago inicial completado — activa el plan."""
    meta    = session.get("metadata") or {}
    user_id = meta.get("user_id")
    plan    = meta.get("plan")
    if not user_id or not plan:
        print(f"[Stripe] checkout sin user_id/plan en metadata: {meta}", flush=True)
        return

    _activate_plan(user_id, plan,
                   session.get("customer"),
                   session.get("subscription"))


def handle_subscription_updated(subscription: dict) -> None:
    """Renovación, cambio de plan o reactivación."""
    meta    = subscription.get("metadata") or {}
    user_id = meta.get("user_id")
    if not user_id:
        return

    status = subscription.get("status")
    if status not in ("active", "trialing"):
        _downgrade_to_free(user_id)
        return

    settings = get_settings()
    try:
        price_id = subscription["items"]["data"][0]["price"]["id"]
    except (KeyError, IndexError, TypeError):
        price_id = ""
    plan = "pro_plus" if price_id == settings.stripe_price_pro_plus else "pro"
    _activate_plan(user_id, plan, subscription.get("customer"), subscription.get("id"))


def handle_subscription_deleted(subscription: dict) -> None:
    """Cancelación — downgrade a free."""
    meta    = subscription.get("metadata") or {}
    user_id = meta.get("user_id")
    if user_id:
        _downgrade_to_free(user_id)


def handle_payment_failed(invoice: dict) -> None:
    """Pago fallido — notifica al admin por email."""
    customer_email = invoice.get("customer_email", "desconocido")
    amount         = invoice.get("amount_due", 0) / 100
    try:
        from app.config import get_settings as _gs
        from app.services.email_service import _send_security_email
        admin_email = _gs().admin_email
        if admin_email:
            _send_security_email(
                admin_email,
                f"[Crypto App] Pago fallido — {customer_email}",
                f"""<div style="font-family:sans-serif;padding:24px;background:#0f172a;
                    color:#e2e8f0;border-radius:12px;border-left:4px solid #ef4444">
                  <h2 style="color:#ef4444">Pago fallido</h2>
                  <p>Cliente: <strong>{customer_email}</strong></p>
                  <p>Importe: <strong>€{amount:.2f}</strong></p>
                  <p style="color:#64748b;font-size:12px">Crypto App · Stripe</p>
                </div>""",
            )
    except Exception:
        pass


# ── Métricas Stripe ────────────────────────────────────────────────────────────

def get_stripe_metrics() -> dict:
    """Devuelve métricas reales de Stripe: MRR, suscriptores, pagos recientes."""
    settings = get_settings()
    if not settings.stripe_secret_key:
        return {"configured": False}

    st = _api()
    try:
        # Suscripciones activas
        subs = list(st.Subscription.list(status="active", limit=100, expand=["data.items.data.price"]).auto_paging_iter())
        mrr  = sum(
            s["items"]["data"][0]["price"]["unit_amount"] / 100
            for s in subs
            if s["items"]["data"]
        )
        pro_count      = sum(1 for s in subs if s["items"]["data"][0]["price"]["id"] == settings.stripe_price_pro)
        pro_plus_count = sum(1 for s in subs if s["items"]["data"][0]["price"]["id"] == settings.stripe_price_pro_plus)

        # Últimos 10 pagos
        invoices = st.Invoice.list(limit=10, status="paid")
        recent   = [
            {
                "email":  inv.get("customer_email"),
                "amount": inv["amount_paid"] / 100,
                "date":   inv["created"],
            }
            for inv in invoices.data
        ]

        return {
            "configured":    True,
            "mrr":           round(mrr, 2),
            "arr":           round(mrr * 12, 2),
            "subscribers":   len(subs),
            "pro_count":     pro_count,
            "pro_plus_count": pro_plus_count,
            "recent_payments": recent,
        }
    except Exception as e:
        return {"configured": True, "error": str(e)}


# ── Helpers internos ───────────────────────────────────────────────────────────

def _activate_plan(user_id: str, plan: str, customer_id: str | None,
                   subscription_id: str | None) -> None:
    from app.database import get_session
    from app.models.orm import User
    from app.services.audit_service import log as audit_log

    with get_session() as db:
        u = db.query(User).filter(User.id == user_id).first()
        if not u:
            return
        u.plan                  = plan
        u.stripe_customer_id    = customer_id or u.stripe_customer_id
        u.stripe_subscription_id = subscription_id or u.stripe_subscription_id

    audit_log("PLAN_CHANGED", user_id=user_id,
              details={"new_plan": plan, "source": "stripe",
                       "subscription_id": subscription_id})


def _downgrade_to_free(user_id: str) -> None:
    from app.database import get_session
    from app.models.orm import User
    from app.services.audit_service import log as audit_log

    with get_session() as db:
        u = db.query(User).filter(User.id == user_id).first()
        if not u:
            return
        u.plan                  = "free"
        u.stripe_subscription_id = None

    audit_log("PLAN_CHANGED", user_id=user_id,
              details={"new_plan": "free", "source": "stripe_cancelled"})
