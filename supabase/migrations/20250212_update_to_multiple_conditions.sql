-- =====================================================
-- Migration: Update to support multiple conditions per report
-- Run this SQL in your Supabase project's SQL Editor
-- =====================================================

-- Drop the old single condition_id column
ALTER TABLE public.updates DROP COLUMN IF EXISTS condition_id;

-- Add new condition_ids column as JSONB array
ALTER TABLE public.updates ADD COLUMN IF NOT EXISTS condition_ids JSONB DEFAULT '[]'::JSONB;

-- Create index for faster queries on condition IDs
CREATE INDEX IF NOT EXISTS updates_condition_ids_idx ON public.updates USING GIN (condition_ids);

-- Add comment for documentation
COMMENT ON COLUMN public.updates.condition_ids IS 'Array of condition IDs referencing the conditions table';
