"""Internal document-processing service entry point."""

from dotenv import load_dotenv
from fastapi import FastAPI
from pydantic import BaseModel

load_dotenv()

app = FastAPI(
    title="DocDeploy Worker",
    version="0.1.0",
    docs_url="/docs",
    redoc_url=None,
)


class HealthResponse(BaseModel):
    service: str
    status: str


@app.get("/health", response_model=HealthResponse, tags=["health"])
def health_check() -> HealthResponse:
    """Return the worker readiness state without exposing configuration."""
    return HealthResponse(service="worker", status="ok")
