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

    def authenticate(self, db: Session, email: str, password: str) -> User | None:
        """Return the user if credentials are valid, otherwise None."""
        user = self.get_by_email(db, email.lower())
        if not user or not user.is_active:
            return None
        if not verify_password(password, user.password_hash):
            return None
        return user


auth_service = AuthService()
