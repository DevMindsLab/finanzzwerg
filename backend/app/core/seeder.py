"""
Seeds default categories for a newly registered user.
"""

import logging

from sqlalchemy.orm import Session

from app.models.category import Category

logger = logging.getLogger(__name__)

DEFAULT_CATEGORIES: list[dict] = [
    {"name": "Income",        "color": "#10b981", "is_income": True,  "icon": "arrow-down-circle"},
    {"name": "Housing",       "color": "#3b82f6", "is_income": False, "icon": "home"},
    {"name": "Groceries",     "color": "#f97316", "is_income": False, "icon": "shopping-cart"},
    {"name": "Transport",     "color": "#eab308", "is_income": False, "icon": "car"},
    {"name": "Health",        "color": "#ef4444", "is_income": False, "icon": "heart"},
    {"name": "Leisure",       "color": "#a855f7", "is_income": False, "icon": "music"},
    {"name": "Subscriptions", "color": "#6366f1", "is_income": False, "icon": "refresh"},
    {"name": "Eating Out",    "color": "#f59e0b", "is_income": False, "icon": "utensils"},
    {"name": "Other",         "color": "#6b7280", "is_income": False, "icon": "tag"},
]


def seed_default_categories(db: Session, user_id: int) -> None:
    """Create default categories for a new user if they don't already have any."""
    try:
        existing = db.query(Category).filter(Category.user_id == user_id).count()
        if existing == 0:
            logger.info("Seeding default categories for user %d...", user_id)
            for cat_data in DEFAULT_CATEGORIES:
                db.add(Category(**cat_data, user_id=user_id, is_default=True))
            db.commit()
            logger.info("Default categories created for user %d.", user_id)
    except Exception:
        db.rollback()
        logger.exception("Failed to seed default categories for user %d", user_id)
