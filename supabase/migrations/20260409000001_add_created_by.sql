-- Migration: Add Forensic Provenance (T-17 Fix)
-- Created: 2026-04-09
-- This migration adds a 'created_by' column to distinguish AI-generated 
-- records from human-verified records, ensuring forensic integrity.

ALTER TABLE public.claims 
ADD COLUMN IF NOT EXISTS created_by TEXT DEFAULT 'system';

ALTER TABLE public.audit_flags 
ADD COLUMN IF NOT EXISTS created_by TEXT DEFAULT 'system';
