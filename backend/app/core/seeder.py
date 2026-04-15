"""
Seeds default categories on first startup if the table is empty.
"""

import logging

from sqlalchemy.orm import Session

from app.database import SessionLocal
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


def seed_default_categories() -> None:
    db: Session = SessionLocal()
    try:
        if db.query(Category).count() == 0:
            logger.info("Seeding default categories...")
            for cat_data in DEFAULT_CATEGORIES:
                db.add(Category(**cat_data, is_default=True))
            db.commit()
            logger.info("Default categories created.")
        else:
            logger.debug("Categories already exist, skipping seed.")
    except Exception:
        db.rollback()
        logger.exception("Failed to seed default categories")
    finally:
        db.close()
