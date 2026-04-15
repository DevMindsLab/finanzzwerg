from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import DB
from app.schemas.rule import RuleCreate, RuleResponse, RuleUpdate
from app.services.rule_service import rule_service

router = APIRouter()


@router.get("/", response_model=list[RuleResponse])
def list_rules(
    active_only: bool = Query(default=False, description="Return only active rules"),
    db: Session = DB,
):
    return rule_service.get_all(db, active_only=active_only)


@router.post("/", response_model=RuleResponse, status_code=status.HTTP_201_CREATED)
def create_rule(data: RuleCreate, db: Session = DB):
    return rule_service.create(db, data)


@router.get("/{rule_id}", response_model=RuleResponse)
def get_rule(rule_id: int, db: Session = DB):
    rule = rule_service.get_by_id(db, rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found.")
    return rule


@router.patch("/{rule_id}", response_model=RuleResponse)
def update_rule(rule_id: int, data: RuleUpdate, db: Session = DB):
    rule = rule_service.update(db, rule_id, data)
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found.")
    return rule


@router.delete("/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_rule(rule_id: int, db: Session = DB):
    if not rule_service.delete(db, rule_id):
        raise HTTPException(status_code=404, detail="Rule not found.")


@router.post("/apply", response_model=dict)
def apply_rules(db: Session = DB):
    """Re-apply all active rules to every uncategorized transaction."""
    count = rule_service.apply_rules_to_transactions(db)
    return {"categorized": count}
