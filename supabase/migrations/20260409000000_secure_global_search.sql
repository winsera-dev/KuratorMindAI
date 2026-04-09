-- Migration: Secure Global Search (T-08 Fix)
-- Created: 2026-04-09
-- This migration adds a new PL/pgSQL function to perform vector similarity search
-- across all document chunks owned by a specific user, ensuring tenant isolation.

CREATE OR REPLACE FUNCTION public.match_global_chunks_by_user(
    query_embedding vector(768),
    user_id_param UUID,
    match_count INTEGER DEFAULT 10,
    match_threshold FLOAT DEFAULT 0.1,
    exclude_case_id UUID DEFAULT NULL
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
    JOIN public.cases c ON dc.case_id = c.id
    WHERE c.user_id = user_id_param
      AND (exclude_case_id IS NULL OR dc.case_id != exclude_case_id)
      AND 1 - (dc.embedding <=> query_embedding) >= match_threshold
    ORDER BY dc.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;
