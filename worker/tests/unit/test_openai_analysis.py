"""Regression protection for consent, privacy, and review-only AI results."""

import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.processors.openai_analysis import analyze_text, redact_sensitive_text


def test_disabled_analysis_never_contacts_provider() -> None:
    create = AsyncMock(side_effect=AssertionError("Provider called without consent"))
    client = SimpleNamespace(responses=SimpleNamespace(create=create))

    assert asyncio.run(analyze_text("confidential", enabled=False, client=client)) is None
    create.assert_not_awaited()


def test_missing_credentials_skips_optional_analysis(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    assert asyncio.run(analyze_text("Invoice", enabled=True)) is None


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("Email: person@example.com", "Email: [REDACTED_EMAIL]"),
        ("CPF: 123.456.789-09", "CPF: [REDACTED_CPF]"),
        ("CNPJ: 12.345.678/0001-90", "CNPJ: [REDACTED_CNPJ]"),
        ("Phone: +55 (11) 98765-4321", "Phone: [REDACTED_PHONE]"),
        ("Issuer: ACME; Value: 120.50", "Issuer: ACME; Value: 120.50"),
    ],
)
def test_redaction_removes_identifiers_but_preserves_document_values(text: str, expected: str) -> None:
    assert redact_sensitive_text(text) == expected


def test_provider_receives_redacted_bounded_text_without_storage() -> None:
    create = AsyncMock(return_value=SimpleNamespace(output_text='{"suggestions": []}'))
    client = SimpleNamespace(responses=SimpleNamespace(create=create))

    asyncio.run(analyze_text("person@example.com " + "x" * 13000, enabled=True, client=client))

    create.assert_awaited_once()
    request = create.call_args.kwargs
    assert request["store"] is False
    assert request["input"][1] == {"role": "user", "content": "[REDACTED_EMAIL] " + "x" * 11983}


def test_valid_suggestions_remain_subject_to_human_review() -> None:
    create = AsyncMock(return_value=SimpleNamespace(
        output_text='{"suggestions": [{"field": "issuer", "value": "ACME", "evidence": "Issuer: ACME"}]}'
    ))
    client = SimpleNamespace(responses=SimpleNamespace(create=create))

    result = asyncio.run(analyze_text("Issuer: ACME", enabled=True, client=client))

    assert result == {
        "suggestions": [{"field": "issuer", "value": "ACME", "evidence": "Issuer: ACME"}],
        "source": "ai",
        "requiresHumanReview": True,
    }


@pytest.mark.parametrize("output", ["invalid JSON", "null", "[]", "{}", '{"suggestions": null}', '{"suggestions": {}}'])
def test_invalid_provider_output_yields_no_suggestions(output: str) -> None:
    create = AsyncMock(return_value=SimpleNamespace(output_text=output))
    client = SimpleNamespace(responses=SimpleNamespace(create=create))

    result = asyncio.run(analyze_text("Invoice", enabled=True, client=client))

    assert result == {"suggestions": [], "source": "ai", "requiresHumanReview": True}
