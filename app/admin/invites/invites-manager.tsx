'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDate } from '@/lib/utils';

export interface InviteRow {
  id: string;
  email: string;
  role: 'user' | 'admin';
  created_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
}

function stateOf(inv: InviteRow): { label: string; variant: 'success' | 'secondary' | 'outline' } {
  if (inv.accepted_at) return { label: 'Accepted', variant: 'success' };
  if (inv.revoked_at) return { label: 'Revoked', variant: 'outline' };
  return { label: 'Pending', variant: 'secondary' };
}

export function InvitesManager({ initialInvites }: { initialInvites: InviteRow[] }) {
  const [invites, setInvites] = useState<InviteRow[]>(initialInvites);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'user' | 'admin'>('user');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setNotice(''); setBusy(true);
    try {
      const res = await fetch('/api/admin/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Failed to invite'); return; }
      if (data.attached) {
        setNotice(`${data.email} already had an account and was added to this workspace.`);
      } else {
        setInvites((prev) => [data as InviteRow, ...prev]);
        setNotice(`Invited ${data.email}. Share the app link — they'll be let in on sign-up.`);
      }
      setEmail('');
    } catch {
      setError('Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (id: string) => {
    const res = await fetch(`/api/admin/invites/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setInvites((prev) => prev.map((i) => (i.id === id ? { ...i, revoked_at: new Date().toISOString() } : i)));
    }
  };

  return (
    <div className="space-y-6">
      <Card className="stagger-item" style={{ animationDelay: '80ms' }}>
        <CardContent className="p-5">
          <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
            <div className="min-w-[240px] flex-1">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-brand-slate">Email</label>
              <Input
                type="email"
                placeholder="teammate@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="w-36">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-brand-slate">Role</label>
              <Select value={role} onValueChange={(v) => setRole(v as 'user' | 'admin')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Member</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={busy} data-glow>
              {busy ? 'Inviting…' : 'Send invite'}
            </Button>
          </form>
          {error && <p className="mt-3 rounded-md bg-brand-wine/10 px-3 py-2 text-sm text-brand-wine">{error}</p>}
          {notice && <p className="mt-3 rounded-md bg-brand-forest/8 px-3 py-2 text-sm text-brand-forest">{notice}</p>}
        </CardContent>
      </Card>

      <Card className="stagger-item" style={{ animationDelay: '140ms' }}>
        <CardContent className="p-0">
          {invites.length === 0 ? (
            <div className="rounded-2xl border-dashed border-brand-sage/30 bg-brand-cream/30 py-16 text-center text-sm text-brand-slate/60">
              No invites yet. Invite your first teammate above.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-brand-sage/15 bg-brand-cream/30">
                    <th className="px-4 py-3 text-left font-medium text-brand-slate">Email</th>
                    <th className="px-4 py-3 text-left font-medium text-brand-slate">Role</th>
                    <th className="px-4 py-3 text-left font-medium text-brand-slate">Status</th>
                    <th className="px-4 py-3 text-left font-medium text-brand-slate">Invited</th>
                    <th className="px-4 py-3 text-right font-medium text-brand-slate">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invites.map((inv, i) => {
                    const st = stateOf(inv);
                    const live = !inv.accepted_at && !inv.revoked_at;
                    return (
                      <tr key={inv.id} className="stagger-item border-b border-brand-sage/10" style={{ animationDelay: `${i * 40}ms` }}>
                        <td className="px-4 py-3 text-brand-forest">{inv.email}</td>
                        <td className="px-4 py-3 capitalize text-brand-slate">{inv.role === 'admin' ? 'Admin' : 'Member'}</td>
                        <td className="px-4 py-3"><Badge variant={st.variant}>{st.label}</Badge></td>
                        <td className="px-4 py-3 text-brand-slate/70">{formatDate(inv.created_at)}</td>
                        <td className="px-4 py-3 text-right">
                          {live && (
                            <button
                              onClick={() => revoke(inv.id)}
                              className="text-xs font-medium text-brand-wine hover:underline"
                            >
                              Revoke
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
