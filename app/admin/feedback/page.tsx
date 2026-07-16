import { redirect } from 'next/navigation';
import { requirePageAdmin } from '@/lib/auth/guards';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FeedbackActions } from './feedback-actions';
import { ApproveProposal } from './approve-proposal';
import { TEMPLATE_CATEGORIES } from '@/lib/templates/create-from-text';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/**
 * Workspace admin queue: TEMPLATE PROPOSALS from this workspace only.
 * General feedback (kind='feedback') routes to the dev inbox at /dev/feedback.
 */
export default async function AdminProposalsPage() {
  const { service, workspaceId } = await requirePageAdmin();
  if (!workspaceId) redirect('/dev');

  const { data: submissions } = await service
    .from('feedback_submissions')
    .select('*, profile:profiles(full_name, email)')
    .eq('kind', 'template_proposal')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  return (
    <div className="animate-fade-in">
      <div className="mb-6 stagger-item" style={{ animationDelay: '40ms' }}>
        <h1 className="text-2xl font-bold text-brand-forest">Template Proposals</h1>
        <p className="mt-1 text-sm text-brand-slate">
          Templates proposed by your workspace. Approving one makes it available to
          this workspace; a dev can later promote it for everyone.
        </p>
      </div>

      {!submissions?.length ? (
        <Card className="stagger-item" style={{ animationDelay: '100ms' }}>
          <CardContent className="py-12 text-center text-brand-slate">
            No template proposals yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {submissions.map((item: any, index: number) => (
            <Card key={item.id} className="stagger-item" style={{ animationDelay: `${100 + index * 60}ms` }}>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-base">{item.title}</CardTitle>
                  <Badge variant="secondary">Template Proposal</Badge>
                  <Badge
                    variant={
                      item.status === 'implemented' || item.status === 'approved'
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
                {item.template_name && (
                  <div className="text-sm text-brand-slate">
                    <span className="font-medium text-brand-forest">Template:</span> {item.template_name}
                    {item.template_category ? ` · ${item.template_category}` : ''}
                  </div>
                )}
                <div className="rounded-lg bg-brand-cream/30 p-4 text-sm text-brand-slate whitespace-pre-wrap">
                  {item.message}
                </div>
                {item.prompt_example && (
                  <div className="rounded-lg border border-brand-forest/10 p-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-slate">Prompt Example</p>
                    <p className="text-sm text-brand-slate whitespace-pre-wrap">{item.prompt_example}</p>
                  </div>
                )}
                {item.reviewer_note && (
                  <p className="text-sm text-brand-forest">
                    <span className="font-medium">Current note:</span> {item.reviewer_note}
                  </p>
                )}
                {item.status !== 'approved' && (
                  <div className="flex flex-col gap-3">
                    {['pending', 'reviewed'].includes(item.status) && (
                      <div>
                        <ApproveProposal
                          proposalId={item.id}
                          proposalTitle={item.title}
                          categories={[...TEMPLATE_CATEGORIES]}
                        />
                      </div>
                    )}
                    <FeedbackActions submissionId={item.id} />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
