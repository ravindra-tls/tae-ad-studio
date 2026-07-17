import { requirePageMember, isAdminRole, isDevRole } from '@/lib/auth/guards';
import { getBadgeCounts } from '@/lib/get-profile';
import { AppLayout } from '@/components/AppLayout';

export default async function SessionLayout({ children }: { children: React.ReactNode }) {
  const { profile, service, workspaceId } = await requirePageMember();
  const badgeCounts = await getBadgeCounts(service, profile.role, workspaceId);

  return (
    <AppLayout
      fullName={profile.full_name ?? null}
      email={profile.email ?? null}
      isAdmin={isAdminRole(profile.role)}
      isDev={isDevRole(profile.role)}
      badgeCounts={badgeCounts}
    >
      {children}
    </AppLayout>
  );
}
