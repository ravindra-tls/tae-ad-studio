import { createServiceClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ApprovalActions } from './approval-actions';

export default async function ApprovalsPage() {
  const supabase = await createServiceClient();

  const { data: contributions } = await supabase
    .from('context_contributions')
    .select('*, profile:profiles(full_name, email), product:products(name)')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  return (
    <div className="animate-fade-in">
      <h1 className="mb-6 text-2xl font-bold text-brand-teal">Pending Approvals</h1>
      {!contributions?.length ? (
        <Card>
          <CardContent className="py-12 text-center text-brand-slate">
            No pending contributions. All clear!
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {contributions.map((item: any) => (
            <Card key={item.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-medium text-brand-teal">{item.profile?.full_name || item.profile?.email}</p>
                    <p className="text-sm text-brand-slate">
                      Product: <strong>{item.product?.name}</strong> — Type: <Badge variant="outline" className="ml-1">{item.content_type}</Badge>
                    </p>
                  </div>
                </div>
                <div className="rounded-md bg-brand-cream/30 p-3 text-sm mb-3">
                  {item.content}
                </div>
                <ApprovalActions contributionId={item.id} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
