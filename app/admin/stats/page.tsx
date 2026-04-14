import { createServiceClient } from '@/lib/supabase/server';
import { BarChart3 } from 'lucide-react';
import { StatsDisplay } from '@/components/StatsDisplay';
import type { ImageStat } from '@/components/StatsDisplay';

// Always fetch live reaction data — never serve a cached snapshot
export const dynamic = 'force-dynamic';

export default async function StatsPage() {
  const serviceClient = await createServiceClient();

  const { data: raw, error: qErr } = await serviceClient
    .from('image_reactions')
    .select(`
      reaction,
      generated_images (
        id,
        image_url,
        prompt_used,
        created_at,
        sessions (
          products ( name, sub_brand ),
          profiles ( full_name )
        )
      )
    `);

  if (qErr) console.error('[Stats] query error:', qErr.message);

  // ── Build per-image stat map ───────────────────────────────────────────────
  const map = new Map<string, ImageStat>();

  (raw ?? []).forEach((row: any) => {
    const img = row.generated_images;
    if (!img) return;

    const session  = img.sessions;
    const product  = session?.products;
    const creator  = session?.profiles;

    if (!map.has(img.id)) {
      map.set(img.id, {
        id:                img.id,
        image_url:         img.image_url,
        prompt:            img.prompt_used,
        product_name:      product?.name      ?? null,
        product_sub_brand: product?.sub_brand ?? null,
        creator_name:      creator?.full_name ?? 'Unknown',
        created_at:        img.created_at,
        likes:      0,
        dislikes:   0,
        total:      0,
        like_ratio: 0,
      });
    }

    const stat = map.get(img.id)!;
    if (row.reaction === 'like')    stat.likes++;
    if (row.reaction === 'dislike') stat.dislikes++;
    stat.total++;
    stat.like_ratio = Math.round((stat.likes / stat.total) * 100);
  });

  const allStats    = Array.from(map.values()).sort((a, b) => b.total - a.total);
  const topLiked    = [...allStats].sort((a, b) => b.like_ratio - a.like_ratio).slice(0, 3);
  const topDisliked = [...allStats].sort((a, b) => a.like_ratio - b.like_ratio).slice(0, 3);

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-brand-forest flex items-center gap-2">
          <BarChart3 className="h-5 w-5" /> Image Reaction Stats
        </h1>
        <p className="mt-1 text-sm text-brand-slate">
          Swipe data from the Gallery — identify winning prompts and improve weak creatives.
        </p>
      </div>

      <StatsDisplay
        topLiked={topLiked}
        topDisliked={topDisliked}
        allStats={allStats}
      />
    </div>
  );
}
