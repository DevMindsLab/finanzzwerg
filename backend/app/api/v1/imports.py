from fastapi import APIRouter, BackgroundTasks, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.api.deps import DB
from app.config import settings
from app.schemas.import_job import CSVProfile, ImportJobResponse
from app.services.import_service import import_service

router = APIRouter()


@router.get("/", response_model=list[ImportJobResponse])
def list_import_jobs(db: Session = DB):
    return import_service.get_all(db)


@router.delete("/", status_code=status.HTTP_204_NO_CONTENT)
def clear_import_history(db: Session = DB):
    """Delete all import jobs."""
    import_service.delete_all(db)


@router.get("/{job_id}", response_model=ImportJobResponse)
def get_import_job(job_id: int, db: Session = DB):
    job = import_service.get_by_id(db, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Import job not found.")
    return job


@router.post("/upload", response_model=ImportJobResponse, status_code=status.HTTP_202_ACCEPTED)
async def upload_csv(
    file: UploadFile,
    background_tasks: BackgroundTasks,
    # CSV profile fields passed as query params / form fields
    delimiter: str = ",",
    encoding: str = "utf-8",
    skip_rows: int = 0,
    date_column: str = "date",
    date_format: str = "%Y-%m-%d",
    amount_column: str = "amount",
    debit_column: str | None = None,
    credit_column: str | None = None,
    decimal_separator: str = ".",
    thousands_separator: str = "",
    description_columns: str = "description",  # comma-separated column names
    description_join: str = " | ",
    negate_amount: bool = False,
    db: Session = DB,
):
    """
    Upload a CSV file for import.

    Returns an ImportJob immediately (HTTP 202). Processing happens in the
    background. Poll GET /imports/{id} to track progress.
    """
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only .csv files are accepted.",
        )

    content = await file.read()

    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds the {settings.MAX_UPLOAD_SIZE_MB} MB limit.",
        )

    profile = CSVProfile(
        delimiter=delimiter,
        encoding=encoding,
        skip_rows=skip_rows,
        date_column=date_column,
        date_format=date_format,
        amount_column=amount_column,
        debit_column=debit_column or None,
        credit_column=credit_column or None,
        decimal_separator=decimal_separator,
        thousands_separator=thousands_separator,
        description_columns=[c.strip() for c in description_columns.split(",")],
        description_join=description_join,
        negate_amount=negate_amount,
    )

    job = import_service.create_job(db, file.filename, profile)

    # Kick off background processing — DB session is re-created inside
    background_tasks.add_task(_run_import, job.id, content)

    return job


def _run_import(job_id: int, content: bytes) -> None:
    """Background task wrapper that manages its own DB session."""
    from app.database import SessionLocal

    db = SessionLocal()
    try:
        import_service.process_job(db, job_id, content)
    finally:
        db.close()
