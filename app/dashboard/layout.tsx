import { getProfile } from '@/lib/get-profile';
import { AppLayout } from '@/components/AppLayout';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();

  return (
    <AppLayout
      fullName={profile?.full_name ?? null}
      email={profile?.email ?? null}
      isAdmin={profile?.role === 'admin'}
    >
      {children}
    </AppLayout>
  );
}
