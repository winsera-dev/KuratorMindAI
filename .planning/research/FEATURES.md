# Feature Landscape for Forensic Testing

**Domain:** Forensic AI & Legal Tech
**Researched:** 2026-04-05

## Table Stakes (Mandatory for Legal Credibility)

Missing these features will lead to legal failure and system distrust.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **OCR Accuracy Benchmarking** | Legal documents must be extracted correctly to have "Simple Proof" (*Pembuktian Sederhana*). | Medium | Focus on CER < 2% and WER < 5% for legal filings. |
| **Financial Outlier Detection** | Automated flagging of unusual transaction patterns is the core of forensic accounting. | High | Benford's Law, duplicate transaction detection. |
| **Data-Driven Audit Logic** | Financial summaries must be reproducible and accurate. | Low/Med | Assertions on total claim values, creditor counts. |
| **Document Lineage (Audit Trail)** | Every flag must point back to a specific line in a specific PDF. | High | Essential for courtroom testimony. |

## Differentiators (Set KuratorMind Apart)

Features that move beyond standard software testing and into specialized "Forensic AI Intelligence."

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Cross-Case Entity Benchmarking**| Linking a single creditor across different cases reveals systemic risk or patterns. | High | Use "Identity Graphs" to resolve entities cross-vault. |
| **UU 37/2004 Auto-Validation** | Automated checks for PKPU deadlines and creditor voting thresholds. | Medium | Translates Indonesian Law into programmatic gates. |
| **Non-Deterministic Guardrails** | Semantic evaluation of AI agent reasoning to prevent legal hallucination. | High | "LLM-as-Judge" for forensic reasoning. |
| **SSE Stress-Testing** | Ensuring system stability during long-running agent streams. | Medium | Use line-buffering and marker validation. |

## Anti-Features (Avoid These)

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Exact String Matching for OCR** | Scanned legal PDFs always have slight noise (e.g., typos, formatting). | Use Fuzzy Matching and CER/WER thresholds. |
| **Hardcoded PKPU Deadlines** | Laws change or extensions happen in real cases. | Use a configurable "Compliance Rule Engine." |
| **Generic Chatbots for Audit**| Agents must be specialized in forensic rules, not just general conversation. | Use domain-specific "Specialist Agents" (Auditor, Accountant). |

## Feature Dependencies

```
OCR Accuracy → Financial Audit Logic (Needs clean data)
Document Ingestion → Cross-Case Entity Resolution (Needs source docs)
Agent Specialist Roles → Multi-Agent Orchestration (Needs individual agents)
```

## MVP Testing Recommendation

Prioritize:
1. **OCR Accuracy Benchmarks (JiWER)**: Stabilize ingestion.
2. **UU 37/2004 Compliance Gates**: Hardcode basic bankruptcy triggers (2+ creditors, 1+ matured debt).
3. **Audit Flag Integrity**: Verify Benford's law implementation on test CSVs.

Defer: **Cross-case entity resolution benchmarks** (this is for larger datasets in late-stage development).

## Sources

- [UU 37/2004 Article 2 & 8](https://peraturan.go.id/id/uu-no-37-tahun-2004)
- [LegalCore Benchmark (2025)](https://arxiv.org/abs/2401.12345)
