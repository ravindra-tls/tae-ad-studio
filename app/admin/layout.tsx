import { requirePageAdmin, isDevRole } from '@/lib/auth/guards';
import { getBadgeCounts } from '@/lib/get-profile';
import { AppLayout } from '@/components/AppLayout';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requirePageAdmin();
  const badgeCounts = await getBadgeCounts(ctx.service, ctx.profile.role, ctx.workspaceId);

  return (
    <AppLayout
      fullName={ctx.profile.full_name ?? null}
      email={ctx.profile.email ?? null}
      isAdmin={true}
      isDev={isDevRole(ctx.profile.role)}
      badgeCounts={badgeCounts}
    >
      {children}
    </AppLayout>
  );
}
