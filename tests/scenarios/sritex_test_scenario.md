# Testing Scenario: Sritex (PT Sri Rejeki Isman Tbk)
## High-Complexity Bankruptcy & PKPU Simulation

**Objective:** Validate KuratorMind AI's ability to handle high-volume data ingestion, complex creditor classification, and financial audit flags using real-world data from the Sritex 2024/2025 case.

---

### 1. Case Metadata (The "Truth" Source)
*   **Company Name:** PT Sri Rejeki Isman Tbk (SRIL)
*   **Case Type:** Pailit (Bankrupt) - Post-Homologasi Cancellation
*   **Total Debt (Est):** Rp 29.88 Trillion (US$ 1.83 Billion)
*   **Total Creditors:** 1,654
*   **Key Challenge:** Discrepancy between Debtor's Financial Statement (June 2024) and Creditor Claims (Jan 2025).

---

### 2. Testing Scenarios

#### Scenario A: Automated Ingestion & Extraction
*   **Target Agent:** `ingestor`
*   **Input Data:** Sritex Financial Statement Q3 2024 (PDF).
*   **Goal:** Successfully extract "Note 20: Pinjaman Bank" into the `claims` table.
*   **Success Metric:** AI identifies at least 20 different banks (BCA, BNI, QNB, etc.) with correct USD and IDR values.

#### Scenario B: Conflict Detection (Audit Flags)
*   **Target Agent:** `claim_auditor`
*   **Logic:**
    1.  **System Entry (Debtor):** Bank BCA debt is recorded as **Rp 1.12 Trillion**.
    2.  **User Entry (Claimant):** Bank BCA submits a claim for **Rp 2.0 Trillion**.
*   **Action:** Run Audit on Vault ID `sritex-001`.
*   **Expected Result:** Agent flags the claim with status `CONFLICT` and adds a comment: *"Claimed amount (2.0T) exceeds recorded ledger amount (1.12T) by 78%."*

#### Scenario C: Legal Classification (PKPU/Pailit Priority)
*   **Target Agent:** `regulatory_scholar` & `output_architect`
*   **Data Points:**
    *   **Labor Claims:** Rp 619 Billion (Preferen)
    *   **Bank Loans (Collateralized):** Rp 919 Billion (Separatis)
    *   **Unsecured Vendors:** Rp 28.3 Trillion (Konkuren)
*   **Expected Result:** The generated **Daftar Piutang Tetap (DPT)** correctly partitions these into the three standard Indonesian legal buckets.

---

### 3. Mock Data for Immediate Import
Save this content to `apps/agents/test_sritex_claims.csv` to simulate the case:

```csv
creditor_name,claimed_amount,classification,currency,notes
Bank Central Asia (BCA),2000000000000,Separatis,IDR,Inflated claim for testing
State Bank of India (SG),43880000,Separatis,USD,Secured by machinery
Ex-Employees Group A,619000000000,Preferen,IDR,Priority labor claims
PT Lintas Mineral,500000000,Konkuren,IDR,Unsecured vendor
Citicorp Trustee,6180000000000,Konkuren,IDR,Bondholders representation
```

---

### 4. Technical Validation Steps
1.  **Database Sync:** Verify `supabase_tools.py` successfully maps the `currency` and `classification` to the Supabase schema.
2.  **Orchestration:** Ensure `orchestrator/agent.py` can trigger all three agents (Ingestor -> Auditor -> Architect) in a single workflow.
3.  **UI Feedback:** Ensure `AuditFlagCard.tsx` correctly displays the "Red Flag" for the BCA claim discrepancy.
