'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import type { FeatureFlag } from '@/types';

/** Form for creating a brand-new flag. Used at the top of the admin page. */
export function NewFlagForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = async () => {
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Name required');
      return;
    }

    startTransition(async () => {
      const res = await fetch('/api/admin/feature-flags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmed,
          description: description.trim() || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? 'Failed to create flag');
        return;
      }
      setName('');
      setDescription('');
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-end">
      <div className="flex-1">
        <label className="mb-1 block text-xs font-medium text-brand-slate">
          Flag name (snake_case)
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. brief_first_ui"
          disabled={pending}
          className="w-full rounded border border-brand-forest/20 px-3 py-2 text-sm focus:border-brand-forest focus:outline-none"
        />
      </div>
      <div className="flex-1">
        <label className="mb-1 block text-xs font-medium text-brand-slate">
          Description (optional)
        </label>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What does this flag gate?"
          disabled={pending}
          className="w-full rounded border border-brand-forest/20 px-3 py-2 text-sm focus:border-brand-forest focus:outline-none"
        />
      </div>
      <Button onClick={submit} disabled={pending}>
        {pending ? 'Creating…' : 'Create flag'}
      </Button>
      {error && (
        <p className="text-xs text-red-600 md:ml-2 md:self-center">{error}</p>
      )}
    </div>
  );
}

interface FeatureFlagRowProps {
  flag: FeatureFlag;
  emailsById: Record<string, string>;
}

/** Per-flag admin row: toggle enabled, set rollout %, manage allowlist, delete. */
export function FeatureFlagRow({ flag, emailsById }: FeatureFlagRowProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [percentInput, setPercentInput] = useState(String(flag.rollout_percentage));
  const [emailInput, setEmailInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const patch = (body: Record<string, unknown>) => {
    setError(null);
    startTransition(async () => {
      const res = await fetch(
        `/api/admin/feature-flags/${encodeURIComponent(flag.name)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setError(b.error ?? 'Update failed');
        return;
      }
      router.refresh();
    });
  };

  const toggleEnabled = () => patch({ enabled: !flag.enabled });

  const savePercent = () => {
    const n = parseInt(percentInput, 10);
    if (Number.isNaN(n) || n < 0 || n > 100) {
      setError('Rollout % must be 0-100');
      return;
    }
    patch({ rollout_percentage: n });
  };

  const addUser = () => {
    const email = emailInput.trim();
    if (!email) return;
    patch({ add_user_email: email });
    setEmailInput('');
  };

  const removeUser = (id: string) => patch({ remove_user_id: id });

  const deleteFlag = () => {
    if (!confirm(`Delete flag "${flag.name}"? This cannot be undone.`)) return;
    setError(null);
    startTransition(async () => {
      const res = await fetch(
        `/api/admin/feature-flags/${encodeURIComponent(flag.name)}`,
        { method: 'DELETE' },
      );
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setError(b.error ?? 'Delete failed');
        return;
      }
      router.refresh();
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 font-mono text-base">
            {flag.name}
            <Badge variant={flag.enabled ? 'success' : 'secondary'}>
              {flag.enabled ? 'enabled' : 'disabled'}
            </Badge>
          </CardTitle>
          {flag.description && (
            <p className="mt-1 text-sm text-brand-slate/70">{flag.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={flag.enabled ? 'outline' : 'default'}
            onClick={toggleEnabled}
            disabled={pending}
          >
            {flag.enabled ? 'Disable' : 'Enable'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={deleteFlag}
            disabled={pending}
            className="text-red-600 hover:bg-red-50"
          >
            Delete
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Rollout percentage */}
        <div>
          <label className="mb-1 block text-xs font-medium text-brand-slate">
            Rollout percentage
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={percentInput}
              onChange={(e) => setPercentInput(e.target.value)}
              disabled={pending}
              className="flex-1 accent-brand-forest"
            />
            <input
              type="number"
              min={0}
              max={100}
              value={percentInput}
              onChange={(e) => setPercentInput(e.target.value)}
              disabled={pending}
              className="w-20 rounded border border-brand-forest/20 px-2 py-1 text-sm"
            />
            <span className="text-sm text-brand-slate/60">%</span>
            <Button
              size="sm"
              variant="outline"
              onClick={savePercent}
              disabled={pending || percentInput === String(flag.rollout_percentage)}
            >
              Save
            </Button>
          </div>
          <p className="mt-1 text-xs text-brand-slate/50">
            Users deterministically bucket to 0-99 via SHA-256(user_id:flag_name).
            Ramping this up never re-randomizes assignments.
          </p>
        </div>

        {/* Allowlist */}
        <div>
          <label className="mb-1 block text-xs font-medium text-brand-slate">
            Allowlist (always enabled, overrides bucketing)
          </label>
          <div className="mb-2 flex gap-2">
            <input
              type="email"
              placeholder="user@example.com"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              disabled={pending}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addUser();
                }
              }}
              className="flex-1 rounded border border-brand-forest/20 px-3 py-1.5 text-sm focus:border-brand-forest focus:outline-none"
            />
            <Button size="sm" variant="outline" onClick={addUser} disabled={pending}>
              Add
            </Button>
          </div>
          {flag.allowed_user_ids.length === 0 ? (
            <p className="text-xs text-brand-slate/50">No users in allowlist.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {flag.allowed_user_ids.map((id) => (
                <span
                  key={id}
                  className="inline-flex items-center gap-1 rounded-full border border-brand-forest/20 bg-brand-cream/40 px-2 py-0.5 text-xs text-brand-forest"
                >
                  {emailsById[id] ?? id.slice(0, 8) + '…'}
                  <button
                    type="button"
                    onClick={() => removeUser(id)}
                    disabled={pending}
                    className="rounded-full p-0.5 hover:bg-brand-forest/10"
                    aria-label="Remove"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {error && (
          <p className="rounded bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
        )}

        <p className="text-xs text-brand-slate/40">
          Last updated {new Date(flag.updated_at).toLocaleString()}
        </p>
      </CardContent>
    </Card>
  );
}
