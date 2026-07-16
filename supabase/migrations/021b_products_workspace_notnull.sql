-- ═══════════════════════════════════════════════════════════════════════════
-- 021b_products_workspace_notnull.sql   (follow-up to 021; run AFTER the
-- Phase-3 enforcement code is deployed)
--
-- The Phase-3 deploy makes every product-creation path (createProduct server
-- action, admin tools) stamp products.workspace_id. Once that code is live it
-- is safe to enforce NOT NULL. Splitting this out of 021 avoided a window
-- where the still-old createProduct inserted NULL and 500'd.
--
-- Idempotent. Run in the Supabase SQL editor.
-- ═══════════════════════════════════════════════════════════════════════════

-- Belt-and-suspenders: re-backfill anything that slipped through, then enforce.
update public.products
   set workspace_id = (select id from public.workspaces where slug = 'tae')
 where workspace_id is null;

do $$
declare n bigint;
begin
  select count(*) into n from public.products where workspace_id is null;
  if n > 0 then
    raise exception 'Cannot SET NOT NULL: % products still have NULL workspace_id', n;
  end if;
end $$;

alter table public.products alter column workspace_id set not null;

-- Verify: \d+ public.products  → workspace_id should show "not null"
