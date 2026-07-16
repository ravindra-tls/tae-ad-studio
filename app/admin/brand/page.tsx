import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { getBrandConfigStrict } from '@/lib/brand-config';
import { requirePageAdmin } from '@/lib/auth/guards';
import { BrandConfigForm } from './brand-config-form';

// Brand config changes are rare but admins expect the edit to reflect immediately.
export const dynamic = 'force-dynamic';

export default async function AdminBrandPage() {
  const { workspaceId } = await requirePageAdmin();
  if (!workspaceId) redirect('/dev'); // dev without an acting workspace
  const result = await getBrandConfigStrict(workspaceId);

  if (!result.ok) {
    const copy =
      result.reason === 'table_missing'
        ? {
            title: 'brand_config table is missing',
            body:
              'Migration 008 has not been applied to this database. Run ' +
              'supabase/run_v1_phase1_in_dashboard.sql in the Supabase SQL editor to create ' +
              'the V1 Phase 1 tables (feature_flags, brand_config, product_images columns).',
          }
        : result.reason === 'row_missing'
          ? {
              title: 'brand_config row is missing',
              body:
                'The table exists but has no id=1 row. Re-run the seed section of ' +
                'migration 008 (or the full dashboard bundle) — it uses ON CONFLICT DO NOTHING so ' +
                'it is safe to apply twice.',
            }
          : {
              title: 'Could not load brand config',
              body: result.message,
            };

    return (
      <div className="animate-fade-in">
        <h1 className="mb-6 text-2xl font-bold text-brand-teal">Brand Config</h1>
        <Card>
          <CardContent className="p-6 text-sm text-red-700">
            <p className="font-semibold">{copy.title}</p>
            <p className="mt-2 text-red-700/80">{copy.body}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-6 stagger-item" style={{ animationDelay: '40ms' }}>
        <h1 className="text-2xl font-bold text-brand-teal">Brand Config</h1>
        <p className="mt-1 text-sm text-brand-slate/70">
          Voice, visual system, and non-negotiables that the pipeline pulls into every
          brief, concept, copy, and critique prompt. Single-tenant — one row for the
          whole app.
        </p>
      </div>

      <Card className="stagger-item" style={{ animationDelay: '100ms' }}>
        <CardHeader>
          <CardTitle className="text-lg">Edit brand config</CardTitle>
          <CardDescription>
            Voice and visual schemas aren&apos;t locked yet — use free-form JSON while
            we learn what Claude needs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BrandConfigForm config={result.config} />
        </CardContent>
      </Card>
    </div>
  );
}
