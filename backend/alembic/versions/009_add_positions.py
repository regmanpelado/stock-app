"""add positions table for stock portfolio

Revision ID: 009_add_positions
Revises: 008_add_stripe
Create Date: 2026-05-19
"""
from alembic import op
import sqlalchemy as sa

revision = '009_add_positions'
down_revision = '008_add_stripe'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'positions',
        sa.Column('id',         sa.String(36),  primary_key=True),
        sa.Column('user_id',    sa.String(36),  nullable=False, index=True),
        sa.Column('symbol',     sa.String(20),  nullable=False),
        sa.Column('exchange',   sa.String(20),  nullable=False, server_default='NYSE'),
        sa.Column('name',       sa.String(255), nullable=True),
        sa.Column('shares',     sa.Float(),     nullable=False),
        sa.Column('avg_price',  sa.Float(),     nullable=False),
        sa.Column('currency',   sa.String(10),  nullable=False, server_default='USD'),
        sa.Column('created_at', sa.String(50),  nullable=False),
        sa.Column('notes',      sa.Text(),      nullable=True),
    )


def downgrade():
    op.drop_table('positions')
