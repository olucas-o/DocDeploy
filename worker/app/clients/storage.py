"""Restricted S3-compatible object client."""

from dataclasses import dataclass
from urllib.parse import urlparse


@dataclass(frozen=True)
class StorageReference:
    bucket: str
    key: str
    sha256: str


class PrivateStorageClient:
    def __init__(self, endpoint: str, bucket: str) -> None:
        parsed = urlparse(endpoint)
        if parsed.scheme not in {"http", "https"} or not parsed.hostname:
            raise ValueError("Invalid configured storage endpoint")
        self.endpoint = endpoint.rstrip("/")
        self.bucket = bucket

    @staticmethod
    def validate_reference(tenant_id: str, reference: StorageReference) -> None:
        zone, tenant, *_ = reference.key.split("/")
        if zone not in {"quarantine", "clean", "derived"} or tenant != tenant_id or ".." in reference.key:
            raise ValueError("Invalid object reference")
        if len(reference.sha256) != 64:
            raise ValueError("Invalid checksum")
