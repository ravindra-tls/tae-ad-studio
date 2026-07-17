import { requirePageMember } from '@/lib/auth/guards';
import { FeedbackWorkspace } from './feedback-workspace';

export default async function FeedbackPage() {
  // Cached guard — layout already resolved auth this request.
  const { user, service: serviceClient } = await requirePageMember();

  const { data: submissions } = await serviceClient
    .from('feedback_submissions')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10);

  return <FeedbackWorkspace submissions={submissions || []} />;
}
