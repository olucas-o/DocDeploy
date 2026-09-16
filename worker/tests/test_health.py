"""Tests for the worker readiness endpoint."""

from main import health_check


def test_health_check_reports_worker_ready() -> None:
    """The direct health handler exposes only a safe readiness payload."""
    assert health_check().model_dump() == {"service": "worker", "status": "ok"}
