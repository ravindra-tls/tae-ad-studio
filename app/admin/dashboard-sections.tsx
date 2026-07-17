import Link from 'next/link';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/server';
import { requirePageAdmin } from '@/lib/auth/guards';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';
import { DashboardImagesGrid } from '@/components/DashboardImagesGrid';
import {
  ArrowRight,
  FolderKanban,
  ImageIcon,
  MessageSquarePlus,
  Package,
  Users,
} from 'lucide-react';

export async function DashboardSummarySection() {
  const supabase = await createServiceClient();

  const [
    { count: userCount },
    { count: sessionCount },
    { count: imageCount },
    { count: inFlightCount },
    { count: productCount },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('sessions').select('*', { count: 'exact', head: true }),
    supabase.from('generated_images').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
    supabase.from('generated_images').select('*', { count: 'exact', head: true }).in('status', ['queued', 'in_progress']),
    supabase.from('products').select('*', { count: 'exact', head: true }),
  ]);

  const summaryStats = [
    {
      label: 'Users',
      value: userCount || 0,
      sublabel: 'active accounts',
      icon: Users,
      accent: 'text-brand-forest',
    },
    {
      label: 'Sessions',
      value: sessionCount || 0,
      sublabel: 'total created',
      icon: FolderKanban,
      accent: 'text-sky-600',
    },
    {
      label: 'Images',
      value: imageCount || 0,
      sublabel: `${inFlightCount || 0} in flight`,
      icon: ImageIcon,
      accent: 'text-brand-lime',
    },
    {
      label: 'Products',
      value: productCount || 0,
      sublabel: 'available in library',
      icon: Package,
      accent: 'text-green-600',
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {summaryStats.map(({ label, value, sublabel, icon: Icon, accent }, index) => (
        <Card
          key={label}
          className="overflow-hidden animate-fade-in"
          style={{ animationDelay: `${index * 80}ms` }}
        >
          <CardContent className="p-0">
            <div className="flex items-center justify-between px-5 py-4">
              <div>
                <p className="text-sm font-medium text-brand-slate">{label}</p>
                <p className="mt-2 text-4xl font-bold text-brand-forest">{value}</p>
                <p className="mt-1 text-xs text-brand-slate">{sublabel}</p>
              </div>
              <div className="rounded-2xl bg-brand-cream p-3">
                <Icon className={`h-6 w-6 ${accent}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export async function DashboardMainSection() {
  const { service: supabase, workspaceId, user } = await requirePageAdmin();
  if (!workspaceId) redirect('/dev');

  const [
    { data: recentImages },
    { data: recentProducts },
    { count: pendingProposalsCount },
    { data: latestProposal },
  ] = await Promise.all([
    supabase
      .from('generated_images')
      .select('id, session_id, image_url, prompt_used, aspect_ratio, api_provider, model_id, request_id, status, error_message, created_at, session:sessions!inner(workspace_id)')
      .eq('session.workspace_id', workspaceId)
      .eq('session.is_test', false)
      .eq('status', 'completed')
      .not('image_url', 'is', null)
      .order('created_at', { ascending: false })
      .limit(8),
    supabase
      .from('products')
      .select('id, name, brand, sub_brand, thumbnail_url')
      .eq('workspace_id', workspaceId)
      .is('archived_at', null)
      .order('created_at', { ascending: false })
      .limit(6),
    // Workspace admins review template proposals; general feedback routes to
    // the dev inbox (context_contributions "approvals" are retired).
    supabase.from('feedback_submissions').select('*', { count: 'exact', head: true })
      .eq('kind', 'template_proposal').eq('workspace_id', workspaceId).eq('status', 'pending'),
    supabase
      .from('feedback_submissions')
      .select('id, kind, title, status, created_at')
      .eq('kind', 'template_proposal')
      .eq('workspace_id', workspaceId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[1.65fr_1fr]">
      <div className="space-y-6">
        <Card className="self-start animate-fade-in">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Recent Generated Images</CardTitle>
              <CardDescription>Latest successful generations across all sessions</CardDescription>
            </div>
            <Link href="/gallery" className="text-sm text-brand-forest hover:underline flex items-center gap-1">
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </CardHeader>
          <CardContent>
            {!recentImages?.length ? (
              <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-brand-forest/15 bg-brand-cream/20 text-sm text-brand-slate">
                No generated images yet.
              </div>
            ) : (
              <DashboardImagesGrid images={recentImages as any} userId={user.id} />
            )}
          </CardContent>
        </Card>

        <Card className="animate-fade-in" style={{ animationDelay: '120ms' }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Products Snapshot</CardTitle>
              <CardDescription>Recently added or refreshed product cards</CardDescription>
            </div>
            <Link href="/admin/products" className="text-sm text-brand-forest hover:underline flex items-center gap-1">
              View more <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {(recentProducts || []).slice(0, 4).map((product: any) => (
                <div key={product.id} className="flex gap-3 rounded-xl border border-brand-forest/10 p-3">
                  <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded-lg bg-brand-cream/40">
                    {product.thumbnail_url ? (
                      <Image
                        src={product.thumbnail_url}
                        alt={product.name}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-lg font-serif text-brand-forest/40">
                        {product.name?.charAt(0) || '?'}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-sm font-medium text-brand-forest">{product.name}</p>
                    <p className="mt-1 text-xs text-brand-slate">{product.sub_brand || product.brand}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6 animate-fade-in" style={{ animationDelay: '180ms' }}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Team Inbox</CardTitle>
              <CardDescription>Template proposals from your workspace awaiting review</CardDescription>
            </div>
            <MessageSquarePlus className="h-5 w-5 text-brand-forest" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl bg-brand-cream/40 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-brand-slate">Pending Proposals</p>
              <p className="mt-2 text-3xl font-bold text-brand-forest">{pendingProposalsCount || 0}</p>
              <Link href="/admin/feedback" className="mt-3 inline-flex items-center gap-1 text-sm text-brand-forest hover:underline">
                Open proposals <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="rounded-xl border border-brand-forest/10 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-brand-slate">Latest Proposal</p>
              {latestProposal ? (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">Template Proposal</Badge>
                    <Badge variant="warning">{latestProposal.status}</Badge>
                  </div>
                  <p className="font-medium text-brand-forest">{latestProposal.title}</p>
                  <p className="text-xs text-brand-slate">{formatDate(latestProposal.created_at)}</p>
                </div>
              ) : (
                <p className="mt-3 text-sm text-brand-slate">No pending proposals right now.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
