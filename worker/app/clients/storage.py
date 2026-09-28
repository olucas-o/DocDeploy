"""Restricted S3-compatible object client."""

from dataclasses import dataclass
from hashlib import sha256
import json
from os import environ
from urllib.parse import urlparse

import boto3


@dataclass(frozen=True)
class StorageReference:
    bucket: str
    key: str
    sha256: str


class PrivateStorageClient:
    def __init__(self, endpoint: str, bucket: str, *, access_key: str | None = None, secret_key: str | None = None) -> None:
        parsed = urlparse(endpoint)
        if parsed.scheme not in {"http", "https"} or not parsed.hostname:
            raise ValueError("Invalid configured storage endpoint")
        self.endpoint = endpoint.rstrip("/")
        self.bucket = bucket
        self.client = boto3.client(
            "s3", endpoint_url=self.endpoint, region_name=environ.get("S3_REGION", "us-east-1"),
            aws_access_key_id=access_key or environ.get("S3_ACCESS_KEY"),
            aws_secret_access_key=secret_key or environ.get("S3_SECRET_KEY"),
        )

    @staticmethod
    def validate_reference(tenant_id: str, reference: StorageReference) -> None:
        zone, tenant, *_ = reference.key.split("/")
        if zone not in {"quarantine", "clean", "derived"} or tenant != tenant_id or ".." in reference.key:
            raise ValueError("Invalid object reference")
        if len(reference.sha256) != 64:
            raise ValueError("Invalid checksum")

    def read_object(self, tenant_id: str, reference: StorageReference, version_id: str | None = None) -> bytes:
        if reference.bucket != self.bucket:
            raise ValueError("Object bucket is outside the configured private storage boundary")
        self.validate_reference(tenant_id, reference)
        result = self.client.get_object(Bucket=reference.bucket, Key=reference.key, **({"VersionId": version_id} if version_id else {}))
        content = result["Body"].read()
        if sha256(content).hexdigest() != reference.sha256:
            raise ValueError("Stored object checksum does not match its immutable reference")
        return content

    def promote_clean(self, tenant_id: str, source: StorageReference, destination_key: str, version_id: str | None = None) -> None:
        if source.bucket != self.bucket:
            raise ValueError("Object bucket is outside the configured private storage boundary")
        self.validate_reference(tenant_id, source)
        self.validate_reference(tenant_id, StorageReference(source.bucket, destination_key, source.sha256))
        self.client.copy_object(
            Bucket=source.bucket, Key=destination_key,
            CopySource={"Bucket": source.bucket, "Key": source.key, **({"VersionId": version_id} if version_id else {})},
            MetadataDirective="COPY",
        )

    def put_json(self, tenant_id: str, key: str, value: object) -> None:
        self.validate_reference(tenant_id, StorageReference(self.bucket, key, "0" * 64))
        body = json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        self.client.put_object(Bucket=self.bucket, Key=key, Body=body, ContentType="application/json", ServerSideEncryption="AES256")
