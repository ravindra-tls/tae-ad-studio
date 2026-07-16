'use client';

import { Suspense, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { LoadingExperience } from '@/components/LoadingExperience';
import { Breadcrumb } from '@/components/Breadcrumb';
import { SkipForward } from 'lucide-react';

// useSearchParams must live under a Suspense boundary in Next 14 —
// without it the whole route bails out to client-side rendering at build.
function GenerateContent({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const imageId = searchParams.get('imageId');

  const checkStatus = useCallback(async () => {
    if (!imageId) return { status: 'failed' };

    const res = await fetch(`/api/generate/${imageId}/status`);
    const data = await res.json();

    if (data.status === 'completed' || data.status === 'failed' || data.status === 'nsfw') {
      setTimeout(() => {
        router.push(`/session/${sessionId}/results`);
      }, 1000);
    }

    return data;
  }, [imageId, sessionId, router]);

  return (
    <div className="animate-fade-in">

      <Breadcrumb
        crumbs={[
          { label: 'Templates', href: `/session/${sessionId}/prompts` },
          { label: 'Generating…' },
        ]}
        actions={
          <Link
            href={`/session/${sessionId}/results`}
            className="flex items-center gap-1.5 rounded-md border border-brand-sage/30 bg-white px-2.5 py-1 text-xs text-brand-slate transition-colors hover:border-brand-forest/40 hover:text-brand-forest hover:bg-brand-cream"
          >
            <SkipForward className="h-3 w-3" />
            Skip to results
          </Link>
        }
      />

      <LoadingExperience
        estimatedSeconds={30}
        onStatusCheck={checkStatus}
        pollIntervalMs={2500}
      />
    </div>
  );
}

export default function GeneratePage({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={null}>
      <GenerateContent sessionId={params.id} />
    </Suspense>
  );
}
