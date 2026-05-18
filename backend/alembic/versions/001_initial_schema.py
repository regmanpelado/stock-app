"""Esquema inicial: bots, trades y users.

Revision ID: 001
Revises:
Create Date: 2026-05-11
"""
from alembic import op
import sqlalchemy as sa

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "bots",
        sa.Column("id",             sa.String(36),  nullable=False, primary_key=True),
        sa.Column("name",           sa.String(255), nullable=False),
        sa.Column("type",           sa.String(50),  nullable=False),
        sa.Column("config",         sa.Text(),      nullable=False, server_default="{}"),
        sa.Column("sandbox",        sa.Boolean(),   nullable=False, server_default="1"),
        sa.Column("status",         sa.String(50),  nullable=False, server_default="stopped"),
        sa.Column("created_at",     sa.String(50),  nullable=False),
        sa.Column("pnl",            sa.Float(),     server_default="0"),
        sa.Column("pnl_pct",        sa.Float(),     server_default="0"),
        sa.Column("total_invested", sa.Float(),     server_default="0"),
        sa.Column("current_value",  sa.Float(),     server_default="0"),
        sa.Column("stats",          sa.Text(),      nullable=False, server_default="{}"),
        sa.Column("last_check",     sa.String(50)),
        sa.Column("error",          sa.Text()),
    )

    op.create_table(
        "trades",
        sa.Column("id",        sa.String(36),  nullable=False, primary_key=True),
        sa.Column("bot_id",    sa.String(36),  sa.ForeignKey("bots.id", ondelete="CASCADE"), nullable=False),
        sa.Column("timestamp", sa.String(50),  nullable=False),
        sa.Column("side",      sa.String(10),  nullable=False),
        sa.Column("price",     sa.Float(),     nullable=False),
        sa.Column("amount",    sa.Float(),     nullable=False),
        sa.Column("cost",      sa.Float(),     nullable=False),
        sa.Column("sandbox",   sa.Boolean(),   nullable=False, server_default="1"),
    )
    op.create_index("ix_trades_bot_id", "trades", ["bot_id"])

    op.create_table(
        "users",
        sa.Column("id",              sa.String(36),  nullable=False, primary_key=True),
        sa.Column("email",           sa.String(255), nullable=False, unique=True),
        sa.Column("nombre",          sa.String(255), nullable=False),
        sa.Column("plan",            sa.String(50),  nullable=False, server_default="free"),
        sa.Column("activo",          sa.Boolean(),   nullable=False, server_default="1"),
        sa.Column("creado_en",       sa.String(50),  nullable=False),
        sa.Column("proxima_factura", sa.String(50)),
    )


def downgrade() -> None:
    op.drop_table("trades")
    op.drop_table("bots")
    op.drop_table("users")
