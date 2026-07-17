import { requirePageDev } from '@/lib/auth/guards';
import { getBadgeCounts } from '@/lib/get-profile';
import { AppLayout } from '@/components/AppLayout';

export default async function DevLayout({ children }: { children: React.ReactNode }) {
  const { profile, service, workspaceId } = await requirePageDev();
  const badgeCounts = await getBadgeCounts(service, profile.role, workspaceId);

  return (
    <AppLayout
      fullName={profile.full_name ?? null}
      email={profile.email ?? null}
      isAdmin // devs see the admin nav; the /dev pages add super-admin surfaces
      isDev
      badgeCounts={badgeCounts}
    >
      {children}
    </AppLayout>
  );
}
