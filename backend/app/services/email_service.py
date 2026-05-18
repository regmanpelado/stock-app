"""Envío de emails. Usa Brevo (API HTTP) si está configurado, SMTP como fallback."""
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

BREVO_API_KEY      = os.getenv("BREVO_API_KEY", "")
BREVO_SENDER_EMAIL = os.getenv("BREVO_SENDER_EMAIL", "")
BREVO_SENDER_NAME  = os.getenv("BREVO_SENDER_NAME", "Crypto App")

SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASS = os.getenv("SMTP_PASS", "")
SMTP_FROM = os.getenv("SMTP_FROM", "") or SMTP_USER


# ── Dispatcher ────────────────────────────────────────────────────────────────

def _send_email(to_addr: str, subject: str, html: str) -> bool:
    if BREVO_API_KEY:
        return _send_brevo(to_addr, subject, html)
    if SMTP_HOST:
        return _send_smtp(to_addr, subject, html)
    print(f"[Email] Sin proveedor. Para: {to_addr} | {subject}")
    return False


def _send_brevo(to_addr: str, subject: str, html: str) -> bool:
    try:
        import httpx
        r = httpx.post(
            "https://api.brevo.com/v3/smtp/email",
            headers={"api-key": BREVO_API_KEY, "Content-Type": "application/json"},
            json={
                "sender":      {"name": BREVO_SENDER_NAME, "email": BREVO_SENDER_EMAIL},
                "to":          [{"email": to_addr}],
                "subject":     subject,
                "htmlContent": html,
            },
            timeout=15,
        )
        if r.status_code in (200, 201):
            return True
        print(f"[Brevo] Error {r.status_code}: {r.text}")
        return False
    except Exception as e:
        print(f"[Brevo] Excepcion: {e}")
        return False


def _send_smtp(to_addr: str, subject: str, html: str) -> bool:
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"]    = SMTP_FROM
        msg["To"]      = to_addr
        msg.attach(MIMEText(html, "html"))
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as srv:
            srv.ehlo(); srv.starttls(); srv.login(SMTP_USER, SMTP_PASS)
            srv.sendmail(SMTP_FROM, to_addr, msg.as_string())
        return True
    except Exception as e:
        print(f"[SMTP] Error: {e}")
        return False


# Alias para alertas de seguridad (mantiene compatibilidad)
def _send_security_email(to_addr: str, subject: str, html: str) -> bool:
    return _send_email(to_addr, subject, html)


# ── Templates ─────────────────────────────────────────────────────────────────

def send_verification_email(to_addr: str, nombre: str, verify_url: str) -> bool:
    if not RESEND_API_KEY and not SMTP_HOST:
        print(f"[Auth] Verificacion para {to_addr}: {verify_url}")
        return False
    return _send_email(to_addr, "Verifica tu cuenta en Crypto App", f"""
<div style="font-family:sans-serif;max-width:480px;padding:24px;
            background:#0f172a;color:#e2e8f0;border-radius:12px;">
  <h2 style="color:#38bdf8;margin:0 0 16px">Verifica tu email</h2>
  <p>Hola <strong>{nombre}</strong>, gracias por registrarte en Crypto App.</p>
  <p>Haz clic en el boton de abajo para activar tu cuenta:</p>
  <a href="{verify_url}"
     style="display:inline-block;margin:16px 0;padding:12px 24px;
            background:#0284c7;color:white;border-radius:8px;
            text-decoration:none;font-weight:600;">
    Verificar email
  </a>
  <p style="color:#64748b;font-size:12px;">
    Si no te has registrado, ignora este mensaje.<br>
    El enlace caduca en 7 dias.
  </p>
</div>""")


def send_reset_email(to_addr: str, reset_url: str) -> bool:
    if not RESEND_API_KEY and not SMTP_HOST:
        print(f"[Auth] Reset para {to_addr}: {reset_url}")
        return False
    return _send_email(to_addr, "Restablece tu contrasena en Crypto App", f"""
<div style="font-family:sans-serif;max-width:480px;padding:24px;
            background:#0f172a;color:#e2e8f0;border-radius:12px;">
  <h2 style="color:#38bdf8;margin:0 0 16px">Restablecer contrasena</h2>
  <p>Recibimos una solicitud para restablecer tu contrasena.</p>
  <a href="{reset_url}"
     style="display:inline-block;margin:16px 0;padding:12px 24px;
            background:#dc2626;color:white;border-radius:8px;
            text-decoration:none;font-weight:600;">
    Restablecer contrasena
  </a>
  <p style="color:#64748b;font-size:12px;">
    Si no solicitaste el restablecimiento, ignora este mensaje.<br>
    El enlace caduca en 1 hora.
  </p>
</div>""")


def send_failed_login_alert(admin_email: str, ip: str, count: int,
                             email_tried: str) -> bool:
    from datetime import datetime, timezone
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    return _send_email(admin_email,
        f"[Crypto App] {count} intentos de login fallidos desde {ip}", f"""
<div style="font-family:sans-serif;max-width:520px;padding:24px;
            background:#0f172a;color:#e2e8f0;border-radius:12px;
            border-left:4px solid #ef4444;">
  <h2 style="color:#ef4444;margin:0 0 8px">Alerta de seguridad</h2>
  <table style="width:100%;border-collapse:collapse;font-size:14px">
    <tr><td style="color:#64748b;padding:8px 0;width:140px">IP origen</td>
        <td style="font-family:monospace;color:#fca5a5">{ip}</td></tr>
    <tr><td style="color:#64748b;padding:8px 0">Intentos</td>
        <td style="color:#ef4444;font-weight:700">{count} en 10 min</td></tr>
    <tr><td style="color:#64748b;padding:8px 0">Email</td>
        <td style="font-family:monospace">{email_tried}</td></tr>
    <tr><td style="color:#64748b;padding:8px 0">Hora</td>
        <td style="font-family:monospace">{ts}</td></tr>
  </table>
  <p style="margin-top:24px;color:#334155;font-size:11px">Crypto App</p>
</div>""")


def send_new_ip_alert(admin_email: str, user_email: str, ip: str) -> bool:
    from datetime import datetime, timezone
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    return _send_email(admin_email,
        f"[Crypto App] Login desde IP nueva - {user_email}", f"""
<div style="font-family:sans-serif;max-width:520px;padding:24px;
            background:#0f172a;color:#e2e8f0;border-radius:12px;
            border-left:4px solid #f59e0b;">
  <h2 style="color:#f59e0b;margin:0 0 8px">Login desde IP nueva</h2>
  <table style="width:100%;border-collapse:collapse;font-size:14px">
    <tr><td style="color:#64748b;padding:8px 0;width:140px">Usuario</td>
        <td style="font-family:monospace">{user_email}</td></tr>
    <tr><td style="color:#64748b;padding:8px 0">IP nueva</td>
        <td style="font-family:monospace;color:#fbbf24">{ip}</td></tr>
    <tr><td style="color:#64748b;padding:8px 0">Hora</td>
        <td style="font-family:monospace">{ts}</td></tr>
  </table>
  <p style="margin-top:24px;color:#334155;font-size:11px">Crypto App</p>
</div>""")


def send_alert_email(alert: dict, value: float) -> bool:
    to_addr = alert.get("email", "")
    if not to_addr:
        return False
    _TYPE_LABEL = {"price": "Precio", "pct_change": "Cambio %",
                   "volume": "Volumen", "signal": "Senal tecnica"}
    _COND_LABEL = {"above": "supero", "below": "bajo de"}
    typ  = _TYPE_LABEL.get(alert["type"], alert["type"])
    cond = _COND_LABEL.get(alert["condition"], alert["condition"])
    name = alert.get("name") or f"{alert['symbol']} - {typ}"
    fmt  = f"{value:,.4f}" if value < 1000 else f"{value:,.2f}"
    return _send_email(to_addr, f"Alerta: {name}", f"""
<div style="font-family:sans-serif;max-width:480px;padding:24px;
            background:#0f172a;color:#e2e8f0;border-radius:12px;">
  <h2 style="color:#38bdf8;margin:0 0 16px">Alerta disparada</h2>
  <h3 style="margin:0 0 8px">{name}</h3>
  <p style="color:#94a3b8;margin:0 0 16px">
    <strong>{alert['symbol']}</strong> en <strong>{alert['exchange']}</strong>
    {cond} el umbral configurado.
  </p>
  <p>Valor actual: <strong style="color:#4ade80">{fmt}</strong></p>
  <p style="color:#334155;font-size:12px">Crypto App</p>
</div>""")
