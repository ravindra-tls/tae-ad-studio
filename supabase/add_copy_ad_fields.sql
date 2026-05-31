-- Migration: add copy-ad workflow fields to sessions table
-- Run this in Supabase Dashboard → SQL Editor

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS source           TEXT    DEFAULT 'template',
  ADD COLUMN IF NOT EXISTS reference_image_url TEXT  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS copy_ad_group_id UUID    DEFAULT NULL;

COMMENT ON COLUMN sessions.source IS
  'Origin workflow: ''template'' (default template picker), ''brief'' (brief-first pipeline), '
  '''copy_ad'' (copy-from-reference-ad feature).';

COMMENT ON COLUMN sessions.reference_image_url IS
  'Public URL of the reference ad image used in the copy_ad workflow. '
  'Uploaded to generated-images storage bucket under copy-ad/[groupId]/reference.[ext].';

COMMENT ON COLUMN sessions.copy_ad_group_id IS
  'Groups all sessions created in a single copy-ad batch together. '
  'All sessions in the same batch share the same reference ad and UUID.';

-- Index for the results page — fetches all sessions in a group at once
CREATE INDEX IF NOT EXISTS idx_sessions_copy_ad_group_id
  ON sessions (copy_ad_group_id)
  WHERE copy_ad_group_id IS NOT NULL;
