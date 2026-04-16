from datetime import date

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import DB, CurrentUser
from app.models.user import User
from app.schemas.budget import BudgetCreate, BudgetResponse, BudgetUpdate
from app.services.budget_service import budget_service

router = APIRouter()


@router.get("/", response_model=list[BudgetResponse])
def list_budgets(
    year: int = Query(default=None),
    month: int = Query(default=None, ge=1, le=12),
    db: Session = DB,
    current_user: User = CurrentUser,
):
    today = date.today()
    y = year or today.year
    m = month or today.month
    return budget_service.get_all(db, y, m, current_user.id)


@router.post("/", response_model=BudgetResponse, status_code=status.HTTP_201_CREATED)
def create_budget(data: BudgetCreate, db: Session = DB, current_user: User = CurrentUser):
    if budget_service.get_by_category(db, data.category_id, current_user.id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A budget for this category already exists.",
        )
    today = date.today()
    budget = budget_service.create(db, data, current_user.id)
    full = budget_service.get_by_id(db, budget.id, current_user.id)
    spent = budget_service._spending(db, budget.category_id, today.year, today.month, current_user.id)
    return budget_service._to_response(full, spent)


@router.put("/{budget_id}", response_model=BudgetResponse)
def update_budget(budget_id: int, data: BudgetUpdate, db: Session = DB, current_user: User = CurrentUser):
    budget = budget_service.get_by_id(db, budget_id, current_user.id)
    if not budget:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Budget not found.")
    today = date.today()
    updated = budget_service.update(db, budget, data)
    spent = budget_service._spending(db, updated.category_id, today.year, today.month, current_user.id)
    return budget_service._to_response(updated, spent)


@router.delete("/{budget_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_budget(budget_id: int, db: Session = DB, current_user: User = CurrentUser):
    budget = budget_service.get_by_id(db, budget_id, current_user.id)
    if not budget:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Budget not found.")
    budget_service.delete(db, budget)
