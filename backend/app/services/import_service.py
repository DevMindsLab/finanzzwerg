"""
Import service — orchestrates CSV upload → parse → persist → rule-apply pipeline.

The heavy lifting runs synchronously in a FastAPI BackgroundTask so the HTTP
response returns immediately with the ImportJob id, and the client can poll
GET /imports/{id} for status updates.
"""

import logging
import os
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.config import settings
from app.core.csv_parser import ParseResult, parse_csv
from app.models.import_job import ImportJob, ImportJobStatus
from app.schemas.import_job import CSVProfile, ImportJobResponse
from app.schemas.transaction import TransactionCreate
from app.services.rule_service import rule_service
from app.services.transaction_service import transaction_service

logger = logging.getLogger(__name__)


class ImportService:
    def get_all(self, db: Session) -> list[ImportJob]:
        return db.query(ImportJob).order_by(ImportJob.created_at.desc()).all()

    def delete_all(self, db: Session) -> int:
        count = db.query(ImportJob).count()
        db.query(ImportJob).delete()
        db.commit()
        return count

    def get_by_id(self, db: Session, job_id: int) -> ImportJob | None:
        return db.query(ImportJob).filter(ImportJob.id == job_id).first()

    def create_job(self, db: Session, filename: str, profile: CSVProfile) -> ImportJob:
        job = ImportJob(
            filename=filename,
            status=ImportJobStatus.PENDING,
            csv_profile=profile.model_dump(),
        )
        db.add(job)
        db.commit()
        db.refresh(job)
        return job

    def process_job(self, db: Session, job_id: int, content: bytes) -> None:
        """
        Full pipeline: parse → deduplicate → persist → apply rules.

        This is called from a BackgroundTask and must NOT be async.
        """
        job = self.get_by_id(db, job_id)
        if not job:
            logger.error("ImportJob %d not found", job_id)
            return

        # ── 1. Mark as processing ────────────────────────────────────────────
        job.status = ImportJobStatus.PROCESSING
        db.commit()

        try:
            profile = CSVProfile(**job.csv_profile) if job.csv_profile else CSVProfile()
            result: ParseResult = parse_csv(content, profile)

            job.total_rows = result.total_rows

            if result.errors and not result.transactions:
                # Total failure — report and abort
                job.status = ImportJobStatus.FAILED
                job.error_message = "; ".join(result.errors[:5])
                db.commit()
                return

            # ── 2. Deduplicate ────────────────────────────────────────────────
            new_txns: list[TransactionCreate] = []
            duplicates = 0

            for parsed in result.transactions:
                if transaction_service.exists_by_hash(db, parsed.hash):
                    duplicates += 1
                    continue

                new_txns.append(
                    TransactionCreate(
                        date=parsed.date,
                        amount=parsed.amount,
                        description=parsed.description,
                        import_job_id=job_id,
                        raw_data=parsed.raw_data,
                        hash=parsed.hash,
                    )
                )

            # ── 3. Persist ────────────────────────────────────────────────────
            if new_txns:
                txns = transaction_service.create_batch(db, new_txns)
                new_ids = [t.id for t in txns]
            else:
                new_ids = []

            job.processed_rows = len(new_txns)
            job.duplicate_rows = duplicates

            if result.errors:
                # Partial errors — note them but still complete the job
                job.error_message = f"{len(result.errors)} row(s) skipped: " + "; ".join(
                    result.errors[:3]
                )

            # ── 4. Apply rules ────────────────────────────────────────────────
            if new_ids:
                categorized = rule_service.apply_rules_to_transactions(db, new_ids)
                logger.info(
                    "Job %d: %d new transactions, %d auto-categorized, %d duplicates",
                    job_id,
                    len(new_ids),
                    categorized,
                    duplicates,
                )

            job.status = ImportJobStatus.COMPLETED
            job.completed_at = datetime.now(tz=timezone.utc)
            db.commit()

        except Exception as exc:
            logger.exception("ImportJob %d failed", job_id)
            job.status = ImportJobStatus.FAILED
            job.error_message = str(exc)[:1000]
            job.completed_at = datetime.now(tz=timezone.utc)
            db.commit()


import_service = ImportService()
