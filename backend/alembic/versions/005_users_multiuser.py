"""Multi-user auth: users table + user_id on all entities.

Revision ID: 005
Revises: 004
Create Date: 2026-04-16
"""

from alembic import op
import sqlalchemy as sa
import bcrypt as _bcrypt_lib

revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── 1. Create users table ─────────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("email", sa.String(255), nullable=False, unique=True, index=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )

    # ── 2. Seed a migration user so existing data is preserved ────────────────
    # Credentials: admin@localhost / changeme123
    # Users should change these immediately after upgrading.
    migration_hash = _bcrypt_lib.hashpw(b"changeme123", _bcrypt_lib.gensalt(rounds=12)).decode()
    op.execute(
        sa.text(
            "INSERT INTO users (email, password_hash, is_active) "
            "VALUES ('admin@localhost', :h, true)"
        ).bindparams(h=migration_hash)
    )

    # ── 3. Add user_id (nullable FK) to all tables ────────────────────────────
    for table in ("categories", "transactions", "rules", "import_jobs", "csv_presets", "budgets"):
        op.add_column(
            table,
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=True),
        )
        op.create_index(f"ix_{table}_user_id", table, ["user_id"])

    # ── 4. Assign all existing records to the migration user ──────────────────
    for table in ("categories", "transactions", "rules", "import_jobs", "csv_presets", "budgets"):
        op.execute(sa.text(f"UPDATE {table} SET user_id = 1 WHERE user_id IS NULL"))

    # ── 5. Drop old global unique constraints, replace with per-user ones ─────
    # Category name: was globally unique, now unique per user
    op.drop_constraint("categories_name_key", "categories", type_="unique")
    op.create_unique_constraint("uq_categories_user_name", "categories", ["user_id", "name"])

    # CSVPreset name: was globally unique, now unique per user
    op.drop_constraint("csv_presets_name_key", "csv_presets", type_="unique")
    op.create_unique_constraint("uq_csv_presets_user_name", "csv_presets", ["user_id", "name"])

    # Budget category_id: was globally unique, now unique per user
    op.drop_constraint("budgets_category_id_key", "budgets", type_="unique")
    op.create_unique_constraint("uq_budgets_user_category", "budgets", ["user_id", "category_id"])


def downgrade() -> None:
    # Restore old unique constraints
    op.drop_constraint("uq_budgets_user_category", "budgets", type_="unique")
    op.create_unique_constraint("budgets_category_id_key", "budgets", ["category_id"])

    op.drop_constraint("uq_csv_presets_user_name", "csv_presets", type_="unique")
    op.create_unique_constraint("csv_presets_name_key", "csv_presets", ["name"])

    op.drop_constraint("uq_categories_user_name", "categories", type_="unique")
    op.create_unique_constraint("categories_name_key", "categories", ["name"])

    # Drop user_id columns
    for table in ("categories", "transactions", "rules", "import_jobs", "csv_presets", "budgets"):
        op.drop_index(f"ix_{table}_user_id", table_name=table)
        op.drop_column(table, "user_id")

    op.drop_table("users")
