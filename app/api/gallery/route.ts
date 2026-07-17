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

// (LIKE-escaping for search lives inside the search_gallery_images RPC.)

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

  const starredMode = url.searchParams.get('starred') === '1';

  // ?q= → ONE round-trip: the search_gallery_images RPC (migration 027) does
  // per-word AND matching over prompt/product/template/creator fields, all
  // filters (including stars), the page, and the window count in a single
  // statement. The old path was 5 queries (3 resolvers + count + page).
  if (q) {
    const { data: rpcRows, error: rpcErr } = await service.rpc('search_gallery_images', {
      p_workspace:    workspaceId,
      p_q:            q,
      p_template:     templateId,
      p_product:      productId,
      p_starred_user: starredMode ? user.id : null,
      p_limit:        limit,
      p_offset:       from,
    });
    if (rpcErr) return NextResponse.json({ error: rpcErr.message }, { status: 500 });

    const rows  = (rpcRows ?? []) as Array<{ row_json: any; total: number }>;
    const total = rows.length > 0 ? Number(rows[0].total) : 0;
    // RPC rows are flat (product/creator fields prefixed _) — adapt to the
    // same GalleryImage shape mapImages produces.
    const images = mapImages(rows.map((r) => ({
      ...r.row_json,
      product: r.row_json.product_id
        ? { id: r.row_json.product_id, name: r.row_json._product_name, sub_brand: r.row_json._product_sub_brand, thumbnail_url: r.row_json._product_thumbnail_url }
        : null,
      profile: { full_name: r.row_json._creator_full_name, email: r.row_json._creator_email },
    })));

    return NextResponse.json({ images, total, page, hasMore: to < total - 1 });
  }

  // ?starred=1 (non-search) → the caller's starred ids, then a plain in-list.
  let starredIds: string[] | null = null;
  if (starredMode) {
    const { data: starRows, error: starErr } = await service
      .from('image_stars')
      .select('image_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(500);
    if (starErr) return NextResponse.json({ error: starErr.message }, { status: 500 });
    starredIds = (starRows ?? []).map((r: any) => r.image_id as string);
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
    return chain;
  };

  // Count (head-only) and page rows are independent — one parallel stage.
  const [{ count, error: countErr }, { data: rawImages, error }] = await Promise.all([
    baseQuery(
      service.from('generated_images').select('id, session:sessions!inner(is_test)', { count: 'exact', head: true })
    ),
    baseQuery(
      service.from('generated_images').select(IMAGE_SELECT)
    )
      .order('created_at', { ascending: false })
      .range(from, to),
  ]);
  if (countErr) return NextResponse.json({ error: countErr.message }, { status: 500 });
  if (error)    return NextResponse.json({ error: error.message }, { status: 500 });

  const total  = count ?? 0;
  const images = mapImages(rawImages ?? []);

  return NextResponse.json({
    images,
    total,
    page,
    hasMore: to < total - 1,
  });
}
