"""Signature validation and fail-closed ClamAV scanning over a private network.

The scan stage never releases document content: if the signature does not
match the declared type, if the byte stream looks like an executable/archive,
or if the antivirus daemon does not answer with an unambiguous verdict, the
object stays inaccessible and a permanent or retryable failure is raised.
"""

from collections.abc import Callable
from dataclasses import dataclass
from os import environ

from app.clients.queue import classify_failure

# Chunk size used both for the local size guard and for the INSTREAM protocol.
_DEFAULT_MAX_BYTES = 25 * 1024 * 1024
_INSTREAM_CHUNK_SIZE = 4096
_SOCKET_TIMEOUT_SECONDS = 10.0

_SIGNATURES: dict[str, tuple[bytes, ...]] = {
    "application/pdf": (b"%PDF-",),
    "image/png": (b"\x89PNG\r\n\x1a\n",),
    "image/jpeg": (b"\xff\xd8\xff",),
    "image/tiff": (b"II*\x00", b"MM\x00*"),
}

_EXECUTABLE_MAGIC: tuple[bytes, ...] = (b"MZ", b"\x7fELF")
_ZIP_MAGIC = b"PK\x03\x04"


@dataclass
class ScanFailure(Exception):
    """Sanitized, queue-safe representation of a scan-stage rejection."""

    code: str
    category: str
    retryable: bool
    message: str

    def __str__(self) -> str:  # pragma: no cover - trivial
        return self.message


def _fail(code: str, message: str) -> ScanFailure:
    verdict = classify_failure(code)
    return ScanFailure(code=verdict.code, category=verdict.category, retryable=verdict.retryable, message=message)


def validate_signature(content: bytes, content_type: str, *, max_bytes: int = _DEFAULT_MAX_BYTES) -> None:
    """Validate magic bytes, size limits and reject executables/archives.

    Raises ``ScanFailure`` (permanent, non retryable) for any mismatch so the
    caller never has to guess whether the content is safe to keep processing.
    """
    if not content:
        raise _fail("CORRUPT_FILE", "Empty document content")

    if len(content) > max_bytes:
        raise _fail("FILE_TOO_LARGE", "Document exceeds the configured size limit")

    if content.startswith(_EXECUTABLE_MAGIC):
        raise _fail("EXECUTABLE_CONTENT", "Executable content is not an accepted document format")

    if content.startswith(_ZIP_MAGIC):
        raise _fail("UNSUPPORTED_FORMAT", "Archive content is not an accepted document format")

    signatures = _SIGNATURES.get(content_type)
    if signatures is None:
        raise _fail("UNSUPPORTED_FORMAT", f"Content type {content_type} is not accepted")

    if not any(content.startswith(signature) for signature in signatures):
        raise _fail("CORRUPT_FILE", "Document bytes do not match the declared content type")

    if content_type == "application/pdf" and b"/Encrypt" in content[:4096]:
        raise _fail("ENCRYPTED_FILE", "Encrypted PDF documents are not accepted")


ScanTransport = Callable[[bytes], str]


def virus_scan(content: bytes, scan_transport: ScanTransport) -> str:
    """Run the antivirus verdict through ``scan_transport`` and fail closed.

    ``scan_transport`` receives the raw bytes and must return the raw clamd
    response line (e.g. ``"stream: OK"`` or ``"stream: Eicar-Test-Signature
    FOUND"``). Any exception, empty response or ambiguous verdict is treated
    as "unknown" and the content is kept inaccessible (fail closed).
    """
    try:
        verdict = scan_transport(content)
    except Exception as error:  # noqa: BLE001 - any transport error is fail-closed
        raise _fail("SCAN_UNAVAILABLE", "Antivirus scan did not respond") from error

    if not verdict or not isinstance(verdict, str):
        raise _fail("SCAN_UNAVAILABLE", "Antivirus scan returned no verdict")

    normalized = verdict.strip()
    if normalized.endswith("FOUND"):
        raise _fail("MALWARE", "Antivirus scan detected malware")

    if normalized.endswith("ERROR"):
        raise _fail("SCAN_UNAVAILABLE", "Antivirus scan reported an internal error")

    if normalized == "OK" or normalized.endswith(": OK") or normalized.endswith(" OK"):
        return "SCAN_PASSED"

    # Any other, unrecognized verdict is treated as uncertain: fail closed.
    raise _fail("SCAN_UNAVAILABLE", "Antivirus scan returned an unrecognized verdict")


class ClamdInstreamClient:
    """Minimal clamd INSTREAM client over a private TCP network.

    Host and port are configurable via ``CLAMD_HOST``/``CLAMD_PORT`` so the
    worker never hardcodes infrastructure details, keeping the scan traffic
    confined to a private network segment.
    """

    def __init__(self, host: str | None = None, port: int | None = None, timeout: float = _SOCKET_TIMEOUT_SECONDS) -> None:
        self.host = host or environ.get("CLAMD_HOST", "clamav.internal")
        self.port = port or int(environ.get("CLAMD_PORT", "3310"))
        self.timeout = timeout

    def scan(self, content: bytes) -> str:
        """Send ``content`` using the INSTREAM protocol and return the raw verdict line."""
        import socket

        with socket.create_connection((self.host, self.port), timeout=self.timeout) as sock:
            sock.sendall(b"zINSTREAM\0")
            for offset in range(0, len(content), _INSTREAM_CHUNK_SIZE):
                chunk = content[offset : offset + _INSTREAM_CHUNK_SIZE]
                sock.sendall(len(chunk).to_bytes(4, byteorder="big") + chunk)
            sock.sendall((0).to_bytes(4, byteorder="big"))
            response = b""
            while True:
                data = sock.recv(4096)
                if not data:
                    break
                response += data
        return response.decode("utf-8", errors="replace").strip("\0").strip()


__all__ = ["ClamdInstreamClient", "ScanFailure", "ScanTransport", "validate_signature", "virus_scan"]
