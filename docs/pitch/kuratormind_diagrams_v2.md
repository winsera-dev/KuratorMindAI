# KuratorMind AI: Technical Diagrams V2

> **V2 Changelog:** All diagrams verified against actual implementation in `apps/agents/`, `supabase/migrations/`, and `tools/`. Corrected model names, added missing agents, expanded ER to cover all 12 tables, and added 3 new diagrams (Agent Coordination, User Journey, Security Architecture).

**Stack:** Google ADK (Python) · Gemini 2.0 Pro/Flash · gemini-embedding-001 · Supabase (PostgreSQL + pgvector) · Next.js 15

---

### **1. Process Flow: The Forensic Data Loop (Complete)**

This diagram shows the end-to-end transformation of raw documents into court-ready forensic reports, including PII encryption, financial analysis, entity resolution, and the human-in-the-loop validation.

```mermaid
graph TD
    %% --- Intake Layer ---
    subgraph "1. Document Ingestion"
        A["📄 Upload PDF / Excel / Scans"] --> B["Automated Parsing & Chunking"]
        B --> C["gemini-embedding-001<br/>(768-dim vectors)"]
        C --> D[("Supabase pgvector<br/>+ HNSW Index")]
        B --> B1["Page/Section Refs<br/>Preserved for Citation"]
    end

    %% --- Agentic Reasoning Layer ---
    subgraph "2. Agentic Brain (Google ADK)"
        D --> E["Lead Orchestrator<br/>(Gemini 2.0 Pro)"]
        E --> F{"Task Decomposition<br/>& Delegation"}
        F --> G["🔍 Forensic Ingestor<br/>(Flash)"]
        F --> H["⚖️ Claim Auditor<br/>(Pro)"]
        F --> I["📊 Forensic Accountant<br/>(Pro)"]
        F --> J["🏛️ Regulatory Scholar<br/>(Flash)"]
    end

    %% --- Grounding & Intelligence Layer ---
    subgraph "3. Forensic Intelligence & Grounding"
        G --> G1["check_ingestion_status()"]
        H --> H1["encrypt_pii() →<br/>Secure Claims DB"]
        H --> H2["upsert_claim_record()<br/>create_audit_flag()"]
        I --> I1["analyze_financial_data()<br/>Ratio Calculation"]
        I --> I2["log_accounting_red_flag()<br/>Anomaly Detection"]
        J --> J1["search_regulations()<br/>Global Legal KB"]
        J --> J2["sync_legal_knowledge()<br/>Weekly JDIH Sync"]
        
        E --> E1["resolve_global_entity()<br/>Cross-Case Intelligence"]
        
        H1 & H2 & I1 & I2 & J1 & E1 --> O[("Supabase:<br/>Forensic Truth")]
    end

    %% --- Output Layer ---
    subgraph "4. Decision Delivery"
        O --> P["📋 Output Architect<br/>(Flash)"]
        P --> P1["get_case_consolidated_findings()"]
        P1 --> P2["generate_forensic_pdf()"]
        P2 --> R{"Kurator Validation"}
        R -->|"✅ Approve"| S["Court-Ready<br/>PDF Report"]
        R -->|"🚩 Flag"| T["Agent Feedback Loop"]
        T --> E
        S --> U["Supabase Storage<br/>(case-files bucket)"]
    end

    %% --- Styles ---
    style E fill:#3B82F6,stroke:#1E40AF,stroke-width:2px,color:#fff
    style O fill:#0F172A,stroke:#3B82F6,stroke-width:2px,color:#fff
    style R fill:#F59E0B,stroke:#D97706,stroke-width:2px,color:#000
    style H1 fill:#10B981,stroke:#059669,stroke-width:2px,color:#fff
    style E1 fill:#8B5CF6,stroke:#7C3AED,stroke-width:2px,color:#fff
    style S fill:#22C55E,stroke:#16A34A,stroke-width:2px,color:#fff
```

---

### **2. System Architecture: Full-Stack Agentic Workspace**

A component-level view matching the actual directory structure and package dependencies.

```mermaid
graph LR
    subgraph "Client Tier (Next.js 15)"
        A["Forensic Dashboard"]
        A1["Document Vault"]
        A2["Agent Chat (SSE)"]
        A3["Creditor Matrix"]
        A4["Report Viewer"]
    end

    subgraph "API Tier (Python)"
        B["FastAPI Server"]
        B1["REST Endpoints<br/>(/api/chat, /api/upload)"]
        B2["SSE Streaming<br/>(Agent Status)"]
    end

    subgraph "Agent Tier (Google ADK)"
        C["lead_orchestrator<br/>(Gemini 2.0 Pro)"]
        C1["forensic_ingestor<br/>(Flash)"]
        C2["claim_auditor<br/>(Pro)"]
        C3["forensic_accountant<br/>(Pro)"]
        C4["regulatory_scholar<br/>(Flash)"]
        C5["output_architect<br/>(Flash)"]
    end

    subgraph "Tool Layer"
        T1["supabase_tools.py<br/>(14 functions)"]
        T2["financial_tools.py<br/>(3 functions)"]
        T3["services/security.py<br/>(PII Encryption)"]
        T4["services/ingestion.py<br/>(Chunk + Embed)"]
        T5["services/reporting.py<br/>(PDF Generation)"]
    end

    subgraph "Intelligence Tier (Google AI)"
        D["Gemini 2.0 Pro<br/>(Deep Reasoning)"]
        D1["Gemini 2.0 Flash<br/>(Fast Extraction)"]
        D2["gemini-embedding-001<br/>(768-dim Vectors)"]
        D3["Google Search<br/>(Legal Discovery)"]
    end

    subgraph "Data Tier (Supabase)"
        E[("PostgreSQL<br/>12 Tables + RLS")]
        E1["pgvector + HNSW<br/>(Semantic Search)"]
        E2["S3 Storage<br/>(case-files bucket)"]
        E3["GoTrue Auth<br/>(JWT + RLS)"]
    end

    %% Flows
    A & A1 & A2 & A3 & A4 <--> B
    B <--> C
    C --> C1 & C2 & C3 & C4 & C5
    C1 & C2 & C3 & C4 & C5 <--> T1
    C3 <--> T2
    C2 <--> T3
    C1 <--> T4
    C5 <--> T5
    C <--> D
    C1 & C4 <--> D1
    T4 <--> D2
    C4 <--> D3
    T1 <--> E
    E <--> E1
    T4 & T5 <--> E2
    A <--> E3
```

---

### **3. Agent Coordination: Multi-Agent Swarm Topology**

How the 5 agents communicate and validate each other's work.

```mermaid
graph TB
    subgraph "ADK Swarm"
        O["🧠 Lead Orchestrator<br/>lead_orchestrator"]
        
        O -->|"1. Decompose & Delegate"| I["🔍 Forensic Ingestor<br/>forensic_ingestor"]
        O -->|"2. Verify Claims"| CA["⚖️ Claim Auditor<br/>claim_auditor"]
        O -->|"3. Analyze Financials"| FA["📊 Forensic Accountant<br/>forensic_accountant"]
        O -->|"4. Legal Validation"| RS["🏛️ Regulatory Scholar<br/>regulatory_scholar"]
        O -->|"5. Generate Report"| OA["📋 Output Architect<br/>output_architect"]
    end

    subgraph "Inter-Agent Validation"
        CA -->|"Classification Check"| RS
        FA -->|"PSAK Compliance"| RS
        RS -->|"Flag if Non-Compliant"| CA
        CA & FA & RS -->|"Findings"| OA
    end

    subgraph "Shared Tools"
        ST["semantic_search()"]
        AF["create_audit_flag()"]
    end

    CA --> ST
    FA --> ST
    CA --> AF
    FA --> AF
    RS --> AF

    subgraph "Orchestrator-Only Tools"
        GS["global_semantic_search()"]
        ER["resolve_global_entity()"]
    end

    O --> GS
    O --> ER

    %% Styles
    style O fill:#3B82F6,stroke:#1E40AF,stroke-width:3px,color:#fff
    style I fill:#6366F1,stroke:#4F46E5,stroke-width:2px,color:#fff
    style CA fill:#EF4444,stroke:#DC2626,stroke-width:2px,color:#fff
    style FA fill:#F59E0B,stroke:#D97706,stroke-width:2px,color:#000
    style RS fill:#10B981,stroke:#059669,stroke-width:2px,color:#fff
    style OA fill:#8B5CF6,stroke:#7C3AED,stroke-width:2px,color:#fff
```

---

### **4. Sequence Diagram: Full Forensic Audit Cycle**

How a single document flows through all 5 agents in a complete audit cycle.

```mermaid
sequenceDiagram
    autonumber
    actor K as Kurator (User)
    participant API as FastAPI
    participant O as Lead Orchestrator
    participant IN as Forensic Ingestor
    participant CA as Claim Auditor
    participant FA as Forensic Accountant
    participant RS as Regulatory Scholar
    participant OA as Output Architect
    participant SB as Supabase (pgvector)
    participant G as Gemini 2.0

    %% Phase 1: Ingestion
    rect rgb(59, 130, 246, 0.1)
        Note over K,SB: Phase 1 — Document Ingestion
        K->>API: Upload Creditor Claim PDF
        API->>O: Trigger Agent Pipeline
        O->>IN: Delegate: Process Document
        IN->>G: Multi-modal Extraction
        G-->>IN: Structured JSON (entities, amounts, dates)
        IN->>SB: Chunk + Embed (gemini-embedding-001)
        IN->>SB: Update case_documents.status = 'ready'
        IN-->>O: ✅ 47 chunks indexed, 12 pages
    end

    %% Phase 2: Claim Audit
    rect rgb(239, 68, 68, 0.1)
        Note over O,SB: Phase 2 — Claim Verification
        O->>CA: Delegate: Verify Creditor PT Abadi Jaya
        CA->>SB: semantic_search(case_id, "PT Abadi Jaya invoice")
        SB-->>CA: Top-K vector matches (similarity: 0.87)
        CA->>G: Cross-reference claim vs ledger evidence
        G-->>CA: Discrepancy: Rp 2.3B claimed vs Rp 1.8B in records
        CA->>SB: encrypt_pii("PT Abadi Jaya") → upsert_claim(status='disputed')
        CA->>SB: create_audit_flag(severity='high', type='contradiction')
    end

    %% Phase 3: Financial Analysis
    rect rgb(245, 158, 11, 0.1)
        Note over O,SB: Phase 3 — Financial Forensics
        O->>FA: Delegate: Analyze FY2024 Statements
        FA->>SB: semantic_search("Neraca Laba Rugi Balance Sheet")
        SB-->>FA: Financial document chunks
        FA->>G: Extract line items from chunks
        G-->>FA: Assets: 45B, Liabilities: 62B, Equity: -17B
        FA->>SB: analyze_financial_data() → Solvency Ratio: 1.38 (INSOLVENT)
        FA->>SB: log_accounting_red_flag("Negative Equity Detected")
    end

    %% Phase 4: Legal Compliance
    rect rgb(16, 185, 129, 0.1)
        Note over O,SB: Phase 4 — Legal Validation
        O->>RS: Validate: Claim classification + financial findings
        RS->>SB: search_regulations("creditor hierarchy PKPU")
        SB-->>RS: UU 37/2004 Art 60, Art 138-139
        RS-->>CA: ✅ Classification correct (Concurrent, UU 37/2004 Art 1.2)
        RS->>SB: create_audit_flag("Actio Pauliana risk", legal_ref="Art 41-47")
    end

    %% Phase 5: Report Generation
    rect rgb(139, 92, 246, 0.1)
        Note over O,SB: Phase 5 — Report Synthesis
        O->>OA: Delegate: Generate Laporan Audit Forensik
        OA->>SB: get_case_consolidated_findings(case_id)
        SB-->>OA: 3 analyses, 5 audit flags, 12 claims, 2 entity conflicts
        OA->>G: Compose structured Markdown report
        G-->>OA: Full report with citations
        OA->>SB: generate_forensic_pdf() → Upload to Storage
        OA-->>O: ✅ Report saved: outputs/{case_id}/report.pdf
    end

    O-->>API: SSE: "Forensic audit complete. 5 critical flags detected."
    API-->>K: Dashboard Update + Report Download
```

---

### **5. Data Entity Model: Complete Schema (12 Tables)**

Based on actual `supabase/migrations/` — all tables with relationships and key attributes.

```mermaid
erDiagram
    CASES ||--o{ CASE_DOCUMENTS : contains
    CASES ||--o{ CLAIMS : audited_in
    CASES ||--o{ CHAT_SESSIONS : workspace_for
    CASES ||--o{ AUDIT_FLAGS : flagged_in
    CASES ||--o{ AGENT_TASKS : orchestrated_in
    CASES ||--o{ GENERATED_OUTPUTS : produces
    CASES ||--o{ FINANCIAL_ANALYSES : analyzed_in

    CASE_DOCUMENTS ||--o{ DOCUMENT_CHUNKS : vector_source

    CLAIMS ||--o{ AUDIT_FLAGS : has_issue

    CHAT_SESSIONS ||--o{ CHAT_MESSAGES : contains

    AGENT_TASKS ||--o{ AGENT_TASKS : parent_child

    GLOBAL_ENTITIES ||--o{ ENTITY_OCCURRENCES : appears_in
    CASES ||--o{ ENTITY_OCCURRENCES : linked_to

    CASES {
        uuid id PK
        uuid user_id FK "→ auth.users"
        text name
        text debtor_entity
        text case_number
        text stage "pkpu_temp|pkpu_permanent|bankrupt|liquidation|closed"
        text status "active|archived|closed"
        jsonb metadata "last_sync timestamp"
    }

    CASE_DOCUMENTS {
        uuid id PK
        uuid case_id FK
        text file_name
        text file_type
        text file_path "→ Supabase Storage"
        text status "pending|processing|ready|error"
        integer page_count
        text summary
    }

    DOCUMENT_CHUNKS {
        uuid id PK
        uuid document_id FK
        uuid case_id FK
        text content
        integer chunk_index
        integer page_number
        text section_title
        vector embedding "pgvector(768) + HNSW"
    }

    CLAIMS {
        uuid id PK
        uuid case_id FK
        text creditor_name "🔒 encrypt_pii()"
        text_array creditor_aliases "🔒 encrypted"
        numeric claim_amount
        text claim_type "preferential|secured|concurrent"
        text status "pending|verified|disputed|rejected"
        numeric confidence_score
        text legal_basis
    }

    AUDIT_FLAGS {
        uuid id PK
        uuid case_id FK
        uuid claim_id FK
        text severity "critical|high|medium|low"
        text flag_type "contradiction|actio_pauliana|entity_duplicate|non_compliance|anomaly|inflated_claim"
        text title
        text description
        jsonb evidence
        text legal_reference
        boolean resolved
    }

    CHAT_SESSIONS {
        uuid id PK
        uuid case_id FK
        uuid user_id FK
        text title
    }

    CHAT_MESSAGES {
        uuid id PK
        uuid session_id FK
        text role "user|assistant|system"
        text content
        jsonb citations
        text agent_name
    }

    AGENT_TASKS {
        uuid id PK
        uuid case_id FK
        uuid parent_task_id FK "self-referencing"
        text agent_name
        text task_type
        text status "submitted|working|input_required|completed|failed"
        jsonb input_data
        jsonb output_data
    }

    GENERATED_OUTPUTS {
        uuid id PK
        uuid case_id FK
        text output_type "presentation|spreadsheet|legal_summary"
        text title
        text file_path "→ Storage"
        jsonb content
        jsonb citations
    }

    FINANCIAL_ANALYSES {
        uuid id PK
        uuid case_id FK
        uuid document_id FK
        text report_type "balance_sheet|income_statement|cash_flow"
        text period
        jsonb ratios "current_ratio, solvency, etc"
        jsonb psak_compliance
        jsonb anomalies
    }

    GLOBAL_ENTITIES {
        uuid id PK
        text name
        text entity_type "creditor|debtor|director|counsel"
        numeric risk_score
    }

    ENTITY_OCCURRENCES {
        uuid id PK
        uuid entity_id FK
        uuid case_id FK
        text source_type "claim|chunk"
        uuid source_id
    }
```

---

### **6. User Journey: Kurator's Forensic Workflow**

How a Kurator interacts with the system from case creation to court submission.

```mermaid
journey
    title Kurator's Forensic Audit Journey
    section Case Setup
        Create new case workspace: 5: Kurator
        Upload bankruptcy filing documents: 4: Kurator
        Documents auto-indexed by Ingestor: 5: System
    section Claim Verification
        Upload creditor claim letters: 4: Kurator
        Claim Auditor cross-references claims: 5: System
        Review disputed claims dashboard: 4: Kurator
        Approve or flag audit findings: 5: Kurator
    section Financial Forensics
        Forensic Accountant analyzes statements: 5: System
        Review ratio analysis and anomalies: 4: Kurator
        Regulatory Scholar validates compliance: 5: System
    section Reporting
        Output Architect generates report: 5: System
        Download court-ready PDF: 5: Kurator
        Submit to Commercial Court: 3: Kurator
```

---

### **7. Security Architecture: Multi-Tenant Isolation**

How KuratorMind prevents cross-case data contamination.

```mermaid
graph TB
    subgraph "Authentication"
        U["Kurator Login"]
        U --> AUTH["Supabase GoTrue<br/>(JWT Token)"]
        AUTH --> JWT["JWT with user_id claim"]
    end

    subgraph "Row-Level Security (RLS)"
        JWT --> RLS["PostgreSQL RLS Policies<br/>auth.uid() = user_id"]
        RLS --> C1["Case A Data<br/>(Kurator 1 Only)"]
        RLS --> C2["Case B Data<br/>(Kurator 2 Only)"]
        RLS -.->|"BLOCKED"| C3["Case C Data<br/>(Another Kurator)"]
    end

    subgraph "Agent-Level Isolation"
        DG["Discovery Guard Protocol<br/>(Orchestrator System Prompt)"]
        DG -->|"Mandatory"| CID["case_id filter on<br/>every tool call"]
        DG -->|"Exception Only"| GS["global_semantic_search()<br/>(legal precedents only)"]
    end

    subgraph "Data Protection"
        PII["PII Encryption Layer"]
        PII --> ENC["encrypt_pii()<br/>creditor_name → encrypted"]
        PII --> DEC["decrypt_pii()<br/>encrypted → creditor_name"]
        ENC --> DB[("Claims Table<br/>🔒 Encrypted at Rest")]
    end

    %% Styles
    style RLS fill:#EF4444,stroke:#DC2626,stroke-width:2px,color:#fff
    style DG fill:#F59E0B,stroke:#D97706,stroke-width:2px,color:#000
    style PII fill:#10B981,stroke:#059669,stroke-width:2px,color:#fff
    style C3 fill:#6B7280,stroke:#4B5563,stroke-width:1px,color:#fff,stroke-dasharray:5
```

---

### **Technical Rationale (for Hackathon Judges)**

| Dimension | Implementation Detail | Why It Matters |
|---|---|---|
| **Vector Performance** | pgvector with **HNSW indexing** (`vector_cosine_ops`), `match_document_chunks` RPC with threshold filtering | Sub-second retrieval even at 100K+ chunks. HNSW chosen for recall vs. IVFFlat for this scale |
| **Orchestration Pattern** | ADK `Agent` class with `sub_agents` list, each with dedicated `tools` and `model` assignment | Non-deterministic "Plan-Act-Observe" loop allows the Auditor to self-correct before flagging humans |
| **Model Strategy** | Pro (2.0) for deep reasoning (Orchestrator, Auditor, Accountant); Flash (2.0) for throughput (Ingestor, Scholar, Architect) | Cost-optimized: Pro only where legal/financial accuracy demands it, Flash for volume tasks |
| **Data Integrity** | Full RLS on all 10+ tables. PII encryption on creditor names. `case_id` boundary enforcement in agent instructions | Zero cross-tenant data leakage possible at both DB and agent prompt layers |
| **Entity Resolution** | `resolve_global_entity()` with ilike fuzzy matching + exact match fallback. Returns `has_conflict` boolean | Detects serial bankruptors and conflicts of interest — a forensic capability unique to KuratorMind |
| **Legal Currency** | `sync_legal_knowledge()` scrapes OJK/Kemenkeu/BPHN weekly using Gemini + Google Search grounding | Regulations are always current, not stale training data. Embeds discoveries into global case |
| **Report Safety** | `generate_and_save_report()` truncates content >500K chars before PDF generation | Prevents OOM crashes on extremely large forensic audits |

---

### **V1 vs V2 Diagram Comparison**

| Diagram | V1 | V2 |
|---|---|---|
| **Process Flow** | 3 agents, no PII or entity resolution | 5 agents, PII encryption, entity resolution, financial analysis pipeline |
| **Architecture** | Missing FastAPI, PII layer, 3 components | Full 6-layer architecture with tool layer and intelligence tier |
| **Sequence** | 1 audit path (claim only) | Complete 5-phase audit cycle covering all agents |
| **ER Diagram** | 4 tables | 12 tables matching real `supabase/migrations/` |
| **Agent Coordination** | ❌ Not present | ✅ New: Shows inter-agent validation and tool sharing |
| **User Journey** | ❌ Not present | ✅ New: Kurator workflow from case creation to court submission |
| **Security Architecture** | ❌ Not present | ✅ New: RLS, Discovery Guard, PII encryption layers |
