import { createServiceClient } from '@/lib/supabase/server';
import { TemplateCard } from './template-card';
import type { PromptTemplate } from '@/types';

// Always fetch live data — template content and image counts change frequently
export const dynamic = 'force-dynamic';

interface TemplateImage {
  id: string;
  image_url: string;
  aspect_ratio: string;
  prompt_used: string;
  created_at: string;
  template_id: string;
}

export default async function AdminTemplatesPage() {
  const supabase = await createServiceClient();

  // 1. Fetch all templates ordered by number
  const { data: templates } = await supabase
    .from('prompt_templates')
    .select('*')
    .order('number');

  const templateList = (templates || []) as PromptTemplate[];

  // 2. Fetch all completed images that have a template_id (one query, group in JS)
  //    We only need the most recent ones plus a count per template.
  const templateIds = templateList.map((t) => t.id);

  let imagesByTemplate: Record<string, TemplateImage[]> = {};
  let countByTemplate:  Record<string, number>          = {};

  if (templateIds.length > 0) {
    const { data: images } = await supabase
      .from('generated_images')
      .select('id, image_url, aspect_ratio, prompt_used, created_at, template_id')
      .in('template_id', templateIds)
      .eq('status', 'completed')
      .not('image_url', 'is', null)
      .order('created_at', { ascending: false });

    for (const img of (images || []) as TemplateImage[]) {
      if (!img.template_id) continue;
      if (!imagesByTemplate[img.template_id]) imagesByTemplate[img.template_id] = [];
      imagesByTemplate[img.template_id].push(img);
    }

    // Count per template
    for (const [tid, imgs] of Object.entries(imagesByTemplate)) {
      countByTemplate[tid] = imgs.length;
    }
  }

  const totalImages = Object.values(countByTemplate).reduce((a, b) => a + b, 0);

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-6 stagger-item" style={{ animationDelay: '40ms' }}>
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold text-brand-teal">Prompt Templates</h1>
            <p className="mt-1 text-sm text-brand-slate">
              {templateList.length} templates · {totalImages} images generated
            </p>
          </div>
        </div>
      </div>

      {/* Template list */}
      {templateList.length === 0 ? (
        <div className="rounded-xl border border-dashed border-brand-teal/20 py-16 text-center text-sm text-gray-400">
          No templates found.
        </div>
      ) : (
        <div className="space-y-3">
          {templateList.map((template, index) => {
            const previewImages = (imagesByTemplate[template.id] || []).slice(0, 2);
            const imageCount    = countByTemplate[template.id] ?? 0;
            return (
              <TemplateCard
                key={template.id}
                template={template}
                previewImages={previewImages}
                imageCount={imageCount}
                animationDelay={`${80 + index * 40}ms`}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
