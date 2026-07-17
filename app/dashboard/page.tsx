import { createClient, createServiceClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Clock, ArrowRight } from 'lucide-react';
import { UsageMeter } from '@/components/UsageMeter';
import { WorkflowCards } from '@/components/WorkflowCards';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { daysUntilReset, formatDate } from '@/lib/utils';
import { pruneEmptySessions } from '@/lib/prune-sessions';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: { showAll?: string };
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const serviceClient = await createServiceClient();
  const showAll = searchParams?.showAll === '1';

  const [{ data: profile }, { data: products }] = await Promise.all([
    serviceClient.from('profiles').select('*').eq('id', user.id).single(),
    serviceClient.from('products').select('id, name, brand, sub_brand, thumbnail_url').order('brand'),
  ]);

  // ── Prune dead sessions before loading the list (shared rules) ──
  await pruneEmptySessions(serviceClient, user.id);

  // ── Fetch the (now-clean) session list ───────────────────────
  // is_test = admin template-test sessions; never shown in the dashboard.
  const { data: sessions } = await serviceClient
    .from('sessions')
    .select('*, product:products(name, brand, sub_brand, thumbnail_url)')
    .eq('user_id', user.id)
    .eq('is_test', false)
    .order('created_at', { ascending: false });

  const sessionIds = (sessions || []).map((session: any) => session.id);
  const visibleSessions = showAll ? (sessions || []) : (sessions || []).slice(0, 6);

  const { data: generatedImages } = sessionIds.length
    ? await serviceClient
        .from('generated_images')
        .select('session_id, status')
        .in('session_id', sessionIds)
    : { data: [] as Array<{ session_id: string; status: string }> };

  const imageCountBySession = (generatedImages || []).reduce<Record<string, number>>((acc, image) => {
    if (image.status === 'completed') {
      acc[image.session_id] = (acc[image.session_id] || 0) + 1;
    }
    return acc;
  }, {});

  const totalImages = Object.values(imageCountBySession).reduce((sum, count) => sum + count, 0);

  return (
    <div className="animate-fade-in">
      {/* ── Welcome header (no New Session button) ── */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-brand-forest">
          Welcome back, {profile?.full_name?.split(' ')[0] || 'there'}
        </h1>
        <p className="text-sm text-brand-slate mt-1">What would you like to create today?</p>
      </div>

      {/* ── Workflow cards — front and centre ── */}
      <WorkflowCards products={products || []} />

      {/* ── Usage + Stats ── */}
      <div className="grid gap-4 sm:grid-cols-3 mb-8">
        <div className="sm:col-span-2 stagger-item" style={{ animationDelay: '60ms' }}>
          <UsageMeter
            used={profile?.usage_count || 0}
            cap={profile?.usage_cap || 30}
            daysUntilReset={profile?.cycle_reset ? daysUntilReset(profile.cycle_reset) : undefined}
          />
        </div>
        <Card className="stagger-item" style={{ animationDelay: '120ms' }}>
          <CardContent className="flex flex-col items-center justify-center h-full py-4">
            <span className="text-3xl font-bold text-brand-forest">{totalImages || 0}</span>
            <span className="text-sm text-brand-slate">Images Generated</span>
          </CardContent>
        </Card>
      </div>

      {/* ── Recent Sessions ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">
            {showAll ? 'All Sessions' : 'Recent Sessions'}
          </CardTitle>
          {(sessions?.length || 0) > 0 && (
            showAll ? (
              <Link href="/dashboard" className="text-sm text-brand-forest hover:underline flex items-center gap-1">
                Show recent <ArrowRight className="h-3 w-3" />
              </Link>
            ) : (
              (sessions?.length || 0) > 6 && (
                <Link href="/dashboard?showAll=1" className="text-sm text-brand-forest hover:underline flex items-center gap-1">
                  View all <ArrowRight className="h-3 w-3" />
                </Link>
              )
            )
          )}
        </CardHeader>
        <CardContent>
          {!sessions?.length ? (
            <div className="py-8 text-center">
              <p className="text-brand-slate mb-4">No sessions yet. Choose a workflow above to get started!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {visibleSessions.map((session: any, i: number) => (
                <Link
                  key={session.id}
                  href={`/session/${session.id}/results`}
                  className="session-row stagger-item flex items-center gap-4 rounded-lg border border-brand-forest/5 p-3 hover:bg-brand-cream/30 hover:shadow-sm"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  {session.product?.thumbnail_url ? (
                    <div className="relative h-10 w-10 shrink-0 rounded-md overflow-hidden bg-brand-cream border border-brand-forest/10">
                      <Image
                        src={session.product.thumbnail_url}
                        alt={session.product?.name || ''}
                        fill
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-brand-cream text-brand-forest font-serif text-lg">
                      {session.product?.name?.charAt(0) || '?'}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-brand-forest truncate">{session.name}</p>
                    <p className="text-xs text-gray-400 truncate">
                      {session.product?.name} — {session.product?.sub_brand || session.product?.brand}
                      {session.source === 'copy_ad' && (
                        <span className="ml-1.5 text-[10px] font-medium text-brand-forest/60 bg-brand-forest/8 px-1.5 py-0.5 rounded">
                          copy-ad
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px]">
                      {imageCountBySession[session.id] || 0} image{imageCountBySession[session.id] === 1 ? '' : 's'}
                    </Badge>
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <Clock className="h-3 w-3" /> {formatDate(session.created_at)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
