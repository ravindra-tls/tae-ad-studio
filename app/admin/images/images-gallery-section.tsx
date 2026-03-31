import { createServiceClient } from '@/lib/supabase/server';
import { ImageGallery } from '@/components/ImageGallery';

export async function ImagesGallerySection() {
  const supabase = await createServiceClient();

  const { data: images } = await supabase
    .from('generated_images')
    .select('*')
    .order('created_at', { ascending: false });

  return <ImageGallery images={images || []} />;
}
