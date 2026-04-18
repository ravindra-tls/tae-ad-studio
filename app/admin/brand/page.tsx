import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { getBrandConfig } from '@/lib/brand-config';
import { BrandConfigForm } from './brand-config-form';

// Brand config changes are rare but admins expect the edit to reflect immediately.
export const dynamic = 'force-dynamic';

export default async function AdminBrandPage() {
  const config = await getBrandConfig();

  if (!config) {
    return (
      <div className="animate-fade-in">
        <h1 className="mb-6 text-2xl font-bold text-brand-teal">Brand Config</h1>
        <Card>
          <CardContent className="p-6 text-sm text-red-600">
            Brand config row is missing. Run migration 008 to seed id=1.
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
          <BrandConfigForm config={config} />
        </CardContent>
      </Card>
    </div>
  );
}
