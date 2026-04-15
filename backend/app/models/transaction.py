import enum
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Integer, JSON, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.database import Base


class TransactionStatus(str, enum.Enum):
    UNCATEGORIZED = "uncategorized"
    CATEGORIZED = "categorized"
    IGNORED = "ignored"


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    category_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("categories.id"), nullable=True, index=True
    )
    import_job_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("import_jobs.id"), nullable=True, index=True
    )
    status: Mapped[TransactionStatus] = mapped_column(
        Enum(TransactionStatus, name="transactionstatus"),
        default=TransactionStatus.UNCATEGORIZED,
        nullable=False,
        index=True,
    )
    raw_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    # SHA-256 hash of (date + amount + description) for deduplication
    hash: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    category: Mapped["Category | None"] = relationship(  # noqa: F821
        "Category", back_populates="transactions"
    )
    import_job: Mapped["ImportJob | None"] = relationship(  # noqa: F821
        "ImportJob", back_populates="transactions"
    )

    def __repr__(self) -> str:
        return f"<Transaction id={self.id} date={self.date} amount={self.amount}>"
