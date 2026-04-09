-- Migration: Append-Only Forensic Audit Log (T-18, T-19 Fix)
-- Created: 2026-04-09
-- This migration adds an immutable audit log table for tracking claim status transitions,
-- document soft-deletions, and human overrides.

CREATE TABLE IF NOT EXISTS public.forensic_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type TEXT NOT NULL,     -- 'claim', 'audit_flag', 'document', 'case'
    entity_id UUID NOT NULL,
    action TEXT NOT NULL,          -- 'created', 'status_changed', 'deleted'
    old_value JSONB,
    new_value JSONB,
    actor_type TEXT NOT NULL,      -- 'user', 'agent:claim_auditor', 'system'
    actor_id TEXT,
    evidence_hash TEXT,            -- SHA-256 of the document or claim state
    created_at TIMESTAMPTZ DEFAULT now()
);

-- CRITICAL: Note there are NO Update or Delete policies. This table is append-only.
ALTER TABLE public.forensic_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_log_insert ON public.forensic_audit_log 
    FOR INSERT TO authenticated 
    WITH CHECK (true);

CREATE POLICY audit_log_select ON public.forensic_audit_log 
    FOR SELECT TO authenticated 
    USING (true);

-- Adding soft-delete support to documents
ALTER TABLE public.case_documents 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Adding soft-delete support to claims
ALTER TABLE public.claims 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Adding soft-delete support to audit_flags
ALTER TABLE public.audit_flags 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
