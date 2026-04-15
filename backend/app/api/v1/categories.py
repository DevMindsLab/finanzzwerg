from fastapi import APIRouter, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import DB
from app.schemas.category import CategoryCreate, CategoryResponse, CategoryUpdate
from app.services.category_service import category_service

router = APIRouter()


@router.get("/", response_model=list[CategoryResponse])
def list_categories(db: Session = DB):
    categories = category_service.get_all(db)
    result = []
    for cat in categories:
        response = CategoryResponse.model_validate(cat)
        response.transaction_count = category_service.get_transaction_count(db, cat.id)
        result.append(response)
    return result


@router.post("/", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
def create_category(data: CategoryCreate, db: Session = DB):
    if category_service.get_by_name(db, data.name):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Category '{data.name}' already exists.",
        )
    return category_service.create(db, data)


@router.get("/{category_id}", response_model=CategoryResponse)
def get_category(category_id: int, db: Session = DB):
    cat = category_service.get_by_id(db, category_id)
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found.")
    response = CategoryResponse.model_validate(cat)
    response.transaction_count = category_service.get_transaction_count(db, cat.id)
    return response


@router.patch("/{category_id}", response_model=CategoryResponse)
def update_category(category_id: int, data: CategoryUpdate, db: Session = DB):
    if data.name:
        existing = category_service.get_by_name(db, data.name)
        if existing and existing.id != category_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Category '{data.name}' already exists.",
            )
    cat = category_service.update(db, category_id, data)
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found.")
    return cat


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(category_id: int, db: Session = DB):
    cat = category_service.get_by_id(db, category_id)
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found.")
    if cat.is_default:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Default categories cannot be deleted.",
        )
    category_service.delete(db, category_id)
