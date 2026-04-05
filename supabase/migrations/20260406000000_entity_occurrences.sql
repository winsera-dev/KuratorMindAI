-- Migration: Create Entity Occurrences Table
-- Created: 2026-04-06
-- This migration ensures the entity_occurrences table is correctly implemented.

CREATE TABLE IF NOT EXISTS public.entity_occurrences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL REFERENCES public.global_entities(id) ON DELETE CASCADE,
    case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
    source_type TEXT NOT NULL,
    source_id UUID, -- source_id can be claim_id, document_chunk_id, etc.
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS POLICY
ALTER TABLE public.entity_occurrences ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'entity_occurrences' AND policyname = 'entity_occurrences_access'
    ) THEN
        CREATE POLICY entity_occurrences_access ON public.entity_occurrences
            FOR ALL USING (
                case_id IN (SELECT id FROM public.cases WHERE user_id = auth.uid())
            );
    END IF;
END $$;

-- INDEXES
CREATE INDEX IF NOT EXISTS entity_occurrences_entity_id_idx ON public.entity_occurrences (entity_id);
CREATE INDEX IF NOT EXISTS entity_occurrences_case_id_idx ON public.entity_occurrences (case_id);
