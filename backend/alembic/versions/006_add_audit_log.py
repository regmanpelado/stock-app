"""Añade tabla audit_log para registro de acciones importantes.

Revision ID: 006
Revises: 005
Create Date: 2026-05-15
"""
from alembic import op
import sqlalchemy as sa

revision      = "006"
down_revision = "005"
branch_labels = None
depends_on    = None


def upgrade():
    op.create_table(
        "audit_log",
        sa.Column("id",         sa.String(36),  primary_key=True),
        sa.Column("user_id",    sa.String(36),  nullable=True),
        sa.Column("user_email", sa.String(255), nullable=True),
        sa.Column("action",     sa.String(50),  nullable=False),
        sa.Column("ip",         sa.String(64),  nullable=True),
        sa.Column("details",    sa.Text(),      nullable=True),
        sa.Column("created_at", sa.String(50),  nullable=False),
    )
    op.create_index("ix_audit_log_action",     "audit_log", ["action"])
    op.create_index("ix_audit_log_user_id",    "audit_log", ["user_id"])
    op.create_index("ix_audit_log_created_at", "audit_log", ["created_at"])


def downgrade():
    op.drop_index("ix_audit_log_created_at", "audit_log")
    op.drop_index("ix_audit_log_user_id",    "audit_log")
    op.drop_index("ix_audit_log_action",     "audit_log")
    op.drop_table("audit_log")
