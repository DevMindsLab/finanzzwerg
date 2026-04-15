from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field

from app.models.transaction import TransactionStatus
from app.schemas.category import CategoryResponse


class TransactionBase(BaseModel):
    date: date
    amount: Decimal = Field(..., decimal_places=2)
    description: str = Field(..., min_length=1, max_length=500)


class TransactionCreate(TransactionBase):
    category_id: int | None = None
    import_job_id: int | None = None
    raw_data: dict | None = None
    hash: str | None = None


class TransactionUpdate(BaseModel):
    date: date | None = None
    amount: Decimal | None = Field(default=None, decimal_places=2)
    description: str | None = Field(default=None, min_length=1, max_length=500)
    category_id: int | None = None
    status: TransactionStatus | None = None


class TransactionCategorize(BaseModel):
    """Categorize a single transaction, optionally creating a rule."""

    category_id: int
    create_rule: bool = False
    rule_pattern: str | None = Field(default=None, min_length=1, max_length=500)


class BulkCategorize(BaseModel):
    transaction_ids: list[int] = Field(..., min_length=1)
    category_id: int


class TransactionResponse(TransactionBase):
    id: int
    category_id: int | None
    category: CategoryResponse | None
    import_job_id: int | None
    status: TransactionStatus
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TransactionListResponse(BaseModel):
    items: list[TransactionResponse]
    total: int
    page: int
    page_size: int
    pages: int
