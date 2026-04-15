from datetime import datetime

from pydantic import BaseModel, Field

from app.models.rule import MatchType
from app.schemas.category import CategoryResponse


class RuleBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    pattern: str = Field(..., min_length=1, max_length=500)
    match_type: MatchType = MatchType.SUBSTRING
    category_id: int
    is_active: bool = True
    priority: int = Field(default=0, ge=0)


class RuleCreate(RuleBase):
    pass


class RuleUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    pattern: str | None = Field(default=None, min_length=1, max_length=500)
    match_type: MatchType | None = None
    category_id: int | None = None
    is_active: bool | None = None
    priority: int | None = Field(default=None, ge=0)


class RuleResponse(RuleBase):
    id: int
    category: CategoryResponse
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
