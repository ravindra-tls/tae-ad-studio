-- ═══════════════════════════════════════════════════════════════════════════
-- 027_search_rpc.sql   (requires 025)
--
-- One-round-trip gallery search with PER-WORD AND semantics: the query is
-- split on whitespace (max 5 words); every word must match at least one of
-- prompt text / product name / template name / creator name or email; words
-- AND together, order-independent. Replaces the route's 5-query pipeline
-- (3 resolvers + count + page) with a single RPC — at ~800ms per round-trip
-- from the team's network, that is the whole optimization.
--
-- Rows return as jsonb with the display fields the gallery API already maps;
-- total rides along via a window count. Idempotent.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.search_gallery_images(
  p_workspace    uuid,
  p_q            text,
  p_template     uuid default null,
  p_product      uuid default null,
  p_starred_user uuid default null,
  p_limit        int  default 48,
  p_offset       int  default 0
)
returns table (row_json jsonb, total bigint)
language sql
stable
as $$
with words as (
  -- split, de-dupe, LIKE-escape (\ % _), cap at 5 words
  select distinct
    replace(replace(replace(w, '\', '\\'), '%', '\%'), '_', '\_') as w
  from unnest(regexp_split_to_array(trim(coalesce(p_q, '')), '\s+')) as w
  where length(w) > 0
  limit 5
),
base as (
  select
    gi.*,
    p.name          as _product_name,
    p.sub_brand     as _product_sub_brand,
    p.thumbnail_url as _product_thumbnail_url,
    pr.full_name    as _creator_full_name,
    pr.email        as _creator_email
  from public.generated_images gi
  join public.sessions s on s.id = gi.session_id and s.is_test = false
  left join public.products         p  on p.id  = gi.product_id
  left join public.profiles         pr on pr.id = gi.user_id
  left join public.prompt_templates pt on pt.id = gi.template_id
  where gi.workspace_id = p_workspace
    and gi.status = 'completed'
    and gi.image_url is not null
    and (p_template is null or gi.template_id = p_template)
    and (p_product  is null or gi.product_id  = p_product)
    and (p_starred_user is null or exists (
          select 1 from public.image_stars st
          where st.image_id = gi.id and st.user_id = p_starred_user))
    -- per-word AND across the OR of searchable fields
    and coalesce((
      select bool_and(
           gi.prompt_used            ilike ('%' || wi.w || '%')
        or coalesce(p.name,  '')     ilike ('%' || wi.w || '%')
        or coalesce(pt.name, '')     ilike ('%' || wi.w || '%')
        or coalesce(pr.full_name,'') ilike ('%' || wi.w || '%')
        or coalesce(pr.email, '')    ilike ('%' || wi.w || '%')
      ) from words wi
    ), true)
)
select to_jsonb(b.*) as row_json, count(*) over() as total
from base b
order by b.created_at desc
limit greatest(1, least(p_limit, 96))
offset greatest(0, p_offset);
$$;

comment on function public.search_gallery_images is
  'Gallery search: per-word AND over prompt/product/template/creator fields, workspace-scoped, is_test-excluded, optional template/product/starred filters. Called via the service client from /api/gallery.';
