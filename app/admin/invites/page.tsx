import { redirect } from 'next/navigation';
import { requirePageAdmin } from '@/lib/auth/guards';
import { InvitesManager, type InviteRow } from './invites-manager';

export const dynamic = 'force-dynamic';

export default async function AdminInvitesPage() {
  const { service, workspaceId } = await requirePageAdmin();
  if (!workspaceId) redirect('/dev'); // dev with no acting workspace

  const { data: invites } = await service
    .from('workspace_invites')
    .select('id, email, role, created_at, accepted_at, revoked_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  return (
    <div className="animate-fade-in">
      <div className="mb-6 stagger-item" style={{ animationDelay: '40ms' }}>
        <h1 className="text-2xl font-bold text-brand-forest">Invites</h1>
        <p className="mt-1 text-sm text-brand-slate">
          Invite a teammate by email. They sign up with that address and land in
          this workspace automatically — no email is sent, so share the app link
          yourself.
        </p>
      </div>
      <InvitesManager initialInvites={(invites ?? []) as InviteRow[]} />
    </div>
  );
}
