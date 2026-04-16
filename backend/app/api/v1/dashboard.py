from datetime import date

from fastapi import APIRouter, Query
from sqlalchemy.orm import Session

from app.api.deps import DB, CurrentUser
from app.models.user import User
from app.schemas.dashboard import DashboardResponse
from app.services.transaction_service import transaction_service

router = APIRouter()


@router.get("/", response_model=DashboardResponse)
def get_dashboard(
    year: int = Query(default=None),
    month: int = Query(default=None, ge=1, le=12),
    db: Session = DB,
    current_user: User = CurrentUser,
):
    today = date.today()
    target_year = year or today.year
    target_month = month or today.month

    current = transaction_service.get_monthly_stats(db, target_year, target_month, current_user.id)
    history = transaction_service.get_monthly_history(db, current_user.id, months=12)
    expense_breakdown = transaction_service.get_category_breakdown(
        db, target_year, target_month, current_user.id, income=False
    )
    income_breakdown = transaction_service.get_category_breakdown(
        db, target_year, target_month, current_user.id, income=True
    )
    uncategorized = transaction_service.get_inbox_count(db, current_user.id)

    return DashboardResponse(
        current_month=current,
        monthly_history=history,
        expense_breakdown=expense_breakdown,
        income_breakdown=income_breakdown,
        uncategorized_count=uncategorized,
    )
