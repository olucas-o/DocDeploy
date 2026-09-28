"""Opt-in, privacy-minimized suggestions from the OpenAI Responses API."""

import json
import re
from os import environ
from typing import Any

_EMAIL = re.compile(r"\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b")
_CPF = re.compile(r"\b\d{3}[. ]?\d{3}[. ]?\d{3}[- ]?\d{2}\b")
_CNPJ = re.compile(r"\b\d{2}[. ]?\d{3}[. ]?\d{3}[/ ]?\d{4}[- ]?\d{2}\b")
_PHONE = re.compile(r"(?<!\w)(?:\+?\d{1,3}[ .-]?)?(?:\(?\d{2,3}\)?[ .-]?)?\d{4,5}[ .-]?\d{4}(?!\w)")


def redact_sensitive_text(text: str) -> str:
    """Remove common direct identifiers before any optional external analysis."""
    return _PHONE.sub("[REDACTED_PHONE]", _CNPJ.sub("[REDACTED_CNPJ]", _CPF.sub("[REDACTED_CPF]", _EMAIL.sub("[REDACTED_EMAIL]", text))))


async def analyze_text(text: str, *, enabled: bool, client: Any | None = None) -> dict[str, Any] | None:
    """Return review-only suggestions; disabled organizations never call the provider."""
    if not enabled:
        return None
    api_key = environ.get("OPENAI_API_KEY", "")
    if client is None:
        if not api_key:
            return None
        from openai import AsyncOpenAI

        client = AsyncOpenAI(api_key=api_key)
    response = await client.responses.create(
        model=environ.get("OPENAI_MODEL", "gpt-5-mini"),
        store=False,
        text={"format": {"type": "json_schema", "name": "document_suggestions", "strict": True, "schema": {
            "type": "object", "properties": {"suggestions": {"type": "array", "items": {"type": "object", "properties": {
                "field": {"type": "string"}, "value": {"type": "string"}, "evidence": {"type": "string"},
            }, "required": ["field", "value", "evidence"], "additionalProperties": False}}},
            "required": ["suggestions"], "additionalProperties": False,
        } }},
        input=[
            {"role": "system", "content": "Return JSON with a suggestions array of {field, value, evidence}. Suggestions require human review and are never decisions."},
            {"role": "user", "content": redact_sensitive_text(text)[:12000]},
        ],
    )
    output = getattr(response, "output_text", "")
    try:
        parsed = json.loads(output)
    except (TypeError, json.JSONDecodeError):
        parsed = {"suggestions": []}
    suggestions = parsed.get("suggestions", []) if isinstance(parsed, dict) else []
    return {"suggestions": suggestions if isinstance(suggestions, list) else [], "source": "ai", "requiresHumanReview": True}


__all__ = ["analyze_text", "redact_sensitive_text"]
