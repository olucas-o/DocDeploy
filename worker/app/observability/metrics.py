"""Process-level Prometheus metrics for queue outcomes and dependencies."""

from datetime import datetime, timezone

from prometheus_client import CONTENT_TYPE_LATEST, Counter, Gauge, Histogram, generate_latest

PROCESSING_JOBS = Counter("docdeploy_processing_jobs_total", "Worker jobs processed", ("job_kind", "outcome"))
PROCESSING_DURATION = Histogram("docdeploy_processing_duration_seconds", "Worker processing duration", ("job_kind",))
DEAD_LETTERED_JOBS = Counter("docdeploy_dead_lettered_jobs_total", "Jobs moved to the dead-letter queue", ("job_kind",))
AI_ANALYSIS_FAILURES = Counter("docdeploy_ai_analysis_failures_total", "Optional AI analyses that failed without failing document processing")
DEPENDENCY_AVAILABLE = Gauge("docdeploy_dependency_available", "Configured dependency availability", ("dependency",))
QUEUE_JOB_AGE_SECONDS = Gauge("docdeploy_queue_job_age_seconds", "Age of the most recently started queue job", ("job_kind",))


def render_metrics() -> tuple[bytes, str]:
    return generate_latest(), CONTENT_TYPE_LATEST


def record_job_start(job_kind: str, requested_at: datetime) -> None:
    QUEUE_JOB_AGE_SECONDS.labels(job_kind).set(max(0.0, (datetime.now(timezone.utc) - requested_at).total_seconds()))


__all__ = ["AI_ANALYSIS_FAILURES", "DEAD_LETTERED_JOBS", "DEPENDENCY_AVAILABLE", "PROCESSING_DURATION", "PROCESSING_JOBS", "QUEUE_JOB_AGE_SECONDS", "record_job_start", "render_metrics"]
