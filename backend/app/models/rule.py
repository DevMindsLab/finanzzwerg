import enum
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.database import Base


class MatchType(str, enum.Enum):
    SUBSTRING = "substring"
    EXACT = "exact"
    REGEX = "regex"


class Rule(Base):
    __tablename__ = "rules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    pattern: Mapped[str] = mapped_column(String(500), nullable=False)
    match_type: Mapped[MatchType] = mapped_column(
        Enum(MatchType, name="matchtype"),
        default=MatchType.SUBSTRING,
        nullable=False,
    )
    category_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("categories.id"), nullable=False, index=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    # Higher priority rules are applied first
    priority: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    category: Mapped["Category"] = relationship(  # noqa: F821
        "Category", back_populates="rules"
    )

    def __repr__(self) -> str:
        return f"<Rule id={self.id} pattern={self.pattern!r}>"
