-- Migration: Rename Vault to Case
-- Instructions: Run this in your Supabase SQL Editor to apply the schema changes.

-- 1. Rename Tables
ALTER TABLE IF EXISTS public.vaults RENAME TO cases;
ALTER TABLE IF EXISTS public.vault_documents RENAME TO case_documents;

-- 2. Rename Columns in related tables
ALTER TABLE public.case_documents RENAME COLUMN vault_id TO case_id;
ALTER TABLE public.document_chunks RENAME COLUMN vault_id TO case_id;
ALTER TABLE public.chat_sessions RENAME COLUMN vault_id TO case_id;
ALTER TABLE public.claims RENAME COLUMN vault_id TO case_id;
ALTER TABLE public.audit_flags RENAME COLUMN vault_id TO case_id;
ALTER TABLE public.agent_tasks RENAME COLUMN vault_id TO case_id;
ALTER TABLE public.generated_outputs RENAME COLUMN vault_id TO case_id;
ALTER TABLE public.financial_analyses RENAME COLUMN vault_id TO case_id;

-- 3. Rename RLS Policies
-- Cases
ALTER POLICY vault_owner ON public.cases RENAME TO case_owner;

-- Case Documents
ALTER POLICY vault_docs_access ON public.case_documents RENAME TO case_docs_access;
-- Note: Recreating policy to reference 'cases' instead of 'vaults'
DROP POLICY IF EXISTS case_docs_access ON public.case_documents;
CREATE POLICY case_docs_access ON public.case_documents FOR ALL USING (case_id IN (SELECT id FROM public.cases WHERE user_id = auth.uid()));

-- Document Chunks
ALTER POLICY vault_chunks_access ON public.document_chunks RENAME TO case_chunks_access;
DROP POLICY IF EXISTS case_chunks_access ON public.document_chunks;
CREATE POLICY case_chunks_access ON public.document_chunks FOR ALL USING (case_id IN (SELECT id FROM public.cases WHERE user_id = auth.uid()));

-- Chat Sessions
ALTER POLICY vault_sessions_access ON public.chat_sessions RENAME TO case_sessions_access;
DROP POLICY IF EXISTS case_sessions_access ON public.chat_sessions;
CREATE POLICY case_sessions_access ON public.chat_sessions FOR ALL USING (case_id IN (SELECT id FROM public.cases WHERE user_id = auth.uid()));

-- Chat Messages
ALTER POLICY vault_messages_access ON public.chat_messages RENAME TO case_messages_access;
DROP POLICY IF EXISTS case_messages_access ON public.chat_messages;
CREATE POLICY case_messages_access ON public.chat_messages FOR ALL USING (session_id IN (SELECT cs.id FROM public.chat_sessions cs JOIN public.cases c ON cs.case_id = c.id WHERE c.user_id = auth.uid()));

-- Claims
ALTER POLICY vault_claims_access ON public.claims RENAME TO case_claims_access;
DROP POLICY IF EXISTS case_claims_access ON public.claims;
CREATE POLICY case_claims_access ON public.claims FOR ALL USING (case_id IN (SELECT id FROM public.cases WHERE user_id = auth.uid()));

-- Audit Flags
ALTER POLICY vault_flags_access ON public.audit_flags RENAME TO case_flags_access;
DROP POLICY IF EXISTS case_flags_access ON public.audit_flags;
CREATE POLICY case_flags_access ON public.audit_flags FOR ALL USING (case_id IN (SELECT id FROM public.cases WHERE user_id = auth.uid()));

-- Agent Tasks
ALTER POLICY vault_tasks_access ON public.agent_tasks RENAME TO case_tasks_access;
DROP POLICY IF EXISTS case_tasks_access ON public.agent_tasks;
CREATE POLICY case_tasks_access ON public.agent_tasks FOR ALL USING (case_id IN (SELECT id FROM public.cases WHERE user_id = auth.uid()));

-- Generated Outputs
ALTER POLICY vault_outputs_access ON public.generated_outputs RENAME TO case_outputs_access;
DROP POLICY IF EXISTS case_outputs_access ON public.generated_outputs;
CREATE POLICY case_outputs_access ON public.generated_outputs FOR ALL USING (case_id IN (SELECT id FROM public.cases WHERE user_id = auth.uid()));

-- Financial Analyses
ALTER POLICY vault_financial_access ON public.financial_analyses RENAME TO case_financial_access;
DROP POLICY IF EXISTS case_financial_access ON public.financial_analyses;
CREATE POLICY case_financial_access ON public.financial_analyses FOR ALL USING (case_id IN (SELECT id FROM public.cases WHERE user_id = auth.uid()));

-- 4. Update match_document_chunks function
DROP FUNCTION IF EXISTS public.match_document_chunks;
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
