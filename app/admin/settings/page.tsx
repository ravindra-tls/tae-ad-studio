import { redirect } from 'next/navigation';
import { requirePageUser, isDevRole } from '@/lib/auth/guards';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default async function AdminSettingsPage() {
  // Environment/settings are app-global → dev-only.
  const ctx = await requirePageUser();
  if (!isDevRole(ctx.profile.role)) redirect('/admin');
  return (
    <div className="animate-fade-in">
      <h1 className="mb-6 text-2xl font-bold text-brand-forest">Settings</h1>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Image Generation API</CardTitle>
            <CardDescription>Vertex AI configuration for Gemini image generation</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-brand-forest">Google Cloud Project</label>
              <div className="rounded-md bg-brand-cream px-3 py-2 text-sm font-mono text-brand-forest">
                {process.env.GOOGLE_CLOUD_PROJECT || process.env.VERTEX_AI_PROJECT_ID || 'Not configured'}
              </div>
              <p className="mt-1 text-xs text-gray-400">Managed via environment variables and Google Cloud credentials.</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-brand-forest">Location</label>
              <div className="rounded-md bg-brand-cream px-3 py-2 text-sm font-mono text-brand-forest">
                {process.env.GOOGLE_CLOUD_LOCATION || process.env.VERTEX_AI_LOCATION || 'global'}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-brand-forest">Active Model</label>
              <div className="flex items-center gap-2">
                <code className="rounded bg-brand-cream px-2 py-1 text-sm">
                  {process.env.VERTEX_AI_MODEL_ID || 'gemini-3-pro-image-preview'}
                </code>
                <Badge variant="success">Active</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Allowed Email Domains</CardTitle>
            <CardDescription>Only users with these email domains can sign up</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              {(process.env.ALLOWED_EMAIL_DOMAINS || 'transformative.in,theayurvedaexperience.com')
                .split(',')
                .map((domain) => (
                  <Badge key={domain} variant="outline">@{domain}</Badge>
                ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Default Usage Cap</CardTitle>
            <CardDescription>New users receive this many image generations per week</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-brand-forest">
              {process.env.DEFAULT_USAGE_CAP || '30'} <span className="text-sm font-normal text-gray-400">images/week</span>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
