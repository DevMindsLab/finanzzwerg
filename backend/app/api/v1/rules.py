from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import DB, CurrentUser
from app.models.user import User
from app.schemas.rule import RuleCreate, RuleResponse, RuleUpdate
from app.services.rule_service import rule_service

router = APIRouter()


@router.get("/", response_model=list[RuleResponse])
def list_rules(
    active_only: bool = Query(default=False),
    db: Session = DB,
    current_user: User = CurrentUser,
):
    return rule_service.get_all(db, current_user.id, active_only=active_only)


@router.post("/", response_model=RuleResponse, status_code=status.HTTP_201_CREATED)
def create_rule(data: RuleCreate, db: Session = DB, current_user: User = CurrentUser):
    rule = rule_service.create(db, data, current_user.id)
    rule_service.reapply_all_rules(db, current_user.id)
    return rule


@router.get("/{rule_id}", response_model=RuleResponse)
def get_rule(rule_id: int, db: Session = DB, current_user: User = CurrentUser):
    rule = rule_service.get_by_id(db, rule_id, current_user.id)
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found.")
    return rule


@router.patch("/{rule_id}", response_model=RuleResponse)
def update_rule(rule_id: int, data: RuleUpdate, db: Session = DB, current_user: User = CurrentUser):
    rule = rule_service.update(db, rule_id, data, current_user.id)
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found.")
    rule_service.reapply_all_rules(db, current_user.id)
    return rule


@router.delete("/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_rule(rule_id: int, db: Session = DB, current_user: User = CurrentUser):
    if not rule_service.delete(db, rule_id, current_user.id):
        raise HTTPException(status_code=404, detail="Rule not found.")


@router.post("/apply", response_model=dict)
def apply_rules(db: Session = DB, current_user: User = CurrentUser):
    count = rule_service.reapply_all_rules(db, current_user.id)
    return {"categorized": count}
