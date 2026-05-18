"""Lógica TOTP para 2FA con Google Authenticator. Usa pyotp + bcrypt."""
import json
import secrets

import bcrypt as _bcrypt
import pyotp

BACKUP_CODE_COUNT = 8


def generate_secret() -> str:
    return pyotp.random_base32()


def get_totp_uri(secret: str, email: str, issuer: str = "Crypto App") -> str:
    return pyotp.TOTP(secret).provisioning_uri(name=email, issuer_name=issuer)


def verify_totp(secret: str, code: str) -> bool:
    """Acepta el intervalo actual y ±1 (ventana de 90 s)."""
    try:
        return pyotp.TOTP(secret).verify(code.strip(), valid_window=1)
    except Exception:
        return False


def generate_backup_codes() -> tuple[list[str], str]:
    """Devuelve (códigos_en_claro, json_hashes). Los códigos se muestran UNA vez."""
    plain_codes = [secrets.token_hex(4).upper() for _ in range(BACKUP_CODE_COUNT)]
    hashed = [
        _bcrypt.hashpw(c.encode(), _bcrypt.gensalt(rounds=10)).decode()
        for c in plain_codes
    ]
    return plain_codes, json.dumps(hashed)


def verify_backup_code(code: str, hashes_json: str) -> tuple[bool, str]:
    """
    Comprueba si el código coincide con algún hash.
    Si es válido lo elimina (uso único) y devuelve (True, hashes_json_actualizado).
    Si no, devuelve (False, hashes_json_original).
    """
    code_clean = code.strip().upper().replace("-", "").replace(" ", "")
    try:
        hashes = json.loads(hashes_json or "[]")
    except Exception:
        return False, hashes_json
    for i, h in enumerate(hashes):
        try:
            if _bcrypt.checkpw(code_clean.encode(), h.encode()):
                remaining = hashes[:i] + hashes[i + 1:]
                return True, json.dumps(remaining)
        except Exception:
            continue
    return False, hashes_json


def backup_codes_remaining(hashes_json: str | None) -> int:
    try:
        return len(json.loads(hashes_json or "[]"))
    except Exception:
        return 0
