-- =====================================================
-- Migration: Add array-based media columns to updates
-- Run this SQL in your Supabase project's SQL Editor
-- =====================================================

ALTER TABLE public.updates
  ADD COLUMN IF NOT EXISTS media_new JSONB DEFAULT '[]'::JSONB,
  ADD COLUMN IF NOT EXISTS media_type_new JSONB DEFAULT '[]'::JSONB;

ALTER TABLE public.updates
  ALTER COLUMN media_new SET DEFAULT '[]'::JSONB,
  ALTER COLUMN media_type_new SET DEFAULT '[]'::JSONB;

UPDATE public.updates
SET
  media_new = CASE
    WHEN media_new IS NULL OR media_new = '[]'::JSONB
      THEN CASE
        WHEN media IS NULL OR media = '' THEN '[]'::JSONB
        ELSE jsonb_build_array(media)
      END
    ELSE media_new
  END,
  media_type_new = CASE
    WHEN media_type_new IS NULL OR media_type_new = '[]'::JSONB
      THEN CASE
        WHEN media_type IS NULL OR media_type = '' THEN '[]'::JSONB
        ELSE jsonb_build_array(media_type)
      END
    ELSE media_type_new
  END;

COMMENT ON COLUMN public.updates.media_new IS 'Array of media URLs for each report';
COMMENT ON COLUMN public.updates.media_type_new IS 'Array of media MIME types for each report';
