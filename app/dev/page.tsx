import { requirePageDev } from '@/lib/auth/guards';
import { WorkspaceManager, type WorkspaceRow } from './workspace-manager';

export const dynamic = 'force-dynamic';

export default async function DevHomePage() {
  const { service, workspaceId } = await requirePageDev();

  const { data: workspaces } = await service
    .from('workspaces')
    .select('id, name, slug, created_at')
    .order('created_at', { ascending: true });

  const { data: members } = await service.from('profiles').select('workspace_id');
  const counts = new Map<string, number>();
  for (const m of members ?? []) {
    if (m.workspace_id) counts.set(m.workspace_id, (counts.get(m.workspace_id) ?? 0) + 1);
  }

  const rows: WorkspaceRow[] = (workspaces ?? []).map((w) => ({
    ...w,
    member_count: counts.get(w.id) ?? 0,
  }));

  return (
    <div className="animate-fade-in">
      <div className="mb-6 stagger-item" style={{ animationDelay: '40ms' }}>
        <h1 className="text-2xl font-bold text-brand-forest">Dev · Workspaces</h1>
        <p className="mt-1 text-sm text-brand-slate">
          You stand outside workspaces. Pick one to <em>act within</em> — the rest
          of the app (products, gallery, brand config, admin tools) then scopes to
          your selection.
        </p>
      </div>
      <WorkspaceManager initialWorkspaces={rows} actingWorkspaceId={workspaceId} />
    </div>
  );
}
