"""Add csv_presets table with built-in bank presets

Revision ID: 002
Revises: 001
Create Date: 2026-04-16
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_BUILT_IN_PRESETS = [
    {
        "name": "HASPA (DE)",
        "profile": {
            "delimiter": ";",
            "encoding": "latin-1",
            "skip_rows": 0,
            "date_column": "Buchungstag",
            "date_format": "%d.%m.%y",
            "amount_column": "Betrag",
            "debit_column": None,
            "credit_column": None,
            "decimal_separator": ",",
            "thousands_separator": ".",
            "description_columns": ["Beguenstigter/Zahlungspflichtiger", "Verwendungszweck"],
            "description_join": " | ",
            "negate_amount": False,
        },
    },
    {
        "name": "Deutsche Bank (DE)",
        "profile": {
            "delimiter": ";",
            "encoding": "utf-8",
            "skip_rows": 4,
            "date_column": "Buchungstag",
            "date_format": "%d.%m.%Y",
            "amount_column": "Betrag (EUR)",
            "debit_column": None,
            "credit_column": None,
            "decimal_separator": ",",
            "thousands_separator": ".",
            "description_columns": ["Auftraggeber / Beguenstigter", "Verwendungszweck"],
            "description_join": " | ",
            "negate_amount": False,
        },
    },
    {
        "name": "ING (DE)",
        "profile": {
            "delimiter": ";",
            "encoding": "utf-8",
            "skip_rows": 13,
            "date_column": "Buchung",
            "date_format": "%d.%m.%Y",
            "amount_column": "Betrag",
            "debit_column": None,
            "credit_column": None,
            "decimal_separator": ",",
            "thousands_separator": ".",
            "description_columns": ["Auftraggeber/Empfänger", "Verwendungszweck"],
            "description_join": " | ",
            "negate_amount": False,
        },
    },
    {
        "name": "Generic CSV",
        "profile": {
            "delimiter": ",",
            "encoding": "utf-8",
            "skip_rows": 0,
            "date_column": "date",
            "date_format": "%Y-%m-%d",
            "amount_column": "amount",
            "debit_column": None,
            "credit_column": None,
            "decimal_separator": ".",
            "thousands_separator": "",
            "description_columns": ["description"],
            "description_join": " | ",
            "negate_amount": False,
        },
    },
]


def upgrade() -> None:
    op.create_table(
        "csv_presets",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("profile", sa.JSON(), nullable=False),
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
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )
    op.create_index("ix_csv_presets_id", "csv_presets", ["id"])

    # Seed built-in presets
    presets_table = sa.table(
        "csv_presets",
        sa.column("name", sa.String),
        sa.column("profile", sa.JSON),
    )
    op.bulk_insert(presets_table, _BUILT_IN_PRESETS)


def downgrade() -> None:
    op.drop_index("ix_csv_presets_id", table_name="csv_presets")
    op.drop_table("csv_presets")
