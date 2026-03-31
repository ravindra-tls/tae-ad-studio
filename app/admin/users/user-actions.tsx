'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import type { Profile } from '@/types';

interface UserActionsProps {
  user: Profile;
}

export function UserActions({ user }: UserActionsProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const updateUser = async (updates: Partial<Profile>) => {
    setLoading(true);
    await fetch(`/api/admin/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    router.refresh();
    setLoading(false);
  };

  return (
    <div className="flex items-center justify-end gap-2">
      <select
        value={user.usage_cap}
        onChange={(e) => updateUser({ usage_cap: parseInt(e.target.value) })}
        disabled={loading}
        className="rounded border border-brand-teal/20 px-2 py-1 text-xs"
      >
        {[10, 20, 30, 40, 50, 100].map((cap) => (
          <option key={cap} value={cap}>{cap}/mo</option>
        ))}
      </select>
      <Button
        size="sm"
        variant={user.role === 'admin' ? 'wine' : 'outline'}
        onClick={() => updateUser({ role: user.role === 'admin' ? 'user' : 'admin' })}
        disabled={loading}
      >
        {user.role === 'admin' ? 'Revoke Admin' : 'Make Admin'}
      </Button>
    </div>
  );
}
