-- 20260406000001_allow_global_case_access.sql
-- Allow access to the Global Legal Case (0000...0000) for all authenticated users.
-- This ensures the Registry feature works even when bypassing ownership checks in the backend.

-- 1. Allow selecting the global case record
CREATE POLICY global_case_select ON public.cases
    FOR SELECT
    TO authenticated
    USING (id = '00000000-0000-0000-0000-000000000000');

-- 2. Allow selecting documents linked to the global case
CREATE POLICY global_case_docs_select ON public.case_documents
    FOR SELECT
    TO authenticated
    USING (case_id = '00000000-0000-0000-0000-000000000000');
