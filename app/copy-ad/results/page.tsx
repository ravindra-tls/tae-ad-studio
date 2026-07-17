import { redirect } from 'next/navigation';
import { requirePageMember } from '@/lib/auth/guards';
import { AppLayout } from '@/components/AppLayout';
import { CopyAdResults, type CopyAdSessionRow } from './results-client';
import type { GeneratedImage } from '@/types';

export default async function CopyAdResultsPage({
  searchParams,
}: {
  searchParams?: { group?: string };
}) {
  const { user, profile, service } = await requirePageMember();

  const groupId = searchParams?.group;
  if (!groupId) redirect('/dashboard');

  // Fetch all sessions in this copy-ad batch (must belong to this user)
  const { data: sessions } = await service
    .from('sessions')
    .select('*, product:products(id, name, brand, sub_brand, thumbnail_url)')
    .eq('copy_ad_group_id', groupId)
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });

  if (!sessions?.length) redirect('/dashboard');

  // Narrow to the serializable shape the client component needs
  const sessionRows: CopyAdSessionRow[] = sessions.map((s: any) => ({
    id:                  s.id as string,
    reference_image_url: (s.reference_image_url as string | null) ?? null,
    product:             s.product ?? null,
  }));

  // Fetch generated images for all sessions → latest image per session
  const sessionIds = sessions.map((s: any) => s.id as string);
  const { data: generatedImages } = await service
    .from('generated_images')
    .select('*')
    .in('session_id', sessionIds)
    .order('created_at', { ascending: false });

  const imageBySession: Record<string, GeneratedImage> = {};
  for (const img of (generatedImages || []) as GeneratedImage[]) {
    if (!imageBySession[img.session_id]) {
      imageBySession[img.session_id] = img;
    }
  }

  return (
    <AppLayout
      fullName={profile.full_name ?? null}
      email={profile.email ?? user.email ?? null}
      isAdmin={profile.role === 'admin'}
    >
      <CopyAdResults
        groupId={groupId}
        sessions={sessionRows}
        imageBySession={imageBySession}
      />
    </AppLayout>
  );
}
