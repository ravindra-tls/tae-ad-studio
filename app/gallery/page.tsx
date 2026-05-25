import { createClient, createServiceClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { AppLayout } from '@/components/AppLayout';
import { Gallery } from '@/components/Gallery';
import type { GalleryImage } from '@/types';

export default async function GalleryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const serviceClient = await createServiceClient();

  const { data: profile } = await serviceClient
    .from('profiles')
    .select('role, full_name, email')
    .eq('id', user.id)
    .single();

  // Fetch image IDs this user has already reacted to — used to skip them in swipe mode
  const { data: ratedRows } = await serviceClient
    .from('image_reactions')
    .select('image_id')
    .eq('user_id', user.id);

  const ratedImageIds = new Set((ratedRows ?? []).map((r: any) => r.image_id as string));

  // Fetch all completed images with joined session → product + profile data
  const { data: rawImages } = await serviceClient
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
    .limit(200);

  // Flatten joined data into GalleryImage shape
  const images: GalleryImage[] = (rawImages || []).map((img: any) => ({
    id:            img.id,
    session_id:    img.session_id,
    prompt_used:   img.prompt_used,
    aspect_ratio:  img.aspect_ratio,
    image_url:     img.image_url,
    api_provider:  img.api_provider,
    model_id:      img.model_id,
    request_id:    img.request_id,
    status:        img.status,
    error_message: img.error_message,
    created_at:    img.created_at,
    template_id:   img.template_id ?? null,
    // Joined
    creator_user_id:   img.session?.user_id ?? null,
    creator_name:      img.session?.profile?.full_name ?? img.session?.profile?.email ?? 'Unknown',
    creator_initials:  getInitials(img.session?.profile?.full_name ?? img.session?.profile?.email ?? '?'),
    product_id:        img.session?.product?.id ?? null,
    product_name:      img.session?.product?.name ?? null,
    product_sub_brand: img.session?.product?.sub_brand ?? null,
  }));

  return (
    <AppLayout
      fullName={profile?.full_name ?? null}
      email={profile?.email ?? user.email ?? null}
      isAdmin={profile?.role === 'admin'}
    >
      <Gallery images={images} currentUserId={user.id} ratedImageIds={ratedImageIds} />
    </AppLayout>
  );
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}
