"""Internal health surface for document processing."""

import asyncio
from contextlib import asynccontextmanager
from os import environ
from typing import AsyncIterator

from fastapi import FastAPI, Response
from pydantic import BaseModel

from app.observability.metrics import DEAD_LETTERED_JOBS, DEPENDENCY_AVAILABLE, render_metrics
from app.clients.storage import PrivateStorageClient, StorageReference
from app.consumers.document_processing import build_pipeline_handler, consume
from app.processors.virus_scan import ClamdInstreamClient


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    redis_url = environ.get("REDIS_URL")
    endpoint = environ.get("S3_ENDPOINT")
    if not redis_url or not endpoint:
        yield
        return
    from bullmq import Worker

    storage = PrivateStorageClient(endpoint, environ.get("S3_BUCKET", "docdeploy-private"))
    clamd = ClamdInstreamClient()

    async def load_content(job):
        source = StorageReference(job.source.bucket, job.source.key, job.source.sha256)
        return await asyncio.to_thread(storage.read_object, job.tenant_id, source, job.source.version_id)

    async def promote_object(job, destination_key: str) -> None:
        source = StorageReference(job.source.bucket, job.source.key, job.source.sha256)
        await asyncio.to_thread(storage.promote_clean, job.tenant_id, source, destination_key, job.source.version_id)

    async def write_extraction(job, key: str, fields: list[dict]) -> None:
        await asyncio.to_thread(storage.put_json, job.tenant_id, key, {"fields": fields})

    pipeline = build_pipeline_handler(load_content, clamd.scan, promote_object=promote_object, write_extraction=write_extraction)

    async def process(queue_job, _token: str):
        try:
            return await consume(queue_job.data, pipeline)
        except Exception:
            if queue_job.attemptsMade + 1 >= queue_job.attempts:
                DEAD_LETTERED_JOBS.labels(str(queue_job.name)).inc()
            raise

    worker = Worker("document-processing.v1", process, {"connection": redis_url, "concurrency": int(environ.get("WORKER_CONCURRENCY", "2"))})
    try:
        yield
    finally:
        await worker.close()


app = FastAPI(title="DocDeploy Worker", version="1.0.0", docs_url=None, redoc_url=None, lifespan=lifespan)


class HealthResponse(BaseModel):
    service: str
    status: str


@app.get("/health", response_model=HealthResponse, tags=["health"])
def health_check() -> HealthResponse:
    return HealthResponse(service="worker", status="ok")


@app.get("/metrics", include_in_schema=False)
def metrics() -> Response:
    _refresh_dependency_metrics()
    payload, content_type = render_metrics()
    return Response(content=payload, media_type=content_type)


def _refresh_dependency_metrics() -> None:
    import socket
    from urllib.error import URLError
    from urllib.request import urlopen
    from urllib.parse import urlparse

    redis_url = environ.get("REDIS_URL")
    if redis_url:
        parsed = urlparse(redis_url)
        DEPENDENCY_AVAILABLE.labels("redis").set(_tcp_available(parsed.hostname or "", parsed.port or 6379))
    clam_host = environ.get("CLAMD_HOST")
    if clam_host:
        DEPENDENCY_AVAILABLE.labels("clamav").set(_tcp_available(clam_host, int(environ.get("CLAMD_PORT", "3310"))))
    endpoint = environ.get("S3_ENDPOINT")
    if endpoint:
        try:
            with urlopen(f"{endpoint.rstrip('/')}/minio/health/live", timeout=1) as response:
                DEPENDENCY_AVAILABLE.labels("storage").set(1 if response.status < 500 else 0)
        except (OSError, URLError):
            DEPENDENCY_AVAILABLE.labels("storage").set(0)


def _tcp_available(host: str, port: int) -> int:
    import socket

    try:
        with socket.create_connection((host, port), timeout=1):
            return 1
    except OSError:
        return 0
