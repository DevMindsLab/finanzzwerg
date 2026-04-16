from fastapi import APIRouter, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import DB
from app.schemas.import_job import CSVPresetCreate, CSVPresetResponse, CSVPresetUpdate
from app.services.preset_service import preset_service

router = APIRouter()


@router.get("/", response_model=list[CSVPresetResponse])
def list_presets(db: Session = DB):
    return preset_service.get_all(db)


@router.post("/", response_model=CSVPresetResponse, status_code=status.HTTP_201_CREATED)
def create_preset(data: CSVPresetCreate, db: Session = DB):
    if preset_service.get_by_name(db, data.name):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A preset named '{data.name}' already exists.",
        )
    return preset_service.create(db, data)


@router.put("/{preset_id}", response_model=CSVPresetResponse)
def update_preset(preset_id: int, data: CSVPresetUpdate, db: Session = DB):
    preset = preset_service.get_by_id(db, preset_id)
    if not preset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Preset not found.")
    if data.name and data.name != preset.name:
        existing = preset_service.get_by_name(db, data.name)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"A preset named '{data.name}' already exists.",
            )
    return preset_service.update(db, preset, data)


@router.delete("/{preset_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_preset(preset_id: int, db: Session = DB):
    preset = preset_service.get_by_id(db, preset_id)
    if not preset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Preset not found.")
    preset_service.delete(db, preset)
