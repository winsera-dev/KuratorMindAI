# Research Summary: E2E Testing for KuratorMind-AI (Forensic & Legal Tech)

**Domain:** Forensic AI, Legal Tech, Bankruptcy/PKPU (Indonesia)
**Researched:** 2026-04-05
**Overall confidence:** HIGH

## Executive Summary

Testing KuratorMind-AI requires a transition from traditional software testing to a multi-layered "Forensic AI Testing" framework. Because the system handles high-stakes legal data (UU 37/2004) and complex financial audits, accuracy is not a preference but a legal requirement. 

The research identifies five critical domains for testing: 
1. **OCR Accuracy:** Moving beyond visual checks to metric-driven CER/WER benchmarks using a "Golden Dataset."
2. **Financial Logic:** Implementing data-driven audit tests using Benford’s Law and outlier detection.
3. **Entity Resolution:** Benchmarking deduplication across cases using probabilistic matching (Fellegi-Sunter) and graph-based resolution.
4. **Legal Compliance:** Programmatic validation of UU 37/2004 triggers (creditor count, debt maturity).
5. **Orchestration:** Testing non-deterministic multi-agent workflows using "LLM-as-Judge" and semantic similarity instead of exact matching.

## Key Findings

**Stack:** Python-centric (Pytest, JiWER, Langfuse, OpenTelemetry, Splink).
**Architecture:** Four-level Testing Pyramid (Deterministic -> Constrained -> LLM-Judge -> Human-in-the-Loop).
**Critical pitfall:** "Reality-Ideality Gap"—benchmarks often pass while noisy, real-world scanned PDFs fail due to stamps/signatures.

## Implications for Roadmap

Based on research, suggested phase structure:

1. **Phase 1: Foundation & Data Ingestion Testing** - Focus on OCR ground truth.
   - Addresses: Automated PDF ingestion testing (OCR accuracy).
   - Avoids: Data corruption at the source due to poor extraction.

2. **Phase 2: Audit Logic & Compliance Engine** - Implement the core financial/legal rules.
   - Addresses: UU 37/2004 automated validation, Data-driven financial audit logic.
   - Avoids: False audit flags and legal non-compliance.

3. **Phase 3: Cross-Case Intelligence & Orchestration** - Scale to multiple cases and complex agent workflows.
   - Addresses: Entity resolution benchmarks, SSE streaming, and multi-agent coordination.
   - Avoids: System instability and entity fragmentation across the "Cross-Vault."

**Phase ordering rationale:**
- **Data Integrity First:** Without high OCR accuracy, downstream audit and compliance logic will fail ("Garbage In, Garbage Out").
- **Rules Second:** Hardcoded legal and financial rules are more stable than non-deterministic AI agents and should be built first.
- **Orchestration Last:** Testing multi-agent systems is the most complex and depends on the stability of the specialist agents.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| OCR Testing | HIGH | Standard industry metrics (CER/WER) are well-defined. |
| Financial Audit | MEDIUM | Requires specific forensic accounting domain knowledge. |
| Entity Resolution| MEDIUM | Legal-specific benchmarks (LegalCore) are emerging but niche. |
| UU 37/2004 | HIGH | Legal logic is deterministic and well-documented in the law. |
| Orchestration | MEDIUM | Non-deterministic testing is still an evolving field. |

## Gaps to Address

- **Indonesian OCR Nuance:** Specific testing for Indonesian-language legal stamps and signatures.
- **Synthetic Data for UU 37/2004:** Generating a realistic variety of Indonesian corporate debt structures for stress-testing.
- **Latency in SSE:** Benchmarking performance of long-running multi-agent reasoning over SSE.
