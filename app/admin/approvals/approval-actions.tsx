'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Check, X } from 'lucide-react';

interface ApprovalActionsProps {
  contributionId: string;
}

export function ApprovalActions({ contributionId }: ApprovalActionsProps) {
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleAction = async (status: 'approved' | 'rejected') => {
    setLoading(true);
    await fetch(`/api/admin/contributions/${contributionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, reviewerNote: note }),
    });
    router.refresh();
    setLoading(false);
  };

  return (
    <div className="flex items-center gap-2">
      <Input
        placeholder="Reviewer note (optional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="flex-1 text-sm"
      />
      <Button size="sm" onClick={() => handleAction('approved')} disabled={loading} className="bg-green-600 hover:bg-green-700">
        <Check className="mr-1 h-3.5 w-3.5" /> Approve
      </Button>
      <Button size="sm" variant="destructive" onClick={() => handleAction('rejected')} disabled={loading}>
        <X className="mr-1 h-3.5 w-3.5" /> Reject
      </Button>
    </div>
  );
}
