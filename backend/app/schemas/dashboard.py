from decimal import Decimal

from pydantic import BaseModel


class MonthlyStats(BaseModel):
    year: int
    month: int
    income: Decimal
    expenses: Decimal
    balance: Decimal
    transaction_count: int


class CategoryBreakdown(BaseModel):
    category_id: int | None
    category_name: str
    category_color: str
    total: Decimal
    transaction_count: int
    percentage: float


class DashboardResponse(BaseModel):
    current_month: MonthlyStats
    monthly_history: list[MonthlyStats]
    expense_breakdown: list[CategoryBreakdown]
    income_breakdown: list[CategoryBreakdown]
    uncategorized_count: int
