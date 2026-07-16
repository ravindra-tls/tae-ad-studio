'use server';

import { assertAdmin } from '@/lib/auth/guards';
import { revalidatePath } from 'next/cache';
import type { ProductContext, Ingredient, Claim, ColorEntry, ProductImage } from '@/types';

const REFERENCE_BUCKET = 'product-references';

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
  const { service: supabase } = await assertAdmin();

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
  const { service: supabase } = await assertAdmin();
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
  const { service: supabase } = await assertAdmin();

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
  const { service: supabase } = await assertAdmin();

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

export type ProductCreatePayload = {
  name: string;
  brand: string;
  sub_brand?: string | null;
  description?: string | null;
  ingredients?: Ingredient[];
  claims?: Claim[];
  color_palette?: ColorEntry[];
  prompt_modifier?: string | null;
  compliance_rules?: string[];
  context?: ProductContext | null;
};

export async function createProduct(data: ProductCreatePayload) {
  const { service: supabase } = await assertAdmin();

  const { data: product, error } = await supabase
    .from('products')
    .insert({
      name:              data.name,
      brand:             data.brand,
      sub_brand:         data.sub_brand || null,
      description:       data.description || null,
      ingredients:       data.ingredients || [],
      claims:            data.claims || [],
      color_palette:     data.color_palette || [],
      prompt_modifier:   data.prompt_modifier || null,
      compliance_rules:  data.compliance_rules || [],
      context:           data.context || null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  revalidatePath('/admin/products');
  revalidatePath('/session/new');
  revalidatePath('/dashboard');
  return product;
}

export async function deleteProduct(id: string) {
  const { service: supabase } = await assertAdmin();

  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);

  revalidatePath('/admin/products');
}

// ─────────────────────────────────────────────────────────────────────────────
// Reference images — private bucket, signed-URL reads
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Upload a reference image for a product. Writes to the private
 * `product-references` bucket and inserts a `product_images` row with
 * `is_reference = true` and `storage_path` populated. Admin-only.
 */
export async function uploadProductReferenceImage(
  productId: string,
  formData: FormData,
): Promise<ProductImage> {
  const { service: supabase } = await assertAdmin();

  const file = formData.get('file') as File | null;
  const label = (formData.get('label') as string | null)?.trim() || null;
  if (!file || file.size === 0) throw new Error('No file provided');

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `${productId}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(REFERENCE_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (uploadError) throw new Error(uploadError.message);

  const { data: row, error: insertError } = await supabase
    .from('product_images')
    .insert({
      product_id: productId,
      storage_path: path,
      storage_bucket: REFERENCE_BUCKET,
      url: null,
      label,
      is_reference: true,
    })
    .select()
    .single();

  if (insertError) {
    // Best-effort cleanup so a failed DB insert doesn't leave orphaned bytes.
    await supabase.storage.from(REFERENCE_BUCKET).remove([path]);
    throw new Error(insertError.message);
  }

  revalidatePath('/admin/products');
  return row as ProductImage;
}

/** Delete a reference image row and its underlying storage object. */
export async function deleteProductReferenceImage(imageId: string) {
  const { service: supabase } = await assertAdmin();

  const { data: row, error: fetchError } = await supabase
    .from('product_images')
    .select('*')
    .eq('id', imageId)
    .single();

  if (fetchError) throw new Error(fetchError.message);
  if (!row) throw new Error('Reference image not found');

  if (row.storage_path && row.storage_bucket) {
    const { error: storageError } = await supabase.storage
      .from(row.storage_bucket)
      .remove([row.storage_path]);
    if (storageError) {
      console.error(
        '[reference-images] storage delete failed, removing row anyway:',
        storageError.message,
      );
    }
  }

  const { error: deleteError } = await supabase
    .from('product_images')
    .delete()
    .eq('id', imageId);

  if (deleteError) throw new Error(deleteError.message);

  revalidatePath('/admin/products');
}

/** Rename (relabel) a reference image. */
export async function updateProductReferenceImageLabel(
  imageId: string,
  label: string | null,
) {
  const { service: supabase } = await assertAdmin();

  const { error } = await supabase
    .from('product_images')
    .update({ label: label?.trim() || null })
    .eq('id', imageId);

  if (error) throw new Error(error.message);
  revalidatePath('/admin/products');
}
