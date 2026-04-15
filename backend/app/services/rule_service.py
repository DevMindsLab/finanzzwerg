"""
Rule engine — stores, retrieves, and applies categorisation rules.

Matching order:
  1. Rules sorted by priority DESC, then created_at ASC.
  2. First matching active rule wins.

Supported match types (designed for easy extension):
  - SUBSTRING: case-insensitive substring search
  - EXACT:     case-insensitive full-string comparison
  - REGEX:     full Python regex match against description
"""

import logging
import re

from sqlalchemy.orm import Session

from app.models.rule import MatchType, Rule
from app.models.transaction import Transaction, TransactionStatus
from app.schemas.rule import RuleCreate, RuleUpdate

logger = logging.getLogger(__name__)


class RuleService:
    def get_all(self, db: Session, active_only: bool = False) -> list[Rule]:
        q = db.query(Rule)
        if active_only:
            q = q.filter(Rule.is_active.is_(True))
        return q.order_by(Rule.priority.desc(), Rule.created_at.asc()).all()

    def get_by_id(self, db: Session, rule_id: int) -> Rule | None:
        return db.query(Rule).filter(Rule.id == rule_id).first()

    def create(self, db: Session, data: RuleCreate) -> Rule:
        rule = Rule(**data.model_dump())
        db.add(rule)
        db.commit()
        db.refresh(rule)
        return rule

    def update(self, db: Session, rule_id: int, data: RuleUpdate) -> Rule | None:
        rule = self.get_by_id(db, rule_id)
        if not rule:
            return None
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(rule, field, value)
        db.commit()
        db.refresh(rule)
        return rule

    def delete(self, db: Session, rule_id: int) -> bool:
        rule = self.get_by_id(db, rule_id)
        if not rule:
            return False
        db.delete(rule)
        db.commit()
        return True

    # ── Matching ─────────────────────────────────────────────────────────────

    def matches(self, rule: Rule, description: str) -> bool:
        """Return True if the rule pattern matches the given description."""
        desc_lower = description.lower()

        match rule.match_type:
            case MatchType.SUBSTRING:
                return rule.pattern.lower() in desc_lower
            case MatchType.EXACT:
                return rule.pattern.lower() == desc_lower
            case MatchType.REGEX:
                try:
                    return bool(re.search(rule.pattern, description, re.IGNORECASE))
                except re.error as exc:
                    logger.warning("Invalid regex in rule %d: %s", rule.id, exc)
                    return False
            case _:
                return False

    def find_matching_rule(self, rules: list[Rule], description: str) -> Rule | None:
        """Return the highest-priority rule that matches description, or None."""
        for rule in rules:  # already sorted by priority desc
            if rule.is_active and self.matches(rule, description):
                return rule
        return None

    # ── Bulk apply ───────────────────────────────────────────────────────────

    def apply_rules_to_transactions(
        self,
        db: Session,
        transaction_ids: list[int] | None = None,
    ) -> int:
        """
        Apply all active rules to uncategorized transactions.

        If transaction_ids is provided, only those transactions are processed.
        Returns the count of newly categorized transactions.
        """
        rules = self.get_all(db, active_only=True)
        if not rules:
            return 0

        q = db.query(Transaction).filter(
            Transaction.status == TransactionStatus.UNCATEGORIZED
        )
        if transaction_ids:
            q = q.filter(Transaction.id.in_(transaction_ids))

        transactions = q.all()
        categorized = 0

        for txn in transactions:
            rule = self.find_matching_rule(rules, txn.description)
            if rule:
                txn.category_id = rule.category_id
                txn.status = TransactionStatus.CATEGORIZED
                categorized += 1

        if categorized:
            db.commit()

        logger.info(
            "Rule engine: %d/%d transactions categorized", categorized, len(transactions)
        )
        return categorized


rule_service = RuleService()
