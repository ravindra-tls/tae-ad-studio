/**
 * GET /api/gallery — workspace-scoped image feed.
 *
 * All modes compose ONE base predicate (denormalized columns from 025):
 *   workspace_id = acting workspace · status = completed · image_url not null
 *   · sessions!inner is_test = false
 *
 * Modes/params (composable unless noted):
 *   ?page=&limit=      pagination (default 1 / 48, limit ≤ 96)
 *   ?template_id=      images generated from one template
 *   ?product_id=       direct eq on the denormalized column
 *   ?starred=1         only the caller's image_stars rows
 *   ?q=                search: prompt_used ilike OR product/template/creator
 *                      name matches (resolved to id in-lists server-side)
 *   ?products=1        (exclusive) distinct products that have ≥1 image
 *   ?ids=a,b,c         (exclusive, legacy) fetch specific ids, workspace-scoped
 */
import { NextResponse } from 'next/server';
import { requireMember } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function mapImages(rawImages: any[]) {
  return rawImages.map((img: any) => ({
    id:                img.id,
    session_id:        img.session_id,
    prompt_used:       img.prompt_used,
    aspect_ratio:      img.aspect_ratio,
    image_url:         img.image_url,
    api_provider:      img.api_provider,
    model_id:          img.model_id,
    request_id:        img.request_id,
    status:            img.status,
    error_message:     img.error_message,
    created_at:        img.created_at,
    template_id:       img.template_id ?? null,
    creator_user_id:   img.user_id ?? null,
    creator_name:      img.profile?.full_name ?? img.profile?.email ?? 'Unknown',
    creator_initials:  getInitials(img.profile?.full_name ?? img.profile?.email ?? '?'),
    product_id:        img.product?.id ?? img.product_id ?? null,
    product_name:      img.product?.name ?? null,
    product_sub_brand: img.product?.sub_brand ?? null,
  }));
}

// Joined display fields: product + creator via the denormalized FKs; the
// session join remains ONLY to filter out test sessions.
// profiles embed MUST name its FK: image_stars created a second
// generated_images↔profiles relationship (many-to-many), making the bare
// `profiles` embed ambiguous (PGRST201 — 500s on every page query).
const IMAGE_SELECT = `
  *,
  product:products(id, name, sub_brand, thumbnail_url),
  profile:profiles!generated_images_user_id_fkey(full_name, email),
  session:sessions!inner(is_test)
`;

/** Escape LIKE wildcards in user text (backslash is Postgres' default escape). */
function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (m) => `\\${m}`);
}

/**
 * A double-quoted PostgREST literal for use inside .or() — quotes the value so
 * commas/dots/parens in user text can't break the or-expression parser, and
 * escapes `\` and `"` per PostgREST string rules.
 */
function quoteForOr(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

// Impossible uuid — forces an empty result while keeping one query shape.
const NO_MATCH_ID = '00000000-0000-0000-0000-000000000000';

export async function GET(request: Request) {
  const ctx = await requireMember();
  if (!ctx.ok) return ctx.response;
  const { user, service, workspaceId } = ctx;

  const url = new URL(request.url);

  // ── Ids mode (legacy — swipe/deep-link paths): fetch specific image IDs ───
  const idsParam = url.searchParams.get('ids');
  if (idsParam) {
    const ids = idsParam.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 200);
    if (ids.length === 0) return NextResponse.json({ images: [], total: 0, page: 1, hasMore: false });

    const { data: rawImages, error } = await service
      .from('generated_images')
      .select(IMAGE_SELECT)
      .in('id', ids)
      .eq('workspace_id', workspaceId)
      .eq('session.is_test', false)
      .eq('status', 'completed')
      .not('image_url', 'is', null)
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const images = mapImages(rawImages ?? []);
    return NextResponse.json({ images, total: images.length, page: 1, hasMore: false });
  }

  // ── Products mode: distinct products that have at least one completed image ─
  // Direct select over the denormalized product_id — no sessions round-trip.
  if (url.searchParams.get('products') === '1') {
    const { data: rows, error: prodErr } = await service
      .from('generated_images')
      .select('product_id, product:products(id, name, sub_brand, thumbnail_url), session:sessions!inner(is_test)')
      .eq('workspace_id', workspaceId)
      .eq('session.is_test', false)
      .eq('status', 'completed')
      .not('image_url', 'is', null)
      .not('product_id', 'is', null)
      .limit(1000);

    if (prodErr) return NextResponse.json({ error: prodErr.message }, { status: 500 });

    const map = new Map<string, { id: string; name: string; sub_brand: string | null; thumbnail_url: string | null }>();
    for (const row of rows ?? []) {
      const p = (row as any).product;
      if (p?.id && !map.has(p.id)) {
        map.set(p.id, {
          id:            p.id,
          name:          p.name ?? '',
          sub_brand:     p.sub_brand ?? null,
          thumbnail_url: p.thumbnail_url ?? null,
        });
      }
    }

    const products = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
    return NextResponse.json({ products });
  }

  // ── Paginated mode (with optional template/product/starred/search arms) ───
  const page       = Math.max(1, parseInt(url.searchParams.get('page')  ?? '1'));
  const limit      = Math.min(96, Math.max(1, parseInt(url.searchParams.get('limit') ?? '48')));
  const templateId = url.searchParams.get('template_id') ?? null;
  const productId  = url.searchParams.get('product_id')  ?? null;
  const q          = (url.searchParams.get('q') ?? '').trim().slice(0, 200);
  const from       = (page - 1) * limit;
  const to         = from + limit - 1;

  // ?starred=1 → the caller's starred ids (one query, then a plain in-list).
  let starredIds: string[] | null = null;
  if (url.searchParams.get('starred') === '1') {
    const { data: starRows, error: starErr } = await service
      .from('image_stars')
      .select('image_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(500);
    if (starErr) return NextResponse.json({ error: starErr.message }, { status: 500 });
    starredIds = (starRows ?? []).map((r: any) => r.image_id as string);
  }

  // ?q= → one ilike arm on prompt_used, OR-combined with server-resolved id
  // lists (products / templates / creators), all on denormalized columns.
  let searchOr: string | null = null;
  if (q) {
    const pattern = `%${escapeLike(q)}%`;
    const quoted  = quoteForOr(pattern);

    const [{ data: prodRows }, { data: tplRows }, { data: profRows }] = await Promise.all([
      service.from('products')
        .select('id')
        .eq('workspace_id', workspaceId)
        .ilike('name', pattern)
        .limit(100),
      service.from('prompt_templates')
        .select('id')
        .ilike('name', pattern)
        .limit(100),
      service.from('profiles')
        .select('id')
        .or(`full_name.ilike.${quoted},email.ilike.${quoted}`)
        .limit(50),
    ]);

    const arms = [`prompt_used.ilike.${quoted}`];
    const productIds  = (prodRows ?? []).map((r: any) => r.id as string);
    const templateIds = (tplRows  ?? []).map((r: any) => r.id as string);
    const userIds     = (profRows ?? []).map((r: any) => r.id as string);
    if (productIds.length  > 0) arms.push(`product_id.in.(${productIds.join(',')})`);
    if (templateIds.length > 0) arms.push(`template_id.in.(${templateIds.join(',')})`);
    if (userIds.length     > 0) arms.push(`user_id.in.(${userIds.join(',')})`);
    searchOr = arms.join(',');
  }

  // ONE base predicate shared by the count and page queries.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const baseQuery = (query: any) => {
    let chain = query
      .eq('workspace_id', workspaceId)
      .eq('status', 'completed')
      .not('image_url', 'is', null)
      .eq('session.is_test', false);
    if (templateId) chain = chain.eq('template_id', templateId);
    if (productId)  chain = chain.eq('product_id', productId);
    if (starredIds !== null) {
      // Empty star list → guaranteed no results (single query shape kept)
      chain = chain.in('id', starredIds.length > 0 ? starredIds : [NO_MATCH_ID]);
    }
    if (searchOr) chain = chain.or(searchOr);
    return chain;
  };

  // Real total count (head-only query — no data transfer)
  const { count, error: countErr } = await baseQuery(
    service.from('generated_images').select('id, session:sessions!inner(is_test)', { count: 'exact', head: true })
  );
  if (countErr) return NextResponse.json({ error: countErr.message }, { status: 500 });

  const total = count ?? 0;

  // Paginated image rows with joined product / creator display fields
  const { data: rawImages, error } = await baseQuery(
    service.from('generated_images').select(IMAGE_SELECT)
  )
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const images = mapImages(rawImages ?? []);

  return NextResponse.json({
    images,
    total,
    page,
    hasMore: to < total - 1,
  });
}
