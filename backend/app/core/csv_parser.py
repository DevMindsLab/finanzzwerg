"""
CSV parsing engine for Financeless.

Supports configurable column mappings, date formats, decimal separators,
split debit/credit columns, and automatic deduplication via SHA-256 hashing.
"""

import hashlib
import io
import logging
from dataclasses import dataclass
from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Any

import pandas as pd
from dateutil import parser as dateutil_parser

from app.schemas.import_job import CSVProfile

logger = logging.getLogger(__name__)


@dataclass
class ParsedTransaction:
    date: date
    amount: Decimal
    description: str
    raw_data: dict[str, Any]
    hash: str


@dataclass
class ParseResult:
    transactions: list[ParsedTransaction]
    errors: list[str]
    total_rows: int
    skipped_rows: int


def _compute_hash(txn_date: date, amount: Decimal, description: str) -> str:
    """SHA-256 fingerprint used for deduplication on re-import."""
    raw = f"{txn_date.isoformat()}|{amount}|{description.strip().lower()}"
    return hashlib.sha256(raw.encode()).hexdigest()


def _parse_amount(
    raw: str,
    decimal_sep: str,
    thousands_sep: str,
) -> Decimal:
    """
    Normalise a locale-specific number string to a Decimal.

    Examples handled:
        "1.234,56"  → Decimal("1234.56")   (German format)
        "1,234.56"  → Decimal("1234.56")   (English format)
        "-42,50"    → Decimal("-42.50")
    """
    cleaned = str(raw).strip()

    if thousands_sep:
        cleaned = cleaned.replace(thousands_sep, "")

    if decimal_sep != ".":
        cleaned = cleaned.replace(decimal_sep, ".")

    # Remove any remaining non-numeric chars except leading minus and decimal dot
    # (handles currency symbols, spaces, etc.)
    allowed = set("0123456789.-")
    cleaned = "".join(c for c in cleaned if c in allowed or c == "-")

    return Decimal(cleaned)


def _build_description(row: pd.Series, columns: list[str], join_str: str) -> str:
    """Join multiple columns into a single description string."""
    parts = []
    for col in columns:
        if col in row.index:
            val = str(row[col]).strip()
            if val and val.lower() not in ("nan", "none", ""):
                parts.append(val)
    return join_str.join(parts) or "No description"


def parse_csv(content: bytes, profile: CSVProfile) -> ParseResult:
    """
    Parse raw CSV bytes using a CSVProfile and return normalised transactions.

    Design notes:
    - Errors are collected per-row rather than aborting the whole import.
    - Rows that fail parsing are skipped and reported in ParseResult.errors.
    - Deduplication hash is computed here so the import service can skip
      rows already in the database.
    """
    errors: list[str] = []
    transactions: list[ParsedTransaction] = []
    skipped = 0

    # ── 1. Load into pandas ─────────────────────────────────────────────────
    try:
        df = pd.read_csv(
            io.BytesIO(content),
            delimiter=profile.delimiter,
            encoding=profile.encoding,
            skiprows=profile.skip_rows,
            dtype=str,          # keep everything as string; we parse manually
            skip_blank_lines=True,
        )
    except Exception as exc:
        return ParseResult(
            transactions=[],
            errors=[f"Failed to read CSV: {exc}"],
            total_rows=0,
            skipped_rows=0,
        )

    df.columns = [str(c).strip() for c in df.columns]
    total_rows = len(df)

    # ── 2. Validate required columns ────────────────────────────────────────
    required_cols: list[str] = []

    if profile.debit_column and profile.credit_column:
        required_cols += [profile.debit_column, profile.credit_column]
    else:
        required_cols.append(profile.amount_column)

    required_cols.append(profile.date_column)

    missing = [c for c in required_cols if c not in df.columns]
    if missing:
        return ParseResult(
            transactions=[],
            errors=[f"Missing required columns: {missing}. Available: {list(df.columns)}"],
            total_rows=total_rows,
            skipped_rows=total_rows,
        )

    # ── 3. Parse row by row ──────────────────────────────────────────────────
    for idx, row in df.iterrows():
        row_num = int(idx) + 1  # type: ignore[arg-type]
        raw_data = row.to_dict()

        # ── Date ──────────────────────────────────────────────────────────
        raw_date = str(row[profile.date_column]).strip()
        try:
            if profile.date_format:
                txn_date = pd.to_datetime(raw_date, format=profile.date_format).date()
            else:
                txn_date = dateutil_parser.parse(raw_date, dayfirst=True).date()
        except Exception:
            errors.append(f"Row {row_num}: cannot parse date '{raw_date}'")
            skipped += 1
            continue

        # ── Amount ─────────────────────────────────────────────────────────
        try:
            if profile.debit_column and profile.credit_column:
                # Some banks have separate debit / credit columns (always positive)
                raw_debit = str(row.get(profile.debit_column, "")).strip()
                raw_credit = str(row.get(profile.credit_column, "")).strip()

                debit = Decimal("0")
                credit = Decimal("0")

                if raw_debit and raw_debit.lower() not in ("nan", ""):
                    debit = abs(
                        _parse_amount(raw_debit, profile.decimal_separator, profile.thousands_separator)
                    )
                if raw_credit and raw_credit.lower() not in ("nan", ""):
                    credit = abs(
                        _parse_amount(raw_credit, profile.decimal_separator, profile.thousands_separator)
                    )

                # Convention: income is positive, expenses are negative
                amount = credit - debit
            else:
                amount = _parse_amount(
                    str(row[profile.amount_column]),
                    profile.decimal_separator,
                    profile.thousands_separator,
                )
                if profile.negate_amount:
                    amount = -amount

        except (InvalidOperation, ValueError) as exc:
            errors.append(f"Row {row_num}: cannot parse amount — {exc}")
            skipped += 1
            continue

        # ── Description ────────────────────────────────────────────────────
        description = _build_description(row, profile.description_columns, profile.description_join)
        # Truncate to model max length
        description = description[:500]

        txn_hash = _compute_hash(txn_date, amount, description)

        transactions.append(
            ParsedTransaction(
                date=txn_date,
                amount=amount,
                description=description,
                raw_data=raw_data,
                hash=txn_hash,
            )
        )

    logger.info(
        "CSV parse complete: %d rows, %d parsed, %d skipped, %d errors",
        total_rows,
        len(transactions),
        skipped,
        len(errors),
    )

    return ParseResult(
        transactions=transactions,
        errors=errors,
        total_rows=total_rows,
        skipped_rows=skipped,
    )
