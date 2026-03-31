import { getProfile } from '@/lib/get-profile';
import { AppLayout } from '@/components/AppLayout';
import { redirect } from 'next/navigation';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();

  if (profile?.role !== 'admin') redirect('/dashboard');

  return (
    <AppLayout
      fullName={profile?.full_name ?? null}
      email={profile?.email ?? null}
      isAdmin={true}
    >
      {children}
    </AppLayout>
  );
}
