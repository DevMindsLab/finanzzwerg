from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.models.user import User
from app.schemas.auth import UserRegister


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

    def authenticate(self, db: Session, email: str, password: str) -> User | None:
        """Return the user if credentials are valid, otherwise None."""
        user = self.get_by_email(db, email.lower())
        if not user or not user.is_active:
            return None
        if not verify_password(password, user.password_hash):
            return None
        return user


auth_service = AuthService()
