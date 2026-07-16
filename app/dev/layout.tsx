import { requirePageDev } from '@/lib/auth/guards';
import { AppLayout } from '@/components/AppLayout';

export default async function DevLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requirePageDev();

  return (
    <AppLayout
      fullName={profile.full_name ?? null}
      email={profile.email ?? null}
      isAdmin // devs see the admin nav; the /dev pages add super-admin surfaces
    >
      {children}
    </AppLayout>
  );
}
