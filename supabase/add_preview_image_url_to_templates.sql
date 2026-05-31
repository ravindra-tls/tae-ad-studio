-- Migration: add preview_image_url to prompt_templates
-- Run this in Supabase Dashboard → SQL Editor

ALTER TABLE prompt_templates
  ADD COLUMN IF NOT EXISTS preview_image_url TEXT DEFAULT NULL;

COMMENT ON COLUMN prompt_templates.preview_image_url IS
  'AI-generated preview image URL using the Sulwhasoo demo product. '
  'Generated via POST /api/admin/templates/[id]/preview. '
  'Displayed to users in the template selection grid so they can visually '
  'understand the ad layout without reading the prompt text.';
