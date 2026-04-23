-- ═══════════════════════════════════════════════════════════════════════
-- 015: Enable brief-first UI for the pre-launch team
--
-- Context: migration 009 seeded `brief_first_ui` with enabled=false /
-- rollout_percentage=0. Tasks #12-#21 have since shipped the full
-- brief → concept → copy → visual → render → critique → refine pipeline
-- end-to-end behind that flag. For pre-launch the only users are the
-- in-house marketing team, so keeping it gated adds no safety — it just
-- hides the feature from the people building it.
--
-- Flip to enabled=true at 100% rollout so /session/[id]/brief is reachable
-- and the "Start from a brief" pill shows on the prompts page.
--
-- To re-hide it (e.g. before onboarding external beta testers who should
-- only see templates), either toggle via /admin/feature-flags or write a
-- follow-up migration that sets rollout_percentage back to 0.
-- ═══════════════════════════════════════════════════════════════════════

update public.feature_flags
set enabled = true,
    rollout_percentage = 100,
    updated_at = now()
where name = 'brief_first_ui';
