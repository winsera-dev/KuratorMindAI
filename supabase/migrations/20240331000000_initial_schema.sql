-- Supabase Initial Schema for KuratorMind AI
-- Created: 2024-03-31
-- This migration establishes the core tables, extensions, and RLS policies.

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "vector";

-- 2. TABLES

-- Cases: Core workspace container for a bankruptcy case
CREATE TABLE IF NOT EXISTS public.cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    debtor_entity TEXT,
    case_number TEXT,
    court_name TEXT,
    bankruptcy_date DATE,
    stage TEXT DEFAULT 'pkpu_temp' CHECK (stage IN ('pkpu_temp', 'pkpu_permanent', 'bankrupt', 'liquidation', 'closed')),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'closed')),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Case Documents: Metadata for uploaded forensic files
CREATE TABLE IF NOT EXISTS public.case_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'ready', 'error')),
    page_count INTEGER,
    summary TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Document Chunks: Granular segments for semantic search (RAG)
CREATE TABLE IF NOT EXISTS public.document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.case_documents(id) ON DELETE CASCADE,
    case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    page_number INTEGER,
    section_title TEXT,
    embedding vector(768), -- Optimized for Gemini text-embedding-004
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Create HNSW index for vector search performance
CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx ON public.document_chunks 
USING hnsw (embedding vector_cosine_ops);

-- Chat Sessions: Workspace-specific conversation history
CREATE TABLE IF NOT EXISTS public.chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    title TEXT DEFAULT 'New Chat',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Chat Messages: Individual turns in the conversation
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    citations JSONB DEFAULT '[]'::jsonb,
    agent_name TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Claims: Extracted creditor claims for forensic audit
CREATE TABLE IF NOT EXISTS public.claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
    creditor_name TEXT NOT NULL,
    creditor_aliases TEXT[],
    claim_amount NUMERIC,
    adjusted_amount NUMERIC,
    currency TEXT DEFAULT 'IDR',
    claim_type TEXT CHECK (claim_type IN ('preferential', 'secured', 'concurrent')),
    collateral_description TEXT,
    priority_rank INTEGER,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'disputed', 'rejected')),
    confidence_score NUMERIC,
    supporting_documents UUID[],
    contradicting_evidence JSONB DEFAULT '[]'::jsonb,
    legal_basis TEXT,
    rejection_reason TEXT,
    flags TEXT[],
    notes TEXT,
    verified_by TEXT,
    verified_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Audit Flags: Forensic red flags and logical contradictions
CREATE TABLE IF NOT EXISTS public.audit_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
    claim_id UUID REFERENCES public.claims(id) ON DELETE CASCADE,
    severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
    flag_type TEXT NOT NULL CHECK (flag_type IN ('contradiction', 'actio_pauliana', 'entity_duplicate', 'non_compliance', 'anomaly', 'inflated_claim')),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    evidence JSONB DEFAULT '[]'::jsonb,
    legal_reference TEXT,
    resolution TEXT,
    resolved BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Agent Tasks: Orchestration tracking for ADK background tasks
CREATE TABLE IF NOT EXISTS public.agent_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
    parent_task_id UUID REFERENCES public.agent_tasks(id) ON DELETE CASCADE,
    agent_name TEXT NOT NULL,
    task_type TEXT NOT NULL,
    status TEXT DEFAULT 'submitted' CHECK (status IN ('submitted', 'working', 'input_required', 'completed', 'failed')),
    input_data JSONB DEFAULT '{}'::jsonb,
    output_data JSONB DEFAULT '{}'::jsonb,
    a2m_messages JSONB DEFAULT '[]'::jsonb,
    error TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Generated Outputs: Produced reports, summaries, or spreadsheets
CREATE TABLE IF NOT EXISTS public.generated_outputs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
    output_type TEXT NOT NULL CHECK (output_type IN ('presentation', 'spreadsheet', 'legal_summary')),
    title TEXT NOT NULL,
    file_path TEXT,
    content JSONB,
    citations JSONB DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Financial Analyses: Balance sheet and P&L deep dives
CREATE TABLE IF NOT EXISTS public.financial_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
    document_id UUID REFERENCES public.case_documents(id) ON DELETE SET NULL,
    report_type TEXT NOT NULL CHECK (report_type IN ('balance_sheet', 'income_statement', 'cash_flow')),
    period TEXT,
    ratios JSONB DEFAULT '{}'::jsonb,
    psak_compliance JSONB DEFAULT '[]'::jsonb,
    anomalies JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. FUNCTIONS

-- Semantic search function for RAG
CREATE OR REPLACE FUNCTION public.match_document_chunks(
    query_embedding vector(768),
    match_case_id UUID,
    match_count INTEGER DEFAULT 10,
    match_threshold FLOAT DEFAULT 0.0
)
RETURNS TABLE (
    id UUID,
    document_id UUID,
    case_id UUID,
    content TEXT,
    chunk_index INTEGER,
    page_number INTEGER,
    section_title TEXT,
    metadata JSONB,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        dc.id,
        dc.document_id,
        dc.case_id,
        dc.content,
        dc.chunk_index,
        dc.page_number,
        dc.section_title,
        dc.metadata,
        1 - (dc.embedding <=> query_embedding) AS similarity
    FROM public.document_chunks dc
    WHERE dc.case_id = match_case_id
      AND 1 - (dc.embedding <=> query_embedding) >= match_threshold
    ORDER BY dc.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- 4. RLS POLICIES (Row-Level Security)

ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_outputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_analyses ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own cases
CREATE POLICY vault_owner ON public.cases
    FOR ALL USING (auth.uid() = user_id);

-- Policy: Users can see documents in cases they own
CREATE POLICY vault_docs_access ON public.case_documents
    FOR ALL USING (
        case_id IN (SELECT id FROM public.cases WHERE user_id = auth.uid())
    );

-- Policy: Users can see document chunks in cases they own
CREATE POLICY vault_chunks_access ON public.document_chunks
    FOR ALL USING (
        case_id IN (SELECT id FROM public.cases WHERE user_id = auth.uid())
    );

-- Policy: Users can see sessions in cases they own
CREATE POLICY vault_sessions_access ON public.chat_sessions
    FOR ALL USING (
        case_id IN (SELECT id FROM public.cases WHERE user_id = auth.uid())
    );

-- Policy: Users can see messages in sessions belonging to cases they own
CREATE POLICY vault_messages_access ON public.chat_messages
    FOR ALL USING (
        session_id IN (
            SELECT cs.id FROM public.chat_sessions cs
            JOIN public.cases v ON cs.case_id = v.id
            WHERE v.user_id = auth.uid()
        )
    );

-- Policy: Users can see claims in cases they own
CREATE POLICY vault_claims_access ON public.claims
    FOR ALL USING (
        case_id IN (SELECT id FROM public.cases WHERE user_id = auth.uid())
    );

-- Policy: Users can see audit flags in cases they own
CREATE POLICY vault_flags_access ON public.audit_flags
    FOR ALL USING (
        case_id IN (SELECT id FROM public.cases WHERE user_id = auth.uid())
    );

-- Policy: Users can see tasks in cases they own
CREATE POLICY vault_tasks_access ON public.agent_tasks
    FOR ALL USING (
        case_id IN (SELECT id FROM public.cases WHERE user_id = auth.uid())
    );

-- Policy: Users can see outputs in cases they own
CREATE POLICY vault_outputs_access ON public.generated_outputs
    FOR ALL USING (
        case_id IN (SELECT id FROM public.cases WHERE user_id = auth.uid())
    );

-- Policy: Users can see financial analyses in cases they own
CREATE POLICY vault_financial_access ON public.financial_analyses
    FOR ALL USING (
        case_id IN (SELECT id FROM public.cases WHERE user_id = auth.uid())
    );
