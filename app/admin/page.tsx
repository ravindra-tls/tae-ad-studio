import { createServiceClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Image, Package, Clock } from 'lucide-react';

export default async function AdminDashboard() {
  const supabase = await createServiceClient();

  const { count: userCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
  const { count: imageCount } = await supabase.from('generated_images').select('*', { count: 'exact', head: true }).eq('status', 'completed');
  const { count: productCount } = await supabase.from('products').select('*', { count: 'exact', head: true });
  const { count: pendingCount } = await supabase.from('context_contributions').select('*', { count: 'exact', head: true }).eq('status', 'pending');

  const stats = [
    { label: 'Total Users', value: userCount || 0, icon: Users, color: 'text-brand-teal' },
    { label: 'Images Generated', value: imageCount || 0, icon: Image, color: 'text-brand-gold' },
    { label: 'Products', value: productCount || 0, icon: Package, color: 'text-green-600' },
    { label: 'Pending Approvals', value: pendingCount || 0, icon: Clock, color: 'text-brand-wine' },
  ];

  return (
    <div className="animate-fade-in">
      <h1 className="mb-8 text-2xl sm:text-3xl font-bold text-brand-teal text-center sm:text-left">Admin Dashboard</h1>
      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="h-full flex flex-col justify-between">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-brand-slate">{label}</CardTitle>
              <Icon className={`h-5 w-5 ${color}`} />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-brand-teal">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
