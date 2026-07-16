import { requirePageMember, isAdminRole } from '@/lib/auth/guards';
import { AppLayout } from '@/components/AppLayout';

export default async function FeedbackLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requirePageMember();

  return (
    <AppLayout
      fullName={profile.full_name ?? null}
      email={profile.email ?? null}
      isAdmin={isAdminRole(profile.role)}
    >
      {children}
    </AppLayout>
  );
}
