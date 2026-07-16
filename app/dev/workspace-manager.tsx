'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Check } from 'lucide-react';

export interface WorkspaceRow {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  member_count: number;
}

export function WorkspaceManager({
  initialWorkspaces,
  actingWorkspaceId,
}: {
  initialWorkspaces: WorkspaceRow[];
  actingWorkspaceId: string | null;
}) {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState(initialWorkspaces);
  const [acting, setActing] = useState<string | null>(actingWorkspaceId);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const setActingWorkspace = async (workspaceId: string | null) => {
    setError('');
    const res = await fetch('/api/dev/acting-workspace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId }),
    });
    if (res.ok) {
      setActing(workspaceId);
      router.refresh(); // re-resolve server components against the new cookie
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? 'Failed to switch workspace');
    }
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      const res = await fetch('/api/dev/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, slug }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Failed to create workspace'); return; }
      setWorkspaces((prev) => [...prev, data as WorkspaceRow]);
      setName(''); setSlug('');
    } catch {
      setError('Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {error && <p className="rounded-md bg-brand-wine/10 px-3 py-2 text-sm text-brand-wine">{error}</p>}

      <Card className="stagger-item" style={{ animationDelay: '80ms' }}>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-sage/15 bg-brand-cream/30">
                  <th className="px-4 py-3 text-left font-medium text-brand-slate">Workspace</th>
                  <th className="px-4 py-3 text-left font-medium text-brand-slate">Slug</th>
                  <th className="px-4 py-3 text-left font-medium text-brand-slate">Members</th>
                  <th className="px-4 py-3 text-right font-medium text-brand-slate">Acting</th>
                </tr>
              </thead>
              <tbody>
                {workspaces.map((w, i) => (
                  <tr key={w.id} className="stagger-item border-b border-brand-sage/10" style={{ animationDelay: `${i * 40}ms` }}>
                    <td className="px-4 py-3 font-medium text-brand-forest">{w.name}</td>
                    <td className="px-4 py-3 text-brand-slate/70">{w.slug}</td>
                    <td className="px-4 py-3 text-brand-slate">{w.member_count}</td>
                    <td className="px-4 py-3 text-right">
                      {acting === w.id ? (
                        <Badge variant="success" className="inline-flex items-center gap-1">
                          <Check className="h-3 w-3" /> Acting
                        </Badge>
                      ) : (
                        <button
                          onClick={() => setActingWorkspace(w.id)}
                          className="text-xs font-medium text-brand-forest hover:underline"
                        >
                          Act as this
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="stagger-item" style={{ animationDelay: '140ms' }}>
        <CardContent className="p-5">
          <h2 className="mb-3 text-sm font-semibold text-brand-forest">Create a workspace</h2>
          <form onSubmit={create} className="flex flex-wrap items-end gap-3">
            <div className="min-w-[200px] flex-1">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-brand-slate">Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Skincare" required />
            </div>
            <div className="w-44">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-brand-slate">Slug</label>
              <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="acme" required />
            </div>
            <Button type="submit" disabled={busy} data-glow>{busy ? 'Creating…' : 'Create'}</Button>
          </form>
          <p className="mt-2 text-xs text-brand-slate/60">
            A fresh brand config is seeded automatically. Invite an admin from that
            workspace&apos;s Invites page after switching into it.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
