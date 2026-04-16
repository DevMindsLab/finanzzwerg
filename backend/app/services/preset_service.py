from sqlalchemy.orm import Session

from app.models.csv_preset import CSVPreset
from app.schemas.import_job import CSVPresetCreate, CSVPresetUpdate


class PresetService:
    def get_all(self, db: Session) -> list[CSVPreset]:
        return db.query(CSVPreset).order_by(CSVPreset.name).all()

    def get_by_id(self, db: Session, preset_id: int) -> CSVPreset | None:
        return db.query(CSVPreset).filter(CSVPreset.id == preset_id).first()

    def get_by_name(self, db: Session, name: str) -> CSVPreset | None:
        return db.query(CSVPreset).filter(CSVPreset.name == name).first()

    def create(self, db: Session, data: CSVPresetCreate) -> CSVPreset:
        preset = CSVPreset(
            name=data.name,
            profile=data.profile.model_dump(),
        )
        db.add(preset)
        db.commit()
        db.refresh(preset)
        return preset

    def update(self, db: Session, preset: CSVPreset, data: CSVPresetUpdate) -> CSVPreset:
        if data.name is not None:
            preset.name = data.name
        if data.profile is not None:
            preset.profile = data.profile.model_dump()
        db.commit()
        db.refresh(preset)
        return preset

    def delete(self, db: Session, preset: CSVPreset) -> None:
        db.delete(preset)
        db.commit()


preset_service = PresetService()
