"""
Crea un usuario administrador en la base de datos.

Uso:
  python seed_admin.py
  python seed_admin.py --email otro@email.com --password MiClave123
"""
import argparse
import sys
from pathlib import Path

# Asegura que el directorio raíz del backend esté en el path
sys.path.insert(0, str(Path(__file__).parent))

from app.services.auth_service import register_user, hash_password
from app.database import get_session
from app.models.orm import User
from app.services.subscription_service import PLANES

DEFAULT_EMAIL    = "germanariasjunco@gmail.com"
DEFAULT_PASSWORD = "CambiarEsta2026!"
DEFAULT_NOMBRE   = "German Arias"
DEFAULT_PLAN     = "pro_plus"


def seed(email: str, password: str, nombre: str, plan: str):
    with get_session() as s:
        existing = s.query(User).filter(User.email == email.lower().strip()).first()
        if existing:
            # Si ya existe, solo asegura que esté verificado y actualiza la clave
            existing.email_verificado = True
            existing.password_hash    = hash_password(password)
            existing.plan             = plan
            existing.activo           = True
            print(f"[OK] Usuario existente actualizado: {email}")
            return

    # No existe → registrar normalmente y luego verificar
    result = register_user(email, nombre, password)
    uid = result["id"]

    with get_session() as s:
        u = s.get(User, uid)
        u.email_verificado = True   # saltar verificación por email
        u.plan             = plan

    print(f"[OK] Usuario administrador creado: {email}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed de usuario administrador")
    parser.add_argument("--email",    default=DEFAULT_EMAIL)
    parser.add_argument("--password", default=DEFAULT_PASSWORD)
    parser.add_argument("--nombre",   default=DEFAULT_NOMBRE)
    parser.add_argument("--plan",     default=DEFAULT_PLAN,
                        choices=list(PLANES.keys()))
    args = parser.parse_args()

    print(f"\nCreando usuario administrador...")
    print(f"  Email : {args.email}")
    print(f"  Plan  : {args.plan}")
    print(f"  Pass  : {args.password}")
    print()

    seed(args.email, args.password, args.nombre, args.plan)

    print(f"\nListo. Inicia sesion con:")
    print(f"  Email     : {args.email}")
    print(f"  Contraseña: {args.password}")
    print(f"\nCAMBIA LA CONTRASEÑA despues de tu primer login.\n")
