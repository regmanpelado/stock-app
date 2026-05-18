"""Añade columna is_admin a users.

Revision ID: 004
Revises: 003
Create Date: 2026-05-15
"""
from alembic import op
import sqlalchemy as sa

revision      = "004"
down_revision = "003"
branch_labels = None
depends_on    = None


def upgrade():
    with op.batch_alter_table("users") as batch:
        batch.add_column(
            sa.Column("is_admin", sa.Boolean(), nullable=False, server_default="0")
        )


def downgrade():
    with op.batch_alter_table("users") as batch:
        batch.drop_column("is_admin")
