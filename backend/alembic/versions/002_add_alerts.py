"""Tabla de alertas en tiempo real.

Revision ID: 002
Revises: 001
Create Date: 2026-05-12
"""
from alembic import op
import sqlalchemy as sa

revision      = "002"
down_revision = "001"
branch_labels = None
depends_on    = None


def upgrade():
    op.create_table(
        "alerts",
        sa.Column("id",              sa.String(36),  primary_key=True),
        sa.Column("user_id",         sa.String(36),  nullable=False),
        sa.Column("name",            sa.String(255), nullable=True),
        sa.Column("type",            sa.String(50),  nullable=False),
        sa.Column("exchange",        sa.String(50),  nullable=False),
        sa.Column("symbol",          sa.String(50),  nullable=False),
        sa.Column("condition",       sa.String(30),  nullable=False),
        sa.Column("target_value",    sa.Float(),     nullable=True),
        sa.Column("indicator",       sa.String(30),  nullable=True),
        sa.Column("active",          sa.Boolean(),   nullable=False, server_default="1"),
        sa.Column("triggered",       sa.Boolean(),   nullable=False, server_default="0"),
        sa.Column("triggered_at",    sa.String(50),  nullable=True),
        sa.Column("triggered_value", sa.Float(),     nullable=True),
        sa.Column("created_at",      sa.String(50),  nullable=False),
        sa.Column("notified",        sa.Boolean(),   nullable=False, server_default="0"),
        sa.Column("email",           sa.String(255), nullable=True),
    )


def downgrade():
    op.drop_table("alerts")
