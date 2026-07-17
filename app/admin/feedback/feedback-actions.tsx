'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface FeedbackActionsProps {
  submissionId: string;
}

const STATUSES = ['pending', 'reviewed', 'implemented', 'rejected'] as const;

export function FeedbackActions({ submissionId }: FeedbackActionsProps) {
  const router = useRouter();
  const [status, setStatus] = useState<(typeof STATUSES)[number]>('reviewed');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    await fetch(`/api/admin/feedback/${submissionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, reviewerNote: note }),
    });
    router.refresh();
    setLoading(false);
  };

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value as (typeof STATUSES)[number])}
        className="h-9 rounded-md border border-brand-forest/20 bg-white px-3 text-sm text-brand-forest"
      >
        {STATUSES.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <Input
        placeholder="Reviewer note (optional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="sm:max-w-sm"
      />
      <Button size="sm" onClick={handleSave} disabled={loading}>
        {loading ? 'Saving...' : 'Save'}
      </Button>
    </div>
  );
}
