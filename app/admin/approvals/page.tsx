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
      <div className="mb-6 stagger-item" style={{ animationDelay: '40ms' }}>
        <h1 className="text-2xl font-bold text-brand-teal">Pending Approvals</h1>
      </div>
      {!contributions?.length ? (
        <Card className="stagger-item" style={{ animationDelay: '100ms' }}>
          <CardContent className="py-12 text-center text-brand-slate">
            No pending contributions. All clear!
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {contributions.map((item: any, index: number) => (
            <Card key={item.id} className="stagger-item" style={{ animationDelay: `${100 + index * 60}ms` }}>
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
