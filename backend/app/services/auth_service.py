from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.models.user import User
from app.schemas.auth import UserProfileUpdate, UserRegister


class AuthService:
    def get_by_id(self, db: Session, user_id: int) -> User | None:
        return db.query(User).filter(User.id == user_id).first()

    def get_by_email(self, db: Session, email: str) -> User | None:
        return db.query(User).filter(User.email == email).first()

    def register(self, db: Session, data: UserRegister) -> User:
        user = User(
            email=data.email.lower(),
            password_hash=hash_password(data.password),
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    def update_profile(self, db: Session, user: User, data: UserProfileUpdate) -> tuple[User, str | None]:
        """Update email and/or password. Returns (updated_user, error_message | None)."""
        if data.email is not None:
            new_email = data.email.lower()
            if new_email != user.email:
                taken = db.query(User).filter(User.email == new_email, User.id != user.id).first()
                if taken:
                    return user, "This email address is already in use."
                user.email = new_email

        if data.new_password is not None:
            if not data.current_password:
                return user, "Current password is required to set a new password."
            if not verify_password(data.current_password, user.password_hash):
                return user, "Current password is incorrect."
            user.password_hash = hash_password(data.new_password)

        db.commit()
        db.refresh(user)
        return user, None

    def delete_account(self, db: Session, user: User, password: str) -> str | None:
        """Verify password, then delete the user and all their data. Returns error or None."""
        if not verify_password(password, user.password_hash):
            return "Password is incorrect."

        # Import here to avoid circular imports
        from app.models.transaction import Transaction
        from app.models.rule import Rule
        from app.models.budget import Budget
        from app.models.import_job import ImportJob
        from app.models.csv_preset import CsvPreset
        from app.models.category import Category

        # Delete in FK-safe order: dependents before categories, categories before user
        db.query(Transaction).filter(Transaction.user_id == user.id).delete()
        db.query(Rule).filter(Rule.user_id == user.id).delete()
        db.query(Budget).filter(Budget.user_id == user.id).delete()
        db.query(ImportJob).filter(ImportJob.user_id == user.id).delete()
        db.query(CsvPreset).filter(CsvPreset.user_id == user.id).delete()
        db.query(Category).filter(Category.user_id == user.id).delete()
        db.delete(user)
        db.commit()
        return None

    def authenticate(self, db: Session, email: str, password: str) -> User | None:
        """Return the user if credentials are valid, otherwise None."""
        user = self.get_by_email(db, email.lower())
        if not user or not user.is_active:
            return None
        if not verify_password(password, user.password_hash):
            return None
        return user


auth_service = AuthService()
