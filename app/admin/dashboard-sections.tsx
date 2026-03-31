import Link from 'next/link';
import Image from 'next/image';
import { createServiceClient } from '@/lib/supabase/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';
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
      accent: 'text-brand-gold',
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
                <p className="mt-2 text-4xl font-bold text-brand-teal">{value}</p>
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
  const supabase = await createServiceClient();

  const [
    { data: recentImages },
    { data: recentProducts },
    { count: pendingApprovalsCount },
    { count: pendingFeedbackCount },
    { data: latestFeedback },
  ] = await Promise.all([
    supabase
      .from('generated_images')
      .select('id, image_url, prompt_used, aspect_ratio, created_at')
      .eq('status', 'completed')
      .not('image_url', 'is', null)
      .order('created_at', { ascending: false })
      .limit(8),
    supabase
      .from('products')
      .select('id, name, brand, sub_brand, thumbnail_url')
      .order('created_at', { ascending: false })
      .limit(6),
    supabase.from('context_contributions').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('feedback_submissions').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase
      .from('feedback_submissions')
      .select('id, kind, title, status, created_at')
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
            <Link href="/admin/images" className="text-sm text-brand-teal hover:underline flex items-center gap-1">
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </CardHeader>
          <CardContent>
            {!recentImages?.length ? (
              <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-brand-teal/15 bg-brand-cream/20 text-sm text-brand-slate">
                No generated images yet.
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {recentImages.slice(0, 6).map((image: any) => (
                  <div key={image.id} className="group overflow-hidden rounded-xl border border-brand-teal/10 bg-white">
                    <div className="relative aspect-[4/5] bg-brand-cream/30">
                      <Image
                        src={image.image_url}
                        alt="Generated ad image"
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                    </div>
                    <div className="space-y-2 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="outline">{image.aspect_ratio}</Badge>
                        <span className="text-xs text-brand-slate">{formatDate(image.created_at)}</span>
                      </div>
                      <p className="line-clamp-2 text-sm text-brand-slate">{image.prompt_used}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="animate-fade-in" style={{ animationDelay: '120ms' }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Products Snapshot</CardTitle>
              <CardDescription>Recently added or refreshed product cards</CardDescription>
            </div>
            <Link href="/admin/products" className="text-sm text-brand-teal hover:underline flex items-center gap-1">
              View more <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {(recentProducts || []).slice(0, 4).map((product: any) => (
                <div key={product.id} className="flex gap-3 rounded-xl border border-brand-teal/10 p-3">
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
              <CardDescription>Consolidated review queue for feedback and approvals</CardDescription>
            </div>
            <MessageSquarePlus className="h-5 w-5 text-brand-forest" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-xl bg-brand-cream/40 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-brand-slate">Pending Feedback</p>
                <p className="mt-2 text-3xl font-bold text-brand-teal">{pendingFeedbackCount || 0}</p>
                <Link href="/admin/feedback" className="mt-3 inline-flex items-center gap-1 text-sm text-brand-teal hover:underline">
                  Open feedback <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              <div className="rounded-xl bg-brand-cream/40 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-brand-slate">Pending Approvals</p>
                <p className="mt-2 text-3xl font-bold text-brand-teal">{pendingApprovalsCount || 0}</p>
                <Link href="/admin/approvals" className="mt-3 inline-flex items-center gap-1 text-sm text-brand-teal hover:underline">
                  Open approvals <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>

            <div className="rounded-xl border border-brand-teal/10 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-brand-slate">Latest Feedback Item</p>
              {latestFeedback ? (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={latestFeedback.kind === 'feedback' ? 'outline' : 'secondary'}>
                      {latestFeedback.kind === 'feedback' ? 'Feedback' : 'Template Proposal'}
                    </Badge>
                    <Badge variant="warning">{latestFeedback.status}</Badge>
                  </div>
                  <p className="font-medium text-brand-forest">{latestFeedback.title}</p>
                  <p className="text-xs text-brand-slate">{formatDate(latestFeedback.created_at)}</p>
                </div>
              ) : (
                <p className="mt-3 text-sm text-brand-slate">No pending feedback right now.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
