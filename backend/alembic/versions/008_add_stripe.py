"""Añade campos Stripe al modelo User.

Revision ID: 008
Revises: 007
Create Date: 2026-05-15
"""
from alembic import op
import sqlalchemy as sa

revision      = "008"
down_revision = "007"
branch_labels = None
depends_on    = None


def upgrade():
    op.add_column("users", sa.Column("stripe_customer_id",     sa.String(100), nullable=True))
    op.add_column("users", sa.Column("stripe_subscription_id", sa.String(100), nullable=True))


def downgrade():
    op.drop_column("users", "stripe_subscription_id")
    op.drop_column("users", "stripe_customer_id")
