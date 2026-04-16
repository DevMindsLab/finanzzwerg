from sqlalchemy.orm import Session

from app.models.csv_preset import CSVPreset
from app.schemas.import_job import CSVPresetCreate, CSVPresetUpdate


class PresetService:
    def get_all(self, db: Session, user_id: int) -> list[CSVPreset]:
        return db.query(CSVPreset).filter(CSVPreset.user_id == user_id).order_by(CSVPreset.name).all()

    def get_by_id(self, db: Session, preset_id: int, user_id: int) -> CSVPreset | None:
        return db.query(CSVPreset).filter(CSVPreset.id == preset_id, CSVPreset.user_id == user_id).first()

    def get_by_name(self, db: Session, name: str, user_id: int) -> CSVPreset | None:
        return db.query(CSVPreset).filter(CSVPreset.name == name, CSVPreset.user_id == user_id).first()

    def create(self, db: Session, data: CSVPresetCreate, user_id: int) -> CSVPreset:
        preset = CSVPreset(
            name=data.name,
            profile=data.profile.model_dump(),
            user_id=user_id,
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

    def set_default(self, db: Session, preset: CSVPreset, user_id: int) -> CSVPreset:
        """Mark preset as default for this user, clearing any existing default first."""
        db.query(CSVPreset).filter(CSVPreset.user_id == user_id, CSVPreset.is_default == True).update(  # noqa: E712
            {"is_default": False}
        )
        preset.is_default = True
        db.commit()
        db.refresh(preset)
        return preset

    def clear_default(self, db: Session, user_id: int) -> None:
        db.query(CSVPreset).filter(CSVPreset.user_id == user_id, CSVPreset.is_default == True).update(  # noqa: E712
            {"is_default": False}
        )
        db.commit()

    def delete(self, db: Session, preset: CSVPreset) -> None:
        db.delete(preset)
        db.commit()


preset_service = PresetService()
