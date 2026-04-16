from datetime import date
from decimal import Decimal

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import DB
from app.models.transaction import TransactionStatus
from app.schemas.rule import RuleCreate
from app.schemas.transaction import (
    BulkCategorize,
    TransactionCategorize,
    TransactionListResponse,
    TransactionResponse,
    TransactionUpdate,
)
from app.services.rule_service import rule_service
from app.services.transaction_service import transaction_service

router = APIRouter()


@router.get("/", response_model=TransactionListResponse)
def list_transactions(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    status: TransactionStatus | None = None,
    category_id: int | None = None,
    search: str | None = Query(default=None, max_length=200),
    date_from: date | None = None,
    date_to: date | None = None,
    amount_min: Decimal | None = None,
    amount_max: Decimal | None = None,
    db: Session = DB,
):
    return transaction_service.get_list(
        db,
        page=page,
        page_size=page_size,
        status=status,
        category_id=category_id,
        search=search,
        date_from=date_from,
        date_to=date_to,
        amount_min=amount_min,
        amount_max=amount_max,
    )


@router.get("/inbox", response_model=TransactionListResponse)
def get_inbox(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    search: str | None = Query(default=None, max_length=200),
    date_from: date | None = None,
    date_to: date | None = None,
    amount_min: Decimal | None = None,
    amount_max: Decimal | None = None,
    db: Session = DB,
):
    """Return only uncategorized transactions — the Inbox view."""
    return transaction_service.get_list(
        db,
        page=page,
        page_size=page_size,
        status=TransactionStatus.UNCATEGORIZED,
        search=search,
        date_from=date_from,
        date_to=date_to,
        amount_min=amount_min,
        amount_max=amount_max,
    )


@router.get("/inbox/count", response_model=dict)
def get_inbox_count(db: Session = DB):
    return {"count": transaction_service.get_inbox_count(db)}


@router.get("/{txn_id}", response_model=TransactionResponse)
def get_transaction(txn_id: int, db: Session = DB):
    txn = transaction_service.get_by_id(db, txn_id)
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found.")
    return txn


@router.patch("/{txn_id}", response_model=TransactionResponse)
def update_transaction(txn_id: int, data: TransactionUpdate, db: Session = DB):
    txn = transaction_service.update(db, txn_id, data)
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found.")
    return txn


@router.post("/{txn_id}/categorize", response_model=TransactionResponse)
def categorize_transaction(txn_id: int, data: TransactionCategorize, db: Session = DB):
    """
    Categorize a transaction.

    Optionally create a rule for future auto-categorization:
    set create_rule=true and provide a rule_pattern.
    """
    txn = transaction_service.categorize(db, txn_id, data)
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found.")

    if data.create_rule and data.rule_pattern:
        rule_create = RuleCreate(
            name=f"Auto: {data.rule_pattern[:80]}",
            pattern=data.rule_pattern,
            category_id=data.category_id,
        )
        rule_service.create(db, rule_create)

    return txn


@router.post("/bulk-categorize", response_model=dict)
def bulk_categorize(data: BulkCategorize, db: Session = DB):
    updated = transaction_service.bulk_categorize(db, data)
    return {"updated": updated}


@router.delete("/{txn_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_transaction(txn_id: int, db: Session = DB):
    if not transaction_service.delete(db, txn_id):
        raise HTTPException(status_code=404, detail="Transaction not found.")
