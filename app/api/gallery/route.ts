import { createClient, createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

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
    creator_user_id:   img.session?.user_id ?? null,
    creator_name:      img.session?.profile?.full_name ?? img.session?.profile?.email ?? 'Unknown',
    creator_initials:  getInitials(img.session?.profile?.full_name ?? img.session?.profile?.email ?? '?'),
    product_id:        img.session?.product?.id ?? null,
    product_name:      img.session?.product?.name ?? null,
    product_sub_brand: img.session?.product?.sub_brand ?? null,
  }));
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const service = await createServiceClient();
  const url     = new URL(request.url);

  // ── Starred mode: fetch specific image IDs only ──────────────────────────
  // ?ids=uuid1,uuid2,... fetches exactly those images, no pagination.
  // Used by the starred tab so it doesn't have to load all pages to find stars.
  const idsParam = url.searchParams.get('ids');
  if (idsParam) {
    const ids = idsParam.split(',').map(s => s.trim()).filter(Boolean).slice(0, 200);
    if (ids.length === 0) return NextResponse.json({ images: [], total: 0, page: 1, hasMore: false });

    const { data: rawImages, error } = await service
      .from('generated_images')
      .select(`
        *,
        session:sessions(
          user_id,
          product:products(id, name, sub_brand, thumbnail_url),
          profile:profiles(full_name, email)
        )
      `)
      .in('id', ids)
      .eq('status', 'completed')
      .not('image_url', 'is', null)
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const images = mapImages(rawImages ?? []);
    return NextResponse.json({ images, total: images.length, page: 1, hasMore: false });
  }

  // ── Normal paginated mode ────────────────────────────────────────────────
  const page    = Math.max(1, parseInt(url.searchParams.get('page')  ?? '1'));
  const limit   = Math.min(96, Math.max(1, parseInt(url.searchParams.get('limit') ?? '48')));
  const from    = (page - 1) * limit;
  const to      = from + limit - 1;

  // Real total count (head-only query — no data transfer)
  const { count } = await service
    .from('generated_images')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'completed')
    .not('image_url', 'is', null);

  const total = count ?? 0;

  // Paginated image rows with joined session → product + profile
  const { data: rawImages, error } = await service
    .from('generated_images')
    .select(`
      *,
      session:sessions(
        user_id,
        product:products(id, name, sub_brand, thumbnail_url),
        profile:profiles(full_name, email)
      )
    `)
    .eq('status', 'completed')
    .not('image_url', 'is', null)
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
