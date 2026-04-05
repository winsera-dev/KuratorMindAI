"""
Test Suite: Legal Compliance (UU 37/2004)

Verifies the Article 2 and 8 triggers for bankruptcy eligibility.
"""

import pytest
from kuratormind.services.compliance import check_bankruptcy_eligibility

def test_article_2_trigger_met():
    """Verify Article 2: At least 2 creditors."""
    claims = [
        {"creditor_name": "Bank BCA", "metadata": {}},
        {"creditor_name": "Bank Mandiri", "metadata": {}}
    ]
    result = check_bankruptcy_eligibility(claims)
    assert result["article_2"]["status"] is True
    assert result["article_2"]["creditor_count"] == 2

def test_article_2_trigger_not_met():
    """Verify Article 2 fails with only 1 creditor."""
    claims = [
        {"creditor_name": "Bank BCA", "metadata": {}}
    ]
    result = check_bankruptcy_eligibility(claims)
    assert result["article_2"]["status"] is False
    assert result["eligible"] is False

def test_article_8_trigger_met():
    """Verify Article 8: At least 1 matured debt."""
    claims = [
        {"creditor_name": "Bank BCA", "metadata": {"is_matured": True}},
        {"creditor_name": "Bank Mandiri", "metadata": {"is_matured": False}}
    ]
    result = check_bankruptcy_eligibility(claims)
    assert result["article_8"]["status"] is True
    assert result["article_8"]["matured_claims_count"] == 1
    assert "Bank BCA" in result["article_8"]["matured_claims"]

def test_article_8_trigger_not_met():
    """Verify Article 8 fails with no matured debt."""
    claims = [
        {"creditor_name": "Bank BCA", "metadata": {"is_matured": False}},
        {"creditor_name": "Bank Mandiri", "metadata": {"jatuh_tempo": False}}
    ]
    result = check_bankruptcy_eligibility(claims)
    assert result["article_8"]["status"] is False
    assert result["eligible"] is False

def test_full_bankruptcy_eligibility():
    """Verify full eligibility (Article 2, Article 8, AND Simple Proof)."""
    claims = [
        {"creditor_name": "Bank BCA", "metadata": {"is_matured": True, "document_type": "Invoice #123"}},
        {"creditor_name": "Bank Mandiri", "metadata": {"is_matured": False}}
    ]
    result = check_bankruptcy_eligibility(claims)
    assert result["eligible"] is True
    assert not result["reasons"]

def test_simple_proof_not_met():
    """Verify failure when one of the matured claims lacks legal documentation."""
    claims = [
        {"creditor_name": "Bank BCA", "metadata": {"is_matured": True, "document_type": "Invoice #123"}},
        {"creditor_name": "Bank Mandiri", "metadata": {"is_matured": True}} # Missing document_type
    ]
    result = check_bankruptcy_eligibility(claims)
    assert result["simple_proof"]["status"] is False
    assert result["eligible"] is False
    assert any("tanpa bukti dokumen pendukung" in r for r in result["reasons"])

def test_mixed_matured_status_eligibility():
    """Verify that only matured claims require proof for eligibility."""
    claims = [
        {"creditor_name": "Bank BCA", "metadata": {"is_matured": True, "document_type": "Invoice #123"}},
        {"creditor_name": "Bank Mandiri", "metadata": {"is_matured": False}} # Not matured, doesn't need proof yet
    ]
    result = check_bankruptcy_eligibility(claims)
    assert result["eligible"] is True
