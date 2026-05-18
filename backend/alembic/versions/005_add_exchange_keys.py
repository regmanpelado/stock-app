"""Añade tabla exchange_keys para almacenar API keys de usuario cifradas.

Revision ID: 005
Revises: 004
Create Date: 2026-05-15
"""
from alembic import op
import sqlalchemy as sa

revision      = "005"
down_revision = "004"
branch_labels = None
depends_on    = None


def upgrade():
    op.create_table(
        "exchange_keys",
        sa.Column("id",         sa.String(36),  primary_key=True),
        sa.Column("user_id",    sa.String(36),  nullable=False),
        sa.Column("exchange",   sa.String(50),  nullable=False),
        sa.Column("label",      sa.String(100), nullable=True),
        sa.Column("api_key",    sa.Text(),      nullable=False),
        sa.Column("api_secret", sa.Text(),      nullable=False),
        sa.Column("created_at", sa.String(50),  nullable=False),
    )
    op.create_index("ix_exchange_keys_user", "exchange_keys", ["user_id"])


def downgrade():
    op.drop_index("ix_exchange_keys_user", "exchange_keys")
    op.drop_table("exchange_keys")
