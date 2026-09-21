"""Queue retry and failure policy shared by consumers."""

from dataclasses import dataclass
from random import uniform


@dataclass(frozen=True)
class ProcessingFailure(Exception):
    code: str
    category: str
    retryable: bool


def retry_delay(attempt: int, base_seconds: float = 1.0) -> float:
    if attempt < 1 or attempt > 5:
        raise ValueError("attempt must be between 1 and 5")
    ceiling = base_seconds * (2 ** (attempt - 1))
    return ceiling + uniform(0, ceiling * 0.25)


def classify_failure(code: str) -> ProcessingFailure:
    permanent = {"MALWARE", "UNSUPPORTED_FORMAT", "CORRUPT_FILE", "TENANT_MISMATCH", "UNKNOWN_SCHEMA"}
    return ProcessingFailure(code=code, category="permanent" if code in permanent else "dependency", retryable=code not in permanent)
