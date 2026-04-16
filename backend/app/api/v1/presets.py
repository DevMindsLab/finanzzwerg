from fastapi import APIRouter, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import DB, CurrentUser
from app.models.user import User
from app.schemas.import_job import CSVPresetCreate, CSVPresetResponse, CSVPresetUpdate
from app.services.preset_service import preset_service

router = APIRouter()


@router.get("/", response_model=list[CSVPresetResponse])
def list_presets(db: Session = DB, current_user: User = CurrentUser):
    return preset_service.get_all(db, current_user.id)


@router.post("/", response_model=CSVPresetResponse, status_code=status.HTTP_201_CREATED)
def create_preset(data: CSVPresetCreate, db: Session = DB, current_user: User = CurrentUser):
    if preset_service.get_by_name(db, data.name, current_user.id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A preset named '{data.name}' already exists.",
        )
    return preset_service.create(db, data, current_user.id)


@router.put("/{preset_id}", response_model=CSVPresetResponse)
def update_preset(preset_id: int, data: CSVPresetUpdate, db: Session = DB, current_user: User = CurrentUser):
    preset = preset_service.get_by_id(db, preset_id, current_user.id)
    if not preset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Preset not found.")
    if data.name and data.name != preset.name:
        existing = preset_service.get_by_name(db, data.name, current_user.id)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"A preset named '{data.name}' already exists.",
            )
    return preset_service.update(db, preset, data)


@router.post("/{preset_id}/set-default", response_model=CSVPresetResponse)
def set_default_preset(preset_id: int, db: Session = DB, current_user: User = CurrentUser):
    preset = preset_service.get_by_id(db, preset_id, current_user.id)
    if not preset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Preset not found.")
    return preset_service.set_default(db, preset, current_user.id)


@router.delete("/default", status_code=status.HTTP_204_NO_CONTENT)
def clear_default_preset(db: Session = DB, current_user: User = CurrentUser):
    preset_service.clear_default(db, current_user.id)


@router.delete("/{preset_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_preset(preset_id: int, db: Session = DB, current_user: User = CurrentUser):
    preset = preset_service.get_by_id(db, preset_id, current_user.id)
    if not preset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Preset not found.")
    preset_service.delete(db, preset)
