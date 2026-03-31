import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function AdminSettingsPage() {
  return (
    <div className="animate-fade-in">
      <h1 className="mb-6 text-2xl font-bold text-brand-teal">Settings</h1>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Image Generation API</CardTitle>
            <CardDescription>Higgsfield API credentials and model configuration</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-brand-teal">API Key</label>
              <div className="rounded-md bg-gray-50 px-3 py-2 text-sm font-mono text-gray-400">
                ••••••••••••••••
              </div>
              <p className="mt-1 text-xs text-gray-400">Managed via environment variables. Update in Vercel dashboard.</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-brand-teal">API Secret</label>
              <div className="rounded-md bg-gray-50 px-3 py-2 text-sm font-mono text-gray-400">
                ••••••••••••••••
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-brand-teal">Active Model</label>
              <div className="flex items-center gap-2">
                <code className="rounded bg-brand-cream px-2 py-1 text-sm">
                  {process.env.HIGGSFIELD_MODEL_ID || 'higgsfield-ai/soul/standard'}
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
            <CardDescription>New users receive this many image generations per month</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-brand-teal">
              {process.env.DEFAULT_USAGE_CAP || '30'} <span className="text-sm font-normal text-gray-400">images/month</span>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
