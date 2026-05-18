"""Añade campos TOTP al modelo User para 2FA con Google Authenticator.

Revision ID: 007
Revises: 006
Create Date: 2026-05-15
"""
from alembic import op
import sqlalchemy as sa

revision      = "007"
down_revision = "006"
branch_labels = None
depends_on    = None


def upgrade():
    op.add_column("users", sa.Column("totp_secret",      sa.String(64), nullable=True))
    op.add_column("users", sa.Column("totp_enabled",     sa.Boolean(),  nullable=False, server_default="false"))
    op.add_column("users", sa.Column("totp_backup_hash", sa.Text(),     nullable=True))


def downgrade():
    op.drop_column("users", "totp_backup_hash")
    op.drop_column("users", "totp_enabled")
    op.drop_column("users", "totp_secret")
