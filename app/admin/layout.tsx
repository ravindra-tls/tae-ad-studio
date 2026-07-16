import { requirePageAdmin } from '@/lib/auth/guards';
import { AppLayout } from '@/components/AppLayout';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requirePageAdmin();

  return (
    <AppLayout
      fullName={ctx.profile.full_name ?? null}
      email={ctx.profile.email ?? null}
      isAdmin={true}
    >
      {children}
    </AppLayout>
  );
}
