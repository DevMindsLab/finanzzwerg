"""Initial schema — all tables + default categories

Revision ID: 001
Revises:
Create Date: 2025-01-01
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── categories ───────────────────────────────────────────────────────────
    op.create_table(
        "categories",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("color", sa.String(7), nullable=False, server_default="#6b7280"),
        sa.Column("icon", sa.String(50), nullable=True),
        sa.Column("is_income", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )
    op.create_index("ix_categories_id", "categories", ["id"])
    op.create_index("ix_categories_name", "categories", ["name"])

    # ── import_jobs ──────────────────────────────────────────────────────────
    op.create_table(
        "import_jobs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column(
            "status",
            sa.Enum("pending", "processing", "completed", "failed", name="importjobstatus"),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("total_rows", sa.Integer(), nullable=True),
        sa.Column("processed_rows", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("duplicate_rows", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("error_message", sa.String(1000), nullable=True),
        sa.Column("csv_profile", sa.JSON(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_import_jobs_id", "import_jobs", ["id"])

    # ── transactions ─────────────────────────────────────────────────────────
    op.create_table(
        "transactions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("description", sa.String(500), nullable=False),
        sa.Column("category_id", sa.Integer(), nullable=True),
        sa.Column("import_job_id", sa.Integer(), nullable=True),
        sa.Column(
            "status",
            sa.Enum(
                "uncategorized", "categorized", "ignored", name="transactionstatus"
            ),
            nullable=False,
            server_default="uncategorized",
        ),
        sa.Column("raw_data", sa.JSON(), nullable=True),
        sa.Column("hash", sa.String(64), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["category_id"], ["categories.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["import_job_id"], ["import_jobs.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_transactions_id", "transactions", ["id"])
    op.create_index("ix_transactions_date", "transactions", ["date"])
    op.create_index("ix_transactions_category_id", "transactions", ["category_id"])
    op.create_index("ix_transactions_import_job_id", "transactions", ["import_job_id"])
    op.create_index("ix_transactions_status", "transactions", ["status"])
    op.create_index("ix_transactions_hash", "transactions", ["hash"])

    # ── rules ────────────────────────────────────────────────────────────────
    op.create_table(
        "rules",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("pattern", sa.String(500), nullable=False),
        sa.Column(
            "match_type",
            sa.Enum("substring", "exact", "regex", name="matchtype"),
            nullable=False,
            server_default="substring",
        ),
        sa.Column("category_id", sa.Integer(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("priority", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["category_id"], ["categories.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_rules_id", "rules", ["id"])
    op.create_index("ix_rules_category_id", "rules", ["category_id"])

    # ── Default categories ────────────────────────────────────────────────────
    op.execute(
        sa.text(
            """
            INSERT INTO categories (name, color, is_income, is_default) VALUES
            ('Income',        '#10b981', true,  true),
            ('Housing',       '#3b82f6', false, true),
            ('Groceries',     '#f97316', false, true),
            ('Transport',     '#eab308', false, true),
            ('Health',        '#ef4444', false, true),
            ('Leisure',       '#a855f7', false, true),
            ('Subscriptions', '#6366f1', false, true),
            ('Eating Out',    '#f59e0b', false, true),
            ('Other',         '#6b7280', false, true)
            """
        )
    )


def downgrade() -> None:
    op.drop_table("rules")
    op.drop_table("transactions")
    op.drop_table("import_jobs")
    op.drop_table("categories")
    op.execute(sa.text("DROP TYPE IF EXISTS matchtype"))
    op.execute(sa.text("DROP TYPE IF EXISTS transactionstatus"))
    op.execute(sa.text("DROP TYPE IF EXISTS importjobstatus"))
