import { requirePageDev } from '@/lib/auth/guards';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FeedbackActions } from '@/app/admin/feedback/feedback-actions';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/**
 * Dev inbox: GENERAL feedback (kind='feedback') from every workspace.
 * Template proposals route to each workspace's admin queue instead.
 */
export default async function DevFeedbackPage() {
  const { service } = await requirePageDev();

  const { data: submissions } = await service
    .from('feedback_submissions')
    .select('*, profile:profiles(full_name, email), workspace:workspaces(name, slug)')
    .eq('kind', 'feedback')
    .order('created_at', { ascending: false });

  return (
    <div className="animate-fade-in">
      <div className="mb-6 stagger-item" style={{ animationDelay: '40ms' }}>
        <h1 className="text-2xl font-bold text-brand-forest">Dev · Feedback Inbox</h1>
        <p className="mt-1 text-sm text-brand-slate">
          General product feedback from all workspaces. Template proposals go to
          each workspace&apos;s admin instead.
        </p>
      </div>

      {!submissions?.length ? (
        <Card className="stagger-item" style={{ animationDelay: '100ms' }}>
          <CardContent className="py-12 text-center text-brand-slate">
            No feedback yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {submissions.map((item: any, index: number) => (
            <Card key={item.id} className="stagger-item" style={{ animationDelay: `${100 + index * 60}ms` }}>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-base">{item.title}</CardTitle>
                  {item.workspace?.name && <Badge variant="outline">{item.workspace.name}</Badge>}
                  <Badge
                    variant={
                      item.status === 'implemented'
                        ? 'success'
                        : item.status === 'rejected'
                        ? 'destructive'
                        : item.status === 'reviewed'
                        ? 'warning'
                        : 'outline'
                    }
                  >
                    {item.status}
                  </Badge>
                  <span className="ml-auto text-xs text-brand-slate">{formatDate(item.created_at)}</span>
                </div>
                <p className="text-sm text-brand-slate">
                  {item.profile?.full_name || item.profile?.email}
                  {item.profile?.email ? ` · ${item.profile.email}` : ''}
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg bg-brand-cream/30 p-4 text-sm text-brand-slate whitespace-pre-wrap">
                  {item.message}
                </div>
                {item.reviewer_note && (
                  <p className="text-sm text-brand-forest">
                    <span className="font-medium">Current note:</span> {item.reviewer_note}
                  </p>
                )}
                <FeedbackActions submissionId={item.id} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
