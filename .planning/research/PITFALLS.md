# Domain Pitfalls: Forensic Testing

**Domain:** Forensic AI & Legal Tech (Bankruptcy/PKPU)
**Researched:** 2026-04-05

## Critical Pitfalls

Mistakes that cause system failure or legal non-compliance.

### Pitfall 1: OCR "Hallucination" of Legal Numbers
**What goes wrong:** OCR engine misreads a "7" as a "1" in a creditor amount (e.g., Rp 70M becomes Rp 10M).
**Why it happens:** Poor scan quality, noise from stamps, or low-res legal documents.
**Consequences:** Major financial audit errors; incorrect voting thresholds for compositions.
**Prevention:** Use **CER (Character Error Rate)** thresholds and mandatory **Human-in-the-Loop (HITL)** flags for low-confidence numbers.

### Pitfall 2: Legal Standing (Petitioner Authority) Ambiguity
**What goes wrong:** System allows a standard creditor to initiate a "Bankruptcy Workflow" against a Bank or Insurance company.
**Why it happens:** Failing to automate Article 2 (3-5) of UU 37/2004, which limits who can file petitions against specific industries.
**Consequences:** Petitions are rejected by the court (waste of time and legal fees).
**Prevention:** Implement a deterministicindustry-check in the compliance engine.

## Moderate Pitfalls

### Pitfall 1: Non-Deterministic Reasoning Drift
**What goes wrong:** A model update (e.g., switching to a newer GPT version) changes how "Claim Audit" reasoning is generated.
**Prevention:** Run **Regression Tests with semantic distance assertions** using vector embeddings.

### Pitfall 2: Cross-Case Entity "Merge Hell"
**What goes wrong:** System incorrectly merges two different creditors who happen to have similar names (e.g., "PT ABC" and "PT ABC Sejahtera").
**Prevention:** Use **Probabilistic Record Linkage (Splink)** with multiple features (Tax ID, Address, Email) instead of just name-matching.

## Minor Pitfalls

### Pitfall 1: SSE Timeout During Reasoning
**What goes wrong:** Orchestrator takes too long to reason, causing the client-side SSE connection to time out.
**Prevention:** Implement periodic "Heartbeat" messages in the SSE stream to keep the connection alive.

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| **PDF Ingestion** | OCR misreading stamps as text. | Denoising and binarization preprocessing before OCR. |
| **Audit Logic** | Duplicate transaction false-positives. | Multi-feature hashing (Date + Amount + Vendor) for deduplication. |
| **UU 37/2004** | Miscounting PKPU deadlines. | Hardcode 45-day (Temporary) and 270-day (Permanent) limits into tests. |

## Sources

- [UU 37/2004 Articles on Authority](https://peraturan.go.id/id/uu-no-37-tahun-2004)
- [Arize Phoenix Documentation on Evals](https://docs.arize.com/phoenix/)
