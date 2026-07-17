import { redirect } from 'next/navigation';
import { requirePageMember, isAdminRole, isDevRole } from '@/lib/auth/guards';
import { getBadgeCounts } from '@/lib/get-profile';
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

  // All four reads are independent — one parallel stage instead of four
  // serial awaits (each round-trip costs ~800ms on this network).
  const [{ data: ratedRows }, { count }, { data: rawImages }, badgeCounts] = await Promise.all([
    // Image IDs this user already reacted to — skipped in swipe mode. Keyed
    // by user_id (per-viewer); the image list it filters is workspace-scoped.
    service
      .from('image_reactions')
      .select('image_id')
      .eq('user_id', user.id),
    // Real total count (head-only) — workspace-scoped via the denormalized
    // column (025); session join only for is_test.
    service
      .from('generated_images')
      .select('id, session:sessions!inner(is_test)', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('session.is_test', false)
      .eq('status', 'completed')
      .not('image_url', 'is', null),
    // First page — SSR initial data for instant first paint
    service
      .from('generated_images')
      .select(`
        *,
        session:sessions!inner(
          is_test,
          user_id,
          product:products(id, name, sub_brand, thumbnail_url),
          profile:profiles(full_name, email)
        )
      `)
      .eq('workspace_id', workspaceId)
      .eq('session.is_test', false)
      .eq('status', 'completed')
      .not('image_url', 'is', null)
      .order('created_at', { ascending: false })
      .range(0, PAGE_SIZE - 1),
    getBadgeCounts(service, profile.role, workspaceId),
  ]);

  const ratedImageIds = new Set((ratedRows ?? []).map((r: any) => r.image_id as string));
  const totalCount = count ?? 0;

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
      isAdmin={isAdminRole(profile.role)}
      isDev={isDevRole(profile.role)}
      badgeCounts={badgeCounts}
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
