from calendar import monthrange
from datetime import date
from decimal import Decimal

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.budget import Budget
from app.models.category import Category
from app.models.transaction import Transaction
from app.schemas.budget import BudgetCreate, BudgetResponse, BudgetUpdate
from app.schemas.category import CategoryResponse


class BudgetService:
    def _spending(self, db: Session, category_id: int, year: int, month: int, user_id: int) -> Decimal:
        """Sum of expense amounts (absolute) for a category in the given month."""
        first = date(year, month, 1)
        last = date(year, month, monthrange(year, month)[1])
        result = (
            db.query(func.sum(Transaction.amount))
            .filter(
                Transaction.user_id == user_id,
                Transaction.category_id == category_id,
                Transaction.amount < 0,
                Transaction.date >= first,
                Transaction.date <= last,
            )
            .scalar()
        )
        return abs(result) if result is not None else Decimal("0")

    def _to_response(self, budget: Budget, spent: Decimal) -> BudgetResponse:
        cat = budget.category
        percentage = float(spent / budget.amount * 100) if budget.amount else 0.0
        return BudgetResponse(
            id=budget.id,
            category_id=budget.category_id,
            category=CategoryResponse.model_validate(cat),
            amount=budget.amount,
            spent=spent,
            remaining=budget.amount - spent,
            percentage=percentage,
            created_at=budget.created_at,
            updated_at=budget.updated_at,
        )

    def get_all(self, db: Session, year: int, month: int, user_id: int) -> list[BudgetResponse]:
        budgets = (
            db.query(Budget)
            .filter(Budget.user_id == user_id)
            .join(Category)
            .order_by(Category.name)
            .all()
        )
        return [
            self._to_response(b, self._spending(db, b.category_id, year, month, user_id))
            for b in budgets
        ]

    def get_by_id(self, db: Session, budget_id: int, user_id: int) -> Budget | None:
        return db.query(Budget).filter(Budget.id == budget_id, Budget.user_id == user_id).first()

    def get_by_category(self, db: Session, category_id: int, user_id: int) -> Budget | None:
        return db.query(Budget).filter(Budget.category_id == category_id, Budget.user_id == user_id).first()

    def create(self, db: Session, data: BudgetCreate, user_id: int) -> Budget:
        budget = Budget(category_id=data.category_id, amount=data.amount, user_id=user_id)
        db.add(budget)
        db.commit()
        db.refresh(budget)
        return budget

    def update(self, db: Session, budget: Budget, data: BudgetUpdate) -> Budget:
        budget.amount = data.amount
        db.commit()
        db.refresh(budget)
        return budget

    def delete(self, db: Session, budget: Budget) -> None:
        db.delete(budget)
        db.commit()


budget_service = BudgetService()
