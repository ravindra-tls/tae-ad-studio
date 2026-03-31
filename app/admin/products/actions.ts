'use server';

import { createServiceClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { ProductContext, Ingredient, Claim, ColorEntry } from '@/types';

export type ProductUpdatePayload = {
  name: string;
  sub_brand: string | null;
  prompt_modifier: string | null;
  compliance_rules: string[];
  ingredients: Ingredient[];
  claims: Claim[];
  color_palette: ColorEntry[];
  context: ProductContext | null;
  thumbnail_url: string | null;
};

export async function updateProduct(id: string, data: ProductUpdatePayload) {
  const supabase = await createServiceClient();

  const { error } = await supabase
    .from('products')
    .update({
      name:              data.name,
      sub_brand:         data.sub_brand || null,
      prompt_modifier:   data.prompt_modifier || null,
      compliance_rules:  data.compliance_rules,
      ingredients:       data.ingredients,
      claims:            data.claims,
      color_palette:     data.color_palette,
      context:           data.context,
      thumbnail_url:     data.thumbnail_url || null,
    })
    .eq('id', id);

  if (error) throw new Error(error.message);

  revalidatePath('/admin/products');
}

export async function uploadProductThumbnail(
  productId: string,
  formData: FormData,
): Promise<string> {
  const supabase = await createServiceClient();
  const file = formData.get('file') as File;

  if (!file || file.size === 0) throw new Error('No file provided');

  const ext  = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  const path = `${productId}/thumbnail.${ext}`;

  // Upload to Supabase Storage (bucket: product-images)
  const { error: uploadError } = await supabase.storage
    .from('product-images')
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadError) throw new Error(uploadError.message);

  const { data: urlData } = supabase.storage
    .from('product-images')
    .getPublicUrl(path);

  // Persist URL immediately on the product row
  await supabase
    .from('products')
    .update({ thumbnail_url: urlData.publicUrl })
    .eq('id', productId);

  revalidatePath('/admin/products');
  return urlData.publicUrl;
}

export async function setProductThumbnail(productId: string, url: string) {
  const supabase = await createServiceClient();

  const { error } = await supabase
    .from('products')
    .update({ thumbnail_url: url })
    .eq('id', productId);

  if (error) throw new Error(error.message);

  revalidatePath('/admin/products');
  revalidatePath('/session/new');
  revalidatePath('/dashboard');
}

/** Map local product images to products by fuzzy name matching */
export async function seedProductThumbnails() {
  const supabase = await createServiceClient();

  const IMAGE_MAP: Record<string, string> = {
    'balaayah':  '/product_images/balaayah.webp',
    'flex':      '/product_images/flex-fine-joint-supplement-for-cartilage-bone-and-synovial-fluid-support-vegan-scientifically-tested-ayuttva-969149_5000x.webp',
    'manjish':   '/product_images/manjish-glow-elixir-ayurvedic-night-time-face-oil-natural-moisturizer-for-healthy-skin-night-time-face-oil-iyura-218724_5000x.jpg',
    'rufolia':   '/product_images/rufolia.webp',
  };

  const { data: products } = await supabase.from('products').select('id, name');
  if (!products) return;

  let updated = 0;
  for (const product of products) {
    const nameLower = product.name.toLowerCase();
    for (const [keyword, imageUrl] of Object.entries(IMAGE_MAP)) {
      if (nameLower.includes(keyword)) {
        await supabase
          .from('products')
          .update({ thumbnail_url: imageUrl })
          .eq('id', product.id);
        updated++;
        break;
      }
    }
  }

  revalidatePath('/admin/products');
  revalidatePath('/session/new');
  revalidatePath('/dashboard');
  return updated;
}

export async function deleteProduct(id: string) {
  const supabase = await createServiceClient();

  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);

  revalidatePath('/admin/products');
}
