'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Profile } from '@/types';

interface UserActionsProps {
  user: Profile;
}

// Sentinel value stored in DB for "no cap"
export const UNLIMITED_CAP = 999999;

const CAP_OPTIONS = [
  { value: 30,            label: '30 / wk' },
  { value: 50,            label: '50 / wk' },
  { value: 100,           label: '100 / wk' },
  { value: 200,           label: '200 / wk' },
  { value: 500,           label: '500 / wk' },
  { value: UNLIMITED_CAP, label: '∞  Unlimited' },
];

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
      <Select
        value={String(user.usage_cap)}
        onValueChange={(val) => updateUser({ usage_cap: parseInt(val) })}
        disabled={loading}
      >
        <SelectTrigger className="w-[130px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {CAP_OPTIONS.map(({ value, label }) => (
            <SelectItem key={value} value={String(value)}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

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
