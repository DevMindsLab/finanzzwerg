from fastapi import APIRouter, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import DB, CurrentUser
from app.models.user import User
from app.schemas.category import CategoryCreate, CategoryResponse, CategoryUpdate
from app.services.category_service import category_service

router = APIRouter()


@router.get("/", response_model=list[CategoryResponse])
def list_categories(db: Session = DB, current_user: User = CurrentUser):
    categories = category_service.get_all(db, current_user.id)
    result = []
    for cat in categories:
        response = CategoryResponse.model_validate(cat)
        response.transaction_count = category_service.get_transaction_count(db, cat.id, current_user.id)
        result.append(response)
    return result


@router.post("/", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
def create_category(data: CategoryCreate, db: Session = DB, current_user: User = CurrentUser):
    if category_service.get_by_name(db, data.name, current_user.id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Category '{data.name}' already exists.",
        )
    return category_service.create(db, data, current_user.id)


@router.get("/{category_id}", response_model=CategoryResponse)
def get_category(category_id: int, db: Session = DB, current_user: User = CurrentUser):
    cat = category_service.get_by_id(db, category_id, current_user.id)
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found.")
    response = CategoryResponse.model_validate(cat)
    response.transaction_count = category_service.get_transaction_count(db, cat.id, current_user.id)
    return response


@router.patch("/{category_id}", response_model=CategoryResponse)
def update_category(category_id: int, data: CategoryUpdate, db: Session = DB, current_user: User = CurrentUser):
    if data.name:
        existing = category_service.get_by_name(db, data.name, current_user.id)
        if existing and existing.id != category_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Category '{data.name}' already exists.",
            )
    cat = category_service.update(db, category_id, data, current_user.id)
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found.")
    return cat


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(category_id: int, db: Session = DB, current_user: User = CurrentUser):
    cat = category_service.get_by_id(db, category_id, current_user.id)
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found.")
    if cat.is_default:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Default categories cannot be deleted.",
        )
    category_service.delete(db, category_id, current_user.id)
