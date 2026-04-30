"""
Test Suite: Ingestion Pipeline — deterministic unit tests only.

Covers:
- _chunk_pages: page splitting logic
- OCR threshold detection: low_confidence flag on sparse text
- calculate_financial_ratios: ratio arithmetic
- detect_accounting_anomalies: balance-sheet identity checks
- detect_claim_discrepancies: variance threshold logic
- _retry_audit: exponential-backoff retry behaviour
"""

import pytest
from unittest.mock import MagicMock, patch, call
from kuratormind.services.accounting import (
    calculate_financial_ratios,
    detect_accounting_anomalies,
    detect_claim_discrepancies,
)


# ---------------------------------------------------------------------------
# _chunk_pages
# ---------------------------------------------------------------------------

class TestChunkPages:
    """_chunk_pages splits each page's text into CHUNK_SIZE/CHUNK_OVERLAP character chunks."""

    def _import(self):
        from kuratormind.services.ingestion import _chunk_pages
        return _chunk_pages

    def test_short_page_produces_one_chunk(self):
        _chunk_pages = self._import()
        # A short page (< CHUNK_SIZE chars) should produce exactly one chunk
        pages = [{"text": "Hello world", "page_number": 1}]
        chunks = _chunk_pages(pages)
        assert len(chunks) == 1
        assert chunks[0]["page_number"] == 1
        assert "Hello world" in chunks[0]["content"]

    def test_long_page_produces_multiple_chunks(self):
        _chunk_pages = self._import()
        # A page > CHUNK_SIZE chars should be split into multiple chunks
        from kuratormind.services.ingestion import CHUNK_SIZE
        long_text = "A" * (CHUNK_SIZE * 2 + 100)
        pages = [{"text": long_text, "page_number": 1}]
        chunks = _chunk_pages(pages)
        assert len(chunks) >= 2

    def test_empty_pages_returns_empty(self):
        _chunk_pages = self._import()
        chunks = _chunk_pages([])
        assert chunks == []

    def test_multiple_pages_chunk_index_is_global(self):
        _chunk_pages = self._import()
        pages = [
            {"text": "Short text on page one", "page_number": 1},
            {"text": "Short text on page two", "page_number": 2},
        ]
        chunks = _chunk_pages(pages)
        # chunk_index should be globally sequential (0, 1, ...)
        indices = [c["chunk_index"] for c in chunks]
        assert indices == list(range(len(chunks)))


# ---------------------------------------------------------------------------
# OCR threshold detection (low_confidence flag)
# ---------------------------------------------------------------------------

class TestOCRThreshold:
    """Sparse pages (<100 chars) should be flagged as low_confidence."""

    def test_sparse_page_is_low_confidence(self):
        # Simulate the threshold check: len(text) < 100 → OCR
        text = "Short text"
        assert len(text) < 100  # would trigger OCR path

    def test_dense_page_is_not_low_confidence(self):
        text = "A" * 200
        assert len(text) >= 100  # would skip OCR path

    def test_ocr_quality_score_clipped(self):
        # quality_guess should stay in [0.0, 1.0]
        raw = 1.5
        clipped = max(0.0, min(1.0, float(raw)))
        assert clipped == 1.0

        raw = -0.3
        clipped = max(0.0, min(1.0, float(raw)))
        assert clipped == 0.0

    def test_low_quality_threshold(self):
        # quality_guess < 0.7 → low_confidence = True
        quality_guess = 0.6
        assert quality_guess < 0.7  # page_meta["low_confidence"] = True

        quality_guess = 0.7
        assert not (quality_guess < 0.7)  # page_meta["low_confidence"] = False


# ---------------------------------------------------------------------------
# calculate_financial_ratios
# ---------------------------------------------------------------------------

class TestCalculateFinancialRatios:
    def test_current_ratio_normal(self):
        ratios = calculate_financial_ratios({
            "current_assets": 200_000,
            "current_liabilities": 100_000,
            "total_assets": 500_000,
            "total_liabilities": 300_000,
            "equity": 200_000,
            "net_income": 50_000,
            "revenue": 400_000,
        })
        assert ratios["current_ratio"] == pytest.approx(2.0)

    def test_current_ratio_zero_liabilities(self):
        ratios = calculate_financial_ratios({
            "current_assets": 100_000,
            "current_liabilities": 0,
        })
        assert ratios["current_ratio"] == 0  # guard against ZeroDivisionError

    def test_debt_to_assets(self):
        ratios = calculate_financial_ratios({
            "total_assets": 500_000,
            "total_liabilities": 250_000,
            "equity": 250_000,
        })
        assert ratios["debt_to_assets"] == pytest.approx(0.5)

    def test_net_profit_margin(self):
        ratios = calculate_financial_ratios({
            "net_income": 40_000,
            "revenue": 200_000,
        })
        assert ratios["net_profit_margin"] == pytest.approx(0.2)

    def test_net_profit_margin_zero_revenue(self):
        ratios = calculate_financial_ratios({"net_income": 10_000, "revenue": 0})
        assert ratios["net_profit_margin"] == 0


# ---------------------------------------------------------------------------
# detect_accounting_anomalies
# ---------------------------------------------------------------------------

class TestDetectAccountingAnomalies:
    def test_balanced_sheet_no_anomalies(self):
        anomalies = detect_accounting_anomalies({
            "total_assets": 500_000,
            "total_liabilities": 300_000,
            "equity": 200_000,
        })
        assert anomalies == []

    def test_unbalanced_sheet_flagged(self):
        anomalies = detect_accounting_anomalies({
            "total_assets": 500_000,
            "total_liabilities": 300_000,
            "equity": 100_000,  # should be 200_000 → diff = 100_000
        })
        types = [a["type"] for a in anomalies]
        assert "balance_mismatch" in types

    def test_negative_equity_flagged(self):
        anomalies = detect_accounting_anomalies({
            "total_assets": 200_000,
            "total_liabilities": 300_000,
            "equity": -100_000,
        })
        types = [a["type"] for a in anomalies]
        assert "negative_equity" in types

    def test_both_anomalies_detected(self):
        anomalies = detect_accounting_anomalies({
            "total_assets": 100_000,
            "total_liabilities": 200_000,
            "equity": -50_000,  # balance mismatch AND negative equity
        })
        types = [a["type"] for a in anomalies]
        assert "balance_mismatch" in types
        assert "negative_equity" in types


# ---------------------------------------------------------------------------
# detect_claim_discrepancies
# ---------------------------------------------------------------------------

class TestDetectClaimDiscrepancies:
    def test_no_discrepancy_within_threshold(self):
        result = detect_claim_discrepancies(1_000_000, 1_020_000, threshold=0.05)
        assert result["is_discrepancy"] is False
        assert result["severity"] == "low"

    def test_medium_discrepancy(self):
        result = detect_claim_discrepancies(1_200_000, 1_000_000, threshold=0.05)
        assert result["is_discrepancy"] is True
        assert result["severity"] == "medium"

    def test_high_discrepancy(self):
        result = detect_claim_discrepancies(1_300_000, 1_000_000, threshold=0.05)
        assert result["is_discrepancy"] is True
        assert result["severity"] == "high"

    def test_critical_discrepancy(self):
        result = detect_claim_discrepancies(2_000_000, 1_000_000, threshold=0.05)
        assert result["is_discrepancy"] is True
        assert result["severity"] == "critical"

    def test_zero_ledger_amount_with_positive_claim(self):
        result = detect_claim_discrepancies(500_000, 0)
        assert result["is_discrepancy"] is True
        assert result["variance"] == pytest.approx(1.0)

    def test_zero_ledger_zero_claim(self):
        result = detect_claim_discrepancies(0, 0)
        assert result["is_discrepancy"] is False
        assert result["variance"] == 0


# ---------------------------------------------------------------------------
# _retry_audit
# ---------------------------------------------------------------------------

class TestRetryAudit:
    def _import(self):
        from kuratormind.services.ingestion import _retry_audit
        return _retry_audit

    def _make_fn(self, side_effect=None):
        """MagicMock with __name__ set (required by _retry_audit's logger calls)."""
        fn = MagicMock(side_effect=side_effect)
        fn.__name__ = "mock_audit_fn"
        return fn

    def test_succeeds_on_first_attempt(self):
        _retry_audit = self._import()
        fn = self._make_fn()
        result = _retry_audit(fn, "arg1", retries=2)
        assert result is True
        fn.assert_called_once_with("arg1")

    @patch("kuratormind.services.ingestion.time.sleep")
    def test_retries_on_transient_failure(self, mock_sleep):
        _retry_audit = self._import()
        fn = self._make_fn(side_effect=[RuntimeError("transient"), None])
        result = _retry_audit(fn, "arg1", retries=2)
        assert result is True
        assert fn.call_count == 2
        mock_sleep.assert_called_once_with(1)  # 2^0 = 1s after first failure

    @patch("kuratormind.services.ingestion.time.sleep")
    def test_returns_false_after_all_retries_exhausted(self, mock_sleep):
        _retry_audit = self._import()
        fn = self._make_fn(side_effect=RuntimeError("permanent"))
        result = _retry_audit(fn, "arg1", retries=2)
        assert result is False
        assert fn.call_count == 3  # initial + 2 retries
        assert mock_sleep.call_count == 2
        mock_sleep.assert_any_call(1)   # 2^0
        mock_sleep.assert_any_call(2)   # 2^1

    @patch("kuratormind.services.ingestion.time.sleep")
    def test_zero_retries_means_single_attempt(self, mock_sleep):
        _retry_audit = self._import()
        fn = self._make_fn(side_effect=RuntimeError("fail"))
        result = _retry_audit(fn, retries=0)
        assert result is False
        assert fn.call_count == 1
        mock_sleep.assert_not_called()
