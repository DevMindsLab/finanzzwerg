from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from app.models.import_job import ImportJobStatus


class CSVProfile(BaseModel):
    """
    Describes how to parse a bank's CSV export.
    Different banks use wildly different formats — this config handles them all.
    """

    name: str = "Default"
    delimiter: str = ","
    encoding: str = "utf-8"
    # Number of rows to skip before the header row (e.g. bank metadata rows)
    skip_rows: int = 0
    date_column: str = "date"
    date_format: str = "%Y-%m-%d"
    amount_column: str = "amount"
    # Used when amount is split into separate debit / credit columns
    debit_column: str | None = None
    credit_column: str | None = None
    # "," in German bank exports; "." is the default
    decimal_separator: str = "."
    thousands_separator: str = ""
    # Multiple columns can be joined to form the description
    description_columns: list[str] = Field(default_factory=lambda: ["description"])
    description_join: str = " | "
    # Some banks export amounts as always-positive; set True to flip sign for debits
    negate_amount: bool = False


class ImportJobResponse(BaseModel):
    id: int
    filename: str
    status: ImportJobStatus
    total_rows: int | None
    processed_rows: int
    duplicate_rows: int
    error_message: str | None
    csv_profile: dict[str, Any] | None
    created_at: datetime
    completed_at: datetime | None

    model_config = {"from_attributes": True}


# ── CSV Presets ───────────────────────────────────────────────────────────────

class CSVPresetCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    profile: CSVProfile


class CSVPresetUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    profile: CSVProfile | None = None


class CSVPresetResponse(BaseModel):
    id: int
    name: str
    profile: dict[str, Any]
    is_default: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
