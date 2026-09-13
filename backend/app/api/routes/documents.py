import logging
import os
import shutil
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, UploadFile

from app.api.deps import get_document_processor, get_rag_engine, get_session_id, get_vector_store
from app.core.config import Settings, get_settings
from app.core.exceptions import (
    DocumentNotFoundError,
    EmptyDocumentError,
    FileTooLargeError,
    SessionStorageLimitError,
    UnsupportedFileTypeError,
)
from app.core.file_validation import matches_declared_type
from app.core.files import secure_filename
from app.core.rate_limit import rate_limit_upload
from app.models.document import (
    ClearDocumentsResponse,
    DeleteDocumentResponse,
    DocumentUploadResponse,
    VectorStoreStats,
)
from app.services.document_processor import DocumentProcessor
from app.services.rag_engine import RAGEngine
from app.services.vector_store import VectorStore

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/documents", tags=["documents"])

_UPLOAD_READ_CHUNK_SIZE = 1024 * 1024  # 1MB


@router.post("", response_model=DocumentUploadResponse, dependencies=[Depends(rate_limit_upload)])
async def upload_document(
    file: UploadFile = File(...),
    session_id: str = Depends(get_session_id),
    settings: Settings = Depends(get_settings),
    document_processor: DocumentProcessor = Depends(get_document_processor),
    vector_store: VectorStore = Depends(get_vector_store),
):
    _, ext = os.path.splitext(file.filename or "")
    if ext.lower() not in document_processor.supported_formats:
        raise UnsupportedFileTypeError(
            f"File type not supported. Allowed: {', '.join(document_processor.supported_formats)}"
        )

    filename = secure_filename(file.filename or "upload")
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    unique_filename = f"{timestamp}_{filename}"

    session_upload_dir = settings.upload_dir / session_id
    session_upload_dir.mkdir(parents=True, exist_ok=True)

    # Coarse pre-check against the session's *existing* files - it doesn't
    # know the incoming file's size yet, so a single upload can still push
    # a session slightly over max_total_upload_mb_per_session. That's an
    # acceptable approximation here: the point is bounding unbounded growth
    # from many uploads, not enforcing the cap to the byte.
    existing_files = [f for f in session_upload_dir.iterdir() if f.is_file()]
    if len(existing_files) >= settings.max_documents_per_session:
        raise SessionStorageLimitError(
            f"This session already has the maximum of {settings.max_documents_per_session} documents. "
            "Delete one before uploading another."
        )

    max_total_bytes = settings.max_total_upload_mb_per_session * 1024 * 1024
    if sum(f.stat().st_size for f in existing_files) >= max_total_bytes:
        raise SessionStorageLimitError(
            f"This session has reached its {settings.max_total_upload_mb_per_session}MB storage limit. "
            "Delete some documents before uploading more."
        )

    filepath = session_upload_dir / unique_filename

    # Stream to disk in fixed-size chunks rather than `await file.read()`-ing
    # the whole body first: a client can claim any Content-Length (or none),
    # and reading everything into memory before checking the size limit
    # would let an oversized upload exhaust server memory before it's ever
    # rejected. This keeps peak memory bounded to one chunk regardless of
    # how large the request body actually is.
    total_size = 0
    header_checked = False
    try:
        with filepath.open("wb") as out_file:
            while chunk := await file.read(_UPLOAD_READ_CHUNK_SIZE):
                if not header_checked:
                    if not matches_declared_type(ext, chunk):
                        raise UnsupportedFileTypeError(
                            f"File content does not look like a valid {ext} file"
                        )
                    header_checked = True

                total_size += len(chunk)
                if total_size > settings.max_file_size_bytes:
                    raise FileTooLargeError(f"File too large. Maximum size is {settings.max_file_size_mb}MB")
                out_file.write(chunk)
    except (FileTooLargeError, UnsupportedFileTypeError):
        filepath.unlink(missing_ok=True)
        raise

    chunks = document_processor.process_file(str(filepath), session_id=session_id, source_name=filename)

    if not chunks:
        raise EmptyDocumentError("No text could be extracted from the document")

    num_added = vector_store.add_documents(chunks)
    doc_stats = document_processor.get_document_stats(chunks)

    logger.info(
        "Document uploaded",
        extra={"extra_fields": {"filename": filename, "chunks_created": num_added}},
    )

    return DocumentUploadResponse(filename=filename, chunks_created=num_added, stats=doc_stats)


@router.get("", response_model=VectorStoreStats)
async def list_documents(
    session_id: str = Depends(get_session_id),
    vector_store: VectorStore = Depends(get_vector_store),
):
    return vector_store.get_stats(filter_dict={"session_id": session_id})


@router.delete("", response_model=ClearDocumentsResponse)
async def clear_documents(
    session_id: str = Depends(get_session_id),
    settings: Settings = Depends(get_settings),
    vector_store: VectorStore = Depends(get_vector_store),
    rag_engine: RAGEngine = Depends(get_rag_engine),
):
    vector_store.clear_all(filter_dict={"session_id": session_id})
    rag_engine.clear_history(session_id)

    session_upload_dir = settings.upload_dir / session_id
    if session_upload_dir.exists():
        shutil.rmtree(session_upload_dir)

    return ClearDocumentsResponse(message="All documents and history cleared")


@router.delete("/{source}", response_model=DeleteDocumentResponse)
async def delete_document(
    source: str,
    session_id: str = Depends(get_session_id),
    vector_store: VectorStore = Depends(get_vector_store),
):
    deleted_count = vector_store.delete_by_source(source, filter_dict={"session_id": session_id})

    if deleted_count == 0:
        raise DocumentNotFoundError(f"No chunks found for source: {source}")

    return DeleteDocumentResponse(
        deleted_chunks=deleted_count,
        message=f"Deleted {deleted_count} chunks from {source}",
    )
