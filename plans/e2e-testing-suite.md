# Implementation Plan: End-to-End Testing Suite (KuratorMind AI)

This plan implements a robust E2E testing framework for KuratorMind AI, focusing on forensic accuracy, legal compliance (UU 37/2004), and seamless multi-agent orchestration.

## Goals
- **OCR Ground Truth**: Baseline Character Error Rate (CER) and Word Error Rate (WER).
- **Legal Accuracy**: Deterministic validation of bankruptcy triggers.
- **Forensic Integrity**: Automated verification of agent-led audit flags.
- **UX Stability**: E2E verification of SSE and Chat streaming.

## Workstreams

### Workstream 1: Backend Integration & AI Logic
- **Framework**: Pytest + Supabase + Agents.
- **Key Tests**: Legal compliance gates (UU 37/2004), Forensic discrepancy detection, and Cross-case entity resolution (Splink).
- **Status**: Detailed in [04-02-PLAN.md](../.planning/phases/04-e2e-testing-suite/04-02-PLAN.md).

### Workstream 2: Frontend E2E & Detailed Experience
- **Framework**: Playwright + Next.js.
- **Key Tests**: SSE streaming, Chat streaming, Forensic banners, and RLS multi-tenant boundaries.
- **Status**: Detailed in [04-03-PLAN.md](../.planning/phases/04-e2e-testing-suite/04-03-PLAN.md).

### Workstream 3: Data Quality & Domain Benchmarking
- **Framework**: JiWER + Golden Dataset.
- **Key Metrics**: CER < 2%, WER < 5% for legal filings.
- **Status**: Detailed in [04-01-PLAN.md](../.planning/phases/04-e2e-testing-suite/04-01-PLAN.md).

## Implementation Timeline (Wave Structure)

| Wave | Plan | Objective | Dependency |
|------|------|-----------|------------|
| 1 | [04-01](../.planning/phases/04-e2e-testing-suite/04-01-PLAN.md) | Env Setup, Seeding Engine, OCR Benchmarking | None |
| 2 | [04-02](../.planning/phases/04-e2e-testing-suite/04-02-PLAN.md) | Legal & Audit Logic Backend Tests | 04-01 |
| 3 | [04-03](../.planning/phases/04-e2e-testing-suite/04-03-PLAN.md) | UI/UX E2E Playwright Tests | 04-02 |

## Verification Step
The final phase verification will be a full run of the integrated pipeline:
1. `python tests/scripts/seed_test_data.py` (Reset state)
2. `python tests/scripts/ocr_benchmark.py` (Verify ingestion baseline)
3. `pytest apps/agents/tests` (Verify backend logic)
4. `npx playwright test` (Verify frontend E2E)

## Security & Ethics
- All tests use anonymized "Golden Datasets" to protect client confidentiality.
- RLS boundaries are explicitly tested to ensure data vault isolation.
- Secret scrubbing is enabled to prevent Supabase keys from appearing in test artifacts.
