/**
 * /gallery/template/[id]
 *
 * Shows all generated images for a specific template — identical functionality
 * to the main gallery page (filters, starring, swipe mode, lightbox, etc.) but
 * scoped to a single template and headed by the template name.
 */

import { redirect }    from 'next/navigation';
import { requirePageMember, isAdminRole, isDevRole } from '@/lib/auth/guards';
import { getBadgeCounts } from '@/lib/get-profile';
import { AppLayout }   from '@/components/AppLayout';
import { Gallery }     from '@/components/Gallery';
import Link            from 'next/link';
import { ArrowLeft }   from 'lucide-react';
import type { GalleryImage, PromptTemplate } from '@/types';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 48;

function getInitials(name: string): string {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

export default async function TemplateGalleryPage({
  params,
}: {
  params: { id: string };
}) {
  const ctx = await requirePageMember();
  if (!ctx.workspaceId) redirect('/dev');
  const { user, profile, service, workspaceId } = ctx;

  // ── Template metadata ─────────────────────────────────────────────────────
  const { data: template } = await service
    .from('prompt_templates')
    .select('id, name, category, number, default_aspect_ratio')
    .eq('id', params.id)
    .single();

  if (!template) redirect('/gallery');

  const t = template as Pick<PromptTemplate, 'id' | 'name' | 'category' | 'number' | 'default_aspect_ratio'>;

  // ── Already-rated image IDs for swipe mode ────────────────────────────────
  const { data: ratedRows } = await service
    .from('image_reactions')
    .select('image_id')
    .eq('user_id', user.id);

  const ratedImageIds = new Set((ratedRows ?? []).map((r: any) => r.image_id as string));

  // ── Total count scoped to this template ───────────────────────────────────
  // Workspace scope via the denormalized column (025); session join only for is_test.
  const { count } = await service
    .from('generated_images')
    .select('id, session:sessions!inner(is_test)', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('session.is_test', false)
    .eq('template_id', params.id)
    .eq('status', 'completed')
    .not('image_url', 'is', null);

  const totalCount = count ?? 0;

  // ── First page SSR ────────────────────────────────────────────────────────
  const { data: rawImages } = await service
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
    .eq('template_id', params.id)
    .eq('status', 'completed')
    .not('image_url', 'is', null)
    .order('created_at', { ascending: false })
    .range(0, PAGE_SIZE - 1);

  const initialImages: GalleryImage[] = (rawImages ?? []).map((img: any) => ({
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

  const badgeCounts = await getBadgeCounts(service, profile.role, workspaceId);

  return (
    <AppLayout
      fullName={profile.full_name ?? null}
      email={profile.email ?? user.email ?? null}
      isAdmin={isAdminRole(profile.role)}
      isDev={isDevRole(profile.role)}
      badgeCounts={badgeCounts}
    >
      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="mb-6 flex items-start gap-4">
        <Link
          href="/gallery"
          className="mt-0.5 flex items-center gap-1.5 text-sm text-brand-slate hover:text-brand-forest transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Gallery
        </Link>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-brand-slate/50">#{t.number}</span>
            <h1 className="text-xl font-bold text-brand-forest truncate">{t.name}</h1>
            <span className="text-xs bg-brand-cream text-brand-slate px-2 py-0.5 rounded-full">
              {t.category}
            </span>
            <span className="text-xs bg-brand-cream text-brand-slate px-2 py-0.5 rounded-full">
              {t.default_aspect_ratio}
            </span>
          </div>
          <p className="text-sm text-brand-slate mt-0.5">
            {totalCount === 0
              ? 'No images generated with this template yet'
              : `${totalCount} image${totalCount === 1 ? '' : 's'} generated`}
          </p>
        </div>
      </div>

      {/* ── Gallery ──────────────────────────────────────────────────────── */}
      {totalCount === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="text-brand-slate/60 text-sm">
            No images have been generated with this template yet.
          </p>
          <Link
            href="/gallery"
            className="mt-4 text-sm font-medium text-brand-forest hover:underline"
          >
            Back to gallery
          </Link>
        </div>
      ) : (
        <Gallery
          initialImages={initialImages}
          totalCount={totalCount}
          currentUserId={user.id}
          ratedImageIds={ratedImageIds}
          templateId={params.id}
        />
      )}
    </AppLayout>
  );
}
