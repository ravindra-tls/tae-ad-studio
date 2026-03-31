import { createServiceClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default async function AdminTemplatesPage() {
  const supabase = await createServiceClient();

  const { data: templates } = await supabase
    .from('prompt_templates')
    .select('*')
    .order('number');

  return (
    <div className="animate-fade-in">
      <h1 className="mb-6 text-2xl font-bold text-brand-teal">Prompt Templates</h1>
      <div className="space-y-3">
        {(templates || []).map((t: any) => (
          <Card key={t.id}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-lg font-bold text-brand-teal">#{t.number}</span>
                <span className="font-semibold text-brand-teal">{t.name}</span>
                <Badge variant="secondary">{t.category}</Badge>
                <Badge variant="outline" className="ml-auto">{t.default_aspect_ratio}</Badge>
                <Badge variant="outline">v{t.version}</Badge>
              </div>
              <p className="text-sm text-gray-500 line-clamp-3 font-mono">{t.template}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
