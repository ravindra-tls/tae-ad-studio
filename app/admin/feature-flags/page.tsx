import { redirect } from 'next/navigation';
import { requirePageUser, isDevRole } from '@/lib/auth/guards';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { NewFlagForm, FeatureFlagRow } from './feature-flag-row';
import type { FeatureFlag, Profile } from '@/types';

// Flags can change anytime via admin PATCH — never cache this page.
export const dynamic = 'force-dynamic';

export default async function AdminFeatureFlagsPage() {
  // Feature flags are app-global → dev-only.
  const ctx = await requirePageUser();
  if (!isDevRole(ctx.profile.role)) redirect('/admin');
  const supabase = ctx.service;

  const { data: flagsData } = await supabase
    .from('feature_flags')
    .select('*')
    .order('name');

  const flags = (flagsData ?? []) as FeatureFlag[];

  // Fetch every profile in the allowlist across all flags so the row can
  // render emails instead of raw uuids. Small table, so one query is fine.
  const allUserIds = Array.from(
    new Set(flags.flatMap((f) => f.allowed_user_ids ?? [])),
  );

  const emailsById: Record<string, string> = {};
  if (allUserIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email')
      .in('id', allUserIds);

    for (const p of (profiles ?? []) as Pick<Profile, 'id' | 'email'>[]) {
      emailsById[p.id] = p.email;
    }
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-6 stagger-item" style={{ animationDelay: '40ms' }}>
        <h1 className="text-2xl font-bold text-brand-forest">Feature Flags</h1>
        <p className="mt-1 text-sm text-brand-slate/70">
          Control staged rollout of in-progress features. A flag is enabled for a user iff
          the flag is <code className="rounded bg-brand-cream px-1">enabled</code> AND
          (user is in the allowlist OR the user hashes into the rollout percentage).
        </p>
      </div>

      <Card className="mb-6 stagger-item" style={{ animationDelay: '100ms' }}>
        <CardHeader>
          <CardTitle className="text-base">Create a new flag</CardTitle>
        </CardHeader>
        <CardContent>
          <NewFlagForm />
        </CardContent>
      </Card>

      <div className="space-y-4">
        {flags.length === 0 ? (
          <Card className="stagger-item" style={{ animationDelay: '140ms' }}>
            <CardContent className="p-6 text-sm text-brand-slate/60">
              No flags yet — create one above.
            </CardContent>
          </Card>
        ) : (
          flags.map((flag, i) => (
            <div
              key={flag.name}
              className="stagger-item"
              style={{ animationDelay: `${140 + i * 45}ms` }}
            >
              <FeatureFlagRow flag={flag} emailsById={emailsById} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
