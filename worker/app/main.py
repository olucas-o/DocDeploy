"""Internal health surface for document processing."""

from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="DocDeploy Worker", version="1.0.0", docs_url=None, redoc_url=None)


class HealthResponse(BaseModel):
    service: str
    status: str


@app.get("/health", response_model=HealthResponse, tags=["health"])
def health_check() -> HealthResponse:
    return HealthResponse(service="worker", status="ok")
