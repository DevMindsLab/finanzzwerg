from datetime import date

from fastapi import APIRouter, Query
from sqlalchemy.orm import Session

from app.api.deps import DB
from app.schemas.dashboard import DashboardResponse
from app.services.transaction_service import transaction_service

router = APIRouter()


@router.get("/", response_model=DashboardResponse)
def get_dashboard(
    year: int = Query(default=None, description="Year (defaults to current year)"),
    month: int = Query(default=None, ge=1, le=12, description="Month (defaults to current month)"),
    db: Session = DB,
):
    today = date.today()
    target_year = year or today.year
    target_month = month or today.month

    current = transaction_service.get_monthly_stats(db, target_year, target_month)
    history = transaction_service.get_monthly_history(db, months=12)
    expense_breakdown = transaction_service.get_category_breakdown(
        db, target_year, target_month, income=False
    )
    income_breakdown = transaction_service.get_category_breakdown(
        db, target_year, target_month, income=True
    )
    uncategorized = transaction_service.get_inbox_count(db)

    return DashboardResponse(
        current_month=current,
        monthly_history=history,
        expense_breakdown=expense_breakdown,
        income_breakdown=income_breakdown,
        uncategorized_count=uncategorized,
    )
