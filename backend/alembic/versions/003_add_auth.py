"""Añade campos de autenticación a users y user_id a bots.

Revision ID: 003
Revises: 002
Create Date: 2026-05-12
"""
from alembic import op
import sqlalchemy as sa

revision      = "003"
down_revision = "002"
branch_labels = None
depends_on    = None


def upgrade():
    with op.batch_alter_table("users") as batch:
        batch.add_column(sa.Column("password_hash",      sa.Text(),        nullable=True))
        batch.add_column(sa.Column("email_verificado",   sa.Boolean(),     nullable=False, server_default="0"))
        batch.add_column(sa.Column("token_verificacion", sa.String(100),   nullable=True))
        batch.add_column(sa.Column("token_reset_pass",   sa.String(100),   nullable=True))
        batch.add_column(sa.Column("token_reset_expiry", sa.String(50),    nullable=True))

    with op.batch_alter_table("bots") as batch:
        batch.add_column(sa.Column("user_id", sa.String(36), nullable=False, server_default="demo"))


def downgrade():
    with op.batch_alter_table("users") as batch:
        batch.drop_column("password_hash")
        batch.drop_column("email_verificado")
        batch.drop_column("token_verificacion")
        batch.drop_column("token_reset_pass")
        batch.drop_column("token_reset_expiry")

    with op.batch_alter_table("bots") as batch:
        batch.drop_column("user_id")
