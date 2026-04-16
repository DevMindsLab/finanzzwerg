from fastapi import APIRouter, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import DB, CurrentUser
from app.core.security import create_access_token
from app.core.seeder import seed_default_categories
from app.models.user import User
from app.schemas.auth import TokenResponse, UserLogin, UserProfileUpdate, UserRegister, UserResponse
from app.services.auth_service import auth_service

router = APIRouter()


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(data: UserRegister, db: Session = DB):
    if auth_service.get_by_email(db, data.email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )
    user = auth_service.register(db, data)
    # Seed default categories for the new user
    seed_default_categories(db, user.id)
    token = create_access_token(user.id)
    return TokenResponse(access_token=token, user=UserResponse.model_validate(user))


@router.post("/login", response_model=TokenResponse)
def login(data: UserLogin, db: Session = DB):
    user = auth_service.authenticate(db, data.email, data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )
    token = create_access_token(user.id)
    return TokenResponse(access_token=token, user=UserResponse.model_validate(user))


@router.get("/me", response_model=UserResponse)
def me(current_user: User = CurrentUser):
    return current_user


@router.patch("/me", response_model=UserResponse)
def update_me(data: UserProfileUpdate, db: Session = DB, current_user: User = CurrentUser):
    updated, error = auth_service.update_profile(db, current_user, data)
    if error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error)
    return updated
