import math
from datetime import date
from decimal import Decimal

from sqlalchemy import case, extract, func
from sqlalchemy.orm import Session, joinedload

from app.models.category import Category
from app.models.transaction import Transaction, TransactionStatus
from app.schemas.dashboard import CategoryBreakdown, MonthlyStats
from app.schemas.transaction import (
    BulkCategorize,
    TransactionCategorize,
    TransactionCreate,
    TransactionListResponse,
    TransactionUpdate,
)


class TransactionService:
    # ── CRUD ─────────────────────────────────────────────────────────────────

    def get_list(
        self,
        db: Session,
        user_id: int,
        *,
        page: int = 1,
        page_size: int = 50,
        status: TransactionStatus | None = None,
        category_id: int | None = None,
        search: str | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        amount_min: Decimal | None = None,
        amount_max: Decimal | None = None,
        transaction_type: str | None = None,
    ) -> TransactionListResponse:
        q = (
            db.query(Transaction)
            .options(joinedload(Transaction.category))
            .filter(Transaction.user_id == user_id)
        )

        if status:
            q = q.filter(Transaction.status == status)
        if category_id is not None:
            q = q.filter(Transaction.category_id == category_id)
        if search:
            q = q.filter(Transaction.description.ilike(f"%{search}%"))
        if date_from:
            q = q.filter(Transaction.date >= date_from)
        if date_to:
            q = q.filter(Transaction.date <= date_to)
        if amount_min is not None:
            q = q.filter(Transaction.amount >= amount_min)
        if amount_max is not None:
            q = q.filter(Transaction.amount <= amount_max)
        if transaction_type == "income":
            q = q.filter(Transaction.amount > 0)
        elif transaction_type == "expense":
            q = q.filter(Transaction.amount < 0)

        total = q.count()
        items = (
            q.order_by(Transaction.date.desc(), Transaction.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
            .all()
        )

        return TransactionListResponse(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            pages=math.ceil(total / page_size) if total else 1,
        )

    def get_by_id(self, db: Session, txn_id: int, user_id: int) -> Transaction | None:
        return (
            db.query(Transaction)
            .options(joinedload(Transaction.category))
            .filter(Transaction.id == txn_id, Transaction.user_id == user_id)
            .first()
        )

    def create(self, db: Session, data: TransactionCreate) -> Transaction:
        txn = Transaction(**data.model_dump())
        db.add(txn)
        db.commit()
        db.refresh(txn)
        return txn

    def create_batch(self, db: Session, items: list[TransactionCreate]) -> list[Transaction]:
        txns = [Transaction(**item.model_dump()) for item in items]
        db.add_all(txns)
        db.commit()
        return txns

    def update(self, db: Session, txn_id: int, data: TransactionUpdate, user_id: int) -> Transaction | None:
        txn = self.get_by_id(db, txn_id, user_id)
        if not txn:
            return None
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(txn, field, value)
        db.commit()
        db.refresh(txn)
        return txn

    def delete(self, db: Session, txn_id: int, user_id: int) -> bool:
        txn = db.query(Transaction).filter(Transaction.id == txn_id, Transaction.user_id == user_id).first()
        if not txn:
            return False
        db.delete(txn)
        db.commit()
        return True

    def categorize(
        self,
        db: Session,
        txn_id: int,
        data: TransactionCategorize,
        user_id: int,
    ) -> Transaction | None:
        txn = self.get_by_id(db, txn_id, user_id)
        if not txn:
            return None
        txn.category_id = data.category_id
        txn.status = TransactionStatus.CATEGORIZED
        db.commit()
        db.refresh(txn)
        return txn

    def bulk_categorize(self, db: Session, data: BulkCategorize, user_id: int) -> int:
        updated = (
            db.query(Transaction)
            .filter(Transaction.id.in_(data.transaction_ids), Transaction.user_id == user_id)
            .update(
                {
                    "category_id": data.category_id,
                    "status": TransactionStatus.CATEGORIZED,
                },
                synchronize_session=False,
            )
        )
        db.commit()
        return updated

    def exists_by_hash(self, db: Session, txn_hash: str, user_id: int) -> bool:
        return (
            db.query(Transaction.id)
            .filter(Transaction.hash == txn_hash, Transaction.user_id == user_id)
            .first() is not None
        )

    def get_inbox_count(self, db: Session, user_id: int) -> int:
        result = (
            db.query(func.count(Transaction.id))
            .filter(Transaction.status == TransactionStatus.UNCATEGORIZED, Transaction.user_id == user_id)
            .scalar()
        )
        return result or 0

    # ── Dashboard ─────────────────────────────────────────────────────────────

    def get_monthly_stats(self, db: Session, year: int, month: int, user_id: int) -> MonthlyStats:
        rows = (
            db.query(Transaction.amount)
            .filter(
                Transaction.user_id == user_id,
                extract("year", Transaction.date) == year,
                extract("month", Transaction.date) == month,
                Transaction.status != TransactionStatus.IGNORED,
            )
            .all()
        )

        income = sum((r.amount for r in rows if r.amount > 0), Decimal("0"))
        expenses = sum((abs(r.amount) for r in rows if r.amount < 0), Decimal("0"))

        return MonthlyStats(
            year=year,
            month=month,
            income=income,
            expenses=expenses,
            balance=income - expenses,
            transaction_count=len(rows),
        )

    def get_monthly_history(self, db: Session, user_id: int, months: int = 12) -> list[MonthlyStats]:
        """Return stats for the last N calendar months."""
        rows = (
            db.query(
                extract("year", Transaction.date).label("year"),
                extract("month", Transaction.date).label("month"),
                func.sum(
                    case((Transaction.amount > 0, Transaction.amount), else_=0)
                ).label("income"),
                func.sum(
                    case((Transaction.amount < 0, func.abs(Transaction.amount)), else_=0)
                ).label("expenses"),
                func.count(Transaction.id).label("cnt"),
            )
            .filter(Transaction.user_id == user_id, Transaction.status != TransactionStatus.IGNORED)
            .group_by("year", "month")
            .order_by("year", "month")
            .limit(months)
            .all()
        )

        return [
            MonthlyStats(
                year=int(r.year),
                month=int(r.month),
                income=Decimal(str(r.income or 0)),
                expenses=Decimal(str(r.expenses or 0)),
                balance=Decimal(str(r.income or 0)) - Decimal(str(r.expenses or 0)),
                transaction_count=r.cnt,
            )
            for r in rows
        ]

    def get_category_breakdown(
        self,
        db: Session,
        year: int,
        month: int,
        user_id: int,
        income: bool = False,
    ) -> list[CategoryBreakdown]:
        rows = (
            db.query(
                Transaction.category_id,
                Category.name.label("category_name"),
                Category.color.label("category_color"),
                func.sum(func.abs(Transaction.amount)).label("total"),
                func.count(Transaction.id).label("cnt"),
            )
            .outerjoin(Category, Transaction.category_id == Category.id)
            .filter(
                Transaction.user_id == user_id,
                extract("year", Transaction.date) == year,
                extract("month", Transaction.date) == month,
                Transaction.status != TransactionStatus.IGNORED,
                Transaction.amount > 0 if income else Transaction.amount < 0,
            )
            .group_by(Transaction.category_id, Category.name, Category.color)
            .order_by(func.sum(func.abs(Transaction.amount)).desc())
            .all()
        )

        grand_total = sum(Decimal(str(r.total or 0)) for r in rows)

        return [
            CategoryBreakdown(
                category_id=r.category_id,
                category_name=r.category_name or "Uncategorized",
                category_color=r.category_color or "#6b7280",
                total=Decimal(str(r.total or 0)),
                transaction_count=r.cnt,
                percentage=float(Decimal(str(r.total or 0)) / grand_total * 100)
                if grand_total
                else 0.0,
            )
            for r in rows
        ]


transaction_service = TransactionService()
