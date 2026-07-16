import { redirect } from 'next/navigation';
import { requirePageMember } from '@/lib/auth/guards';
import { AppLayout } from '@/components/AppLayout';
import { Gallery } from '@/components/Gallery';
import type { GalleryImage } from '@/types';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 48;

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export default async function GalleryPage() {
  const ctx = await requirePageMember();
  if (!ctx.workspaceId) redirect('/dev');
  const { user, profile, service, workspaceId } = ctx;

  // Fetch image IDs this user has already reacted to — used to skip them in swipe mode.
  // Keyed by user_id (per-viewer), so it needs no workspace scope — the image list it
  // filters against is already workspace-scoped below.
  const { data: ratedRows } = await service
    .from('image_reactions')
    .select('image_id')
    .eq('user_id', user.id);

  const ratedImageIds = new Set((ratedRows ?? []).map((r: any) => r.image_id as string));

  // Real total count (head-only, no data transfer) — scoped to the acting workspace
  const { count } = await service
    .from('generated_images')
    .select('id, session:sessions!inner(workspace_id)', { count: 'exact', head: true })
    .eq('session.workspace_id', workspaceId)
    .eq('session.is_test', false)
    .eq('status', 'completed')
    .not('image_url', 'is', null);

  const totalCount = count ?? 0;

  // First page — SSR initial data for instant first paint, scoped to the acting workspace
  const { data: rawImages } = await service
    .from('generated_images')
    .select(`
      *,
      session:sessions!inner(
        workspace_id,
        user_id,
        product:products(id, name, sub_brand, thumbnail_url),
        profile:profiles(full_name, email)
      )
    `)
    .eq('session.workspace_id', workspaceId)
    .eq('session.is_test', false)
    .eq('status', 'completed')
    .not('image_url', 'is', null)
    .order('created_at', { ascending: false })
    .range(0, PAGE_SIZE - 1);

  const initialImages: GalleryImage[] = (rawImages || []).map((img: any) => ({
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

  return (
    <AppLayout
      fullName={profile.full_name ?? null}
      email={profile.email ?? user.email ?? null}
      isAdmin={profile.role === 'admin'}
    >
      <Gallery
        initialImages={initialImages}
        totalCount={totalCount}
        currentUserId={user.id}
        ratedImageIds={ratedImageIds}
      />
    </AppLayout>
  );
}
