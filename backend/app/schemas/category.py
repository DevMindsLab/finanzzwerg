from datetime import datetime

from pydantic import BaseModel, Field


class CategoryBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    color: str = Field(default="#6b7280", pattern=r"^#[0-9a-fA-F]{6}$")
    icon: str | None = None
    is_income: bool = False


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    color: str | None = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")
    icon: str | None = None
    is_income: bool | None = None


class CategoryResponse(CategoryBase):
    id: int
    is_default: bool
    created_at: datetime
    transaction_count: int = 0

    model_config = {"from_attributes": True}
