import { createClient, createServiceClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { SubmitAsTemplateButton } from './submit-as-template-button';

export default async function CopyAdResultsPage({
  searchParams,
}: {
  searchParams?: { group?: string };
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const groupId = searchParams?.group;
  if (!groupId) redirect('/dashboard');

  const service = await createServiceClient();

  // Fetch all sessions in this copy-ad batch (must belong to this user)
  const { data: sessions } = await service
    .from('sessions')
    .select('*, product:products(id, name, brand, sub_brand, thumbnail_url)')
    .eq('copy_ad_group_id', groupId)
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });

  if (!sessions?.length) redirect('/dashboard');

  // Reference image from any session (they all share the same one)
  const referenceImageUrl = (sessions[0] as any).reference_image_url as string | null;

  // Fetch generated images for all sessions
  const sessionIds = sessions.map((s) => s.id);
  const { data: generatedImages } = await service
    .from('generated_images')
    .select('*')
    .in('session_id', sessionIds)
    .order('created_at', { ascending: false });

  // Map: sessionId → latest image
  const imageBySession = new Map<string, any>();
  for (const img of (generatedImages || [])) {
    if (!imageBySession.has(img.session_id)) {
      imageBySession.set(img.session_id, img);
    }
  }

  const allDone = sessions.every((s) => {
    const img = imageBySession.get(s.id);
    return img && (img.status === 'completed' || img.status === 'failed');
  });

  return (
    <div className="animate-fade-in max-w-5xl mx-auto">
      {/* ── Header ── */}
      <div className="mb-8 flex items-center gap-4">
        <Link href="/dashboard">
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Dashboard
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-brand-forest">Copy-Ad Results</h1>
          <p className="text-sm text-brand-slate mt-0.5">
            {sessions.length} product{sessions.length !== 1 ? 's' : ''} generated from your reference ad
          </p>
        </div>

        <SubmitAsTemplateButton groupId={groupId} />
      </div>

      {/* ── Reference image ── */}
      {referenceImageUrl && (
        <div className="mb-8 rounded-2xl border border-brand-forest/10 bg-brand-cream/30 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-slate mb-3">Reference Ad Used</p>
          <div className="flex items-start gap-4">
            <div className="relative h-36 w-36 shrink-0 rounded-xl overflow-hidden border border-brand-forest/10 bg-white">
              <Image
                src={referenceImageUrl}
                alt="Reference ad"
                fill
                className="object-contain"
              />
            </div>
            <div className="pt-1">
              <p className="text-sm font-medium text-brand-forest mb-1">
                AI extracted the creative pattern from this ad
              </p>
              <p className="text-xs text-brand-slate leading-relaxed max-w-xs">
                The composition, visual style, and layout were extracted and then adapted for each of your selected products — without copying any hardcoded text or exact visuals.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Refresh notice if still generating ── */}
      {!allDone && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-center gap-2 text-sm text-amber-800">
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
          Some images are still generating. Refresh the page in a moment to see all results.
        </div>
      )}

      {/* ── Results grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {sessions.map((session: any) => {
          const img   = imageBySession.get(session.id);
          const product = session.product;
          const done    = img?.status === 'completed';
          const failed  = img?.status === 'failed';
          const pending = !img || img.status === 'queued' || img.status === 'in_progress';

          return (
            <div
              key={session.id}
              className="rounded-2xl border border-brand-forest/10 overflow-hidden bg-white shadow-sm"
            >
              {/* Image area */}
              <div className="relative aspect-square bg-brand-cream/50">
                {done && img.image_url ? (
                  <Image
                    src={img.image_url}
                    alt={product?.name || 'Generated ad'}
                    fill
                    className="object-cover"
                  />
                ) : failed ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center">
                    <XCircle className="h-8 w-8 text-brand-wine/60" />
                    <p className="text-xs text-brand-slate">Generation failed</p>
                    <p className="text-[11px] text-brand-slate/60">{img?.error_message || 'Unknown error'}</p>
                  </div>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                    <Loader2 className="h-8 w-8 text-brand-forest/40 animate-spin" />
                    <p className="text-xs text-brand-slate">Generating…</p>
                  </div>
                )}

                {done && (
                  <div className="absolute top-2 right-2">
                    <CheckCircle2 className="h-5 w-5 text-green-500 drop-shadow" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  {product?.thumbnail_url && (
                    <div className="relative h-6 w-6 shrink-0 rounded overflow-hidden border border-brand-forest/10">
                      <Image src={product.thumbnail_url} alt="" fill className="object-cover" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-brand-forest truncate">
                      {product?.name || 'Unknown product'}
                    </p>
                    <p className="text-[11px] text-brand-slate truncate">
                      {product?.sub_brand || product?.brand}
                    </p>
                  </div>
                </div>

                {img && (
                  <div className="flex items-center gap-2 mt-2">
                    <Badge
                      variant="secondary"
                      className={cn(
                        'text-[10px]',
                        done   ? 'bg-green-50 text-green-700' :
                        failed ? 'bg-red-50 text-red-700'     :
                                 'bg-amber-50 text-amber-700',
                      )}
                    >
                      {done ? 'Ready' : failed ? 'Failed' : 'Generating'}
                    </Badge>
                    {img.aspect_ratio && (
                      <span className="text-[10px] text-brand-slate">{img.aspect_ratio}</span>
                    )}
                  </div>
                )}

                {/* Open in session link */}
                <Link
                  href={`/session/${session.id}/results`}
                  className="mt-3 flex items-center gap-1 text-[11px] text-brand-teal hover:underline"
                >
                  Open in gallery <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
