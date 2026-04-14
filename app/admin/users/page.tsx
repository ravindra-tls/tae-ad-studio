import { createServiceClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';
import { UserActions } from './user-actions';

// Always fetch live data — usage_count changes on every generation
export const dynamic = 'force-dynamic';

export default async function AdminUsersPage() {
  const supabase = await createServiceClient();

  const { data: users } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  return (
    <div className="animate-fade-in">
      <div className="mb-6 stagger-item" style={{ animationDelay: '40ms' }}>
        <h1 className="text-2xl font-bold text-brand-teal">User Management</h1>
      </div>
      <Card className="stagger-item" style={{ animationDelay: '100ms' }}>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-teal/10 bg-brand-cream/30">
                  <th className="px-4 py-3 text-left font-medium text-brand-slate">User</th>
                  <th className="px-4 py-3 text-left font-medium text-brand-slate">Role</th>
                  <th className="px-4 py-3 text-left font-medium text-brand-slate">Usage</th>
                  <th className="px-4 py-3 text-left font-medium text-brand-slate">Joined</th>
                  <th className="px-4 py-3 text-right font-medium text-brand-slate">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(users || []).map((user, index: number) => (
                  <tr
                    key={user.id}
                    className="stagger-item border-b border-brand-teal/5 hover:bg-brand-cream/20"
                    style={{ animationDelay: `${140 + index * 45}ms` }}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-brand-teal">{user.full_name || 'Unnamed'}</p>
                      <p className="text-xs text-gray-400">{user.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={user.role === 'admin' ? 'wine' : 'secondary'}>
                        {user.role}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium">{user.usage_count}</span>
                      <span className="text-gray-400">/{user.usage_cap}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-400">{formatDate(user.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <UserActions user={user} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
