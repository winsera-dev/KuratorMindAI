-- Migration: Add Entity Resolution Tables
-- Created: 2026-04-05
-- This migration adds the global_entities and entity_occurrences tables 
-- required for cross-case forensic audits (Phase 1D).

-- 0. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 1. TABLES

-- Global Entities: Unified identities across all cases
CREATE TABLE IF NOT EXISTS public.global_entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    entity_type TEXT NOT NULL, -- Simplified: no check constraint for flexibility
    risk_score NUMERIC DEFAULT 0.0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Entity Occurrences: Links global entities to specific cases and sources
CREATE TABLE IF NOT EXISTS public.entity_occurrences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL REFERENCES public.global_entities(id) ON DELETE CASCADE,
    case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
    source_type TEXT NOT NULL,
    source_id UUID, -- source_id can be claim_id, document_chunk_id, etc.
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. RLS POLICIES

ALTER TABLE public.global_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entity_occurrences ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can read global entities
CREATE POLICY global_entities_read ON public.global_entities
    FOR SELECT USING (auth.role() = 'authenticated');

-- Policy: Users can only see occurrences in cases they own
CREATE POLICY entity_occurrences_access ON public.entity_occurrences
    FOR ALL USING (
        case_id IN (SELECT id FROM public.cases WHERE user_id = auth.uid())
    );

-- 3. INDEXES

-- Trigram index for fuzzy matching performance on names
CREATE INDEX IF NOT EXISTS global_entities_name_trgm_idx ON public.global_entities 
USING gin (name gin_trgm_ops);

-- Performance indexes for foreign keys
CREATE INDEX IF NOT EXISTS entity_occurrences_entity_id_idx ON public.entity_occurrences (entity_id);
CREATE INDEX IF NOT EXISTS entity_occurrences_case_id_idx ON public.entity_occurrences (case_id);
