# Testing Scenario: Real-World PDF Ingestion (Mitralanggeng Jaya Konstruksi)
## High-Stakes Construction PKPU Simulation

**Objective:** Validate KuratorMind AI's ability to extract data from a **real-world, scanned legal PDF** from the Surabaya Commercial Court (PN Niaga Surabaya). This document is a non-text-searchable scan, making it a critical test for the AI's OCR and semantic parsing capabilities.

---

### 1. Case Metadata (The "Truth" Source)
*   **Company Name:** PT Mitralanggeng Jaya Konstruksi (Dalam PKPU Sementara)
*   **Case Number:** 25/Pdt.Sus-PKPU/2024/PN NIAGA SBY
*   **Source File:** `tests/data/DPT_PT_Mitralanggeng_Jaya_Konstruksi_2024.pdf`
*   **Document Type:** Daftar Piutang Tetap (DPT)

---

### 2. Ground Truth Data (For Verification)

Use these values to verify if the AI extraction is accurate after upload:

#### **A. Kreditur Preferen (Priority Claims)**
| Creditor Name | Claim Amount (IDR) | Legal Basis |
| :--- | :--- | :--- |
| **Himawan Pranoto** | Rp 89,570,260 | Gaji Bulan Desember 2023 |

#### **B. Kreditur Separatis (Secured Claims)**
| Creditor Name | Claim Amount (IDR) | Status |
| :--- | :--- | :--- |
| **Bank Panin Dubai Syariah, Tbk** | Rp 12,505,549,962 | Diakui dengan jaminan |
| **PT Wahana Ottomitra Multiartha** | Rp 76,469,250 | Perjanjian No. 1622120230401987 |

#### **C. Kreditur Konkuren (Concurrent Claims)**
| Creditor Name | Claim Amount (IDR) | Notes |
| :--- | :--- | :--- |
| **PT Beton Perkasa Wijaksana** | Rp 6,149,444,092 | Numerous Invoices (BFR21, BFR22, etc.) |
| **PT Hanil Jaya Steel** | Rp 997,794,724 | Surat Perjanjian Jual Beli No. 013 |
| **PT Pola Gondola Adiperkasa** | Rp 252,414,000 | Vendor Claim |

---

### 3. Testing Steps

1.  **Ingestion:**
    *   Navigate to **Sources** tab.
    *   Upload `tests/data/DPT_PT_Mitralanggeng_Jaya_Konstruksi_2024.pdf`.
    *   Observe the **"AI Forensic Auditor Active"** banner.

2.  **Accuracy Check (Claims Tab):**
    *   Verify if **Himawan Pranoto** is correctly classified as **Preferential**.
    *   Check if **Bank Panin Dubai Syariah** has the exact amount: `12,505,549,962`.
    *   Check if the system correctly identifies **6+ concurrent creditors** from the first page.

3.  **Discovery Check (Search Tab):**
    *   Search for: *"Berapa total tagihan PT Beton Perkasa?"*
    *   AI should provide the citation linking to the specific page in the PDF.

4.  **Wipe Check:**
    *   Delete the PDF.
    *   Confirm the Claims tab is empty.
