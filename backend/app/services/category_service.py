from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.category import Category
from app.models.transaction import Transaction
from app.schemas.category import CategoryCreate, CategoryUpdate


class CategoryService:
    def get_all(self, db: Session) -> list[Category]:
        return db.query(Category).order_by(Category.name).all()

    def get_by_id(self, db: Session, category_id: int) -> Category | None:
        return db.query(Category).filter(Category.id == category_id).first()

    def get_by_name(self, db: Session, name: str) -> Category | None:
        return db.query(Category).filter(Category.name == name).first()

    def create(self, db: Session, data: CategoryCreate) -> Category:
        category = Category(**data.model_dump())
        db.add(category)
        db.commit()
        db.refresh(category)
        return category

    def update(self, db: Session, category_id: int, data: CategoryUpdate) -> Category | None:
        category = self.get_by_id(db, category_id)
        if not category:
            return None
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(category, field, value)
        db.commit()
        db.refresh(category)
        return category

    def delete(self, db: Session, category_id: int) -> bool:
        category = self.get_by_id(db, category_id)
        if not category:
            return False
        # Unlink transactions before deleting
        db.query(Transaction).filter(Transaction.category_id == category_id).update(
            {"category_id": None}
        )
        db.delete(category)
        db.commit()
        return True

    def get_transaction_count(self, db: Session, category_id: int) -> int:
        result = (
            db.query(func.count(Transaction.id))
            .filter(Transaction.category_id == category_id)
            .scalar()
        )
        return result or 0


category_service = CategoryService()
