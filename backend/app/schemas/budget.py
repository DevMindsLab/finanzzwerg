from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field

from app.schemas.category import CategoryResponse


class BudgetCreate(BaseModel):
    category_id: int
    amount: Decimal = Field(..., gt=0, decimal_places=2)


class BudgetUpdate(BaseModel):
    amount: Decimal = Field(..., gt=0, decimal_places=2)


class BudgetResponse(BaseModel):
    id: int
    category_id: int
    category: CategoryResponse
    amount: Decimal
    spent: Decimal        # absolute spending in the queried month
    remaining: Decimal    # amount - spent (negative = over budget)
    percentage: float     # spent / amount * 100, capped at 999 for display
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
