import { createServiceClient } from '@/lib/supabase/server';
import { AdminTemplateGrid } from './admin-template-grid';
import type { PromptTemplate } from '@/types';

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

  const { data: templates } = await supabase
    .from('prompt_templates')
    .select('*')
    .order('number');

  const templateList = (templates || []) as PromptTemplate[];
  const templateIds  = templateList.map((t) => t.id);

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
    for (const [tid, imgs] of Object.entries(imagesByTemplate)) {
      countByTemplate[tid] = imgs.length;
    }
  }

  const totalImages = Object.values(countByTemplate).reduce((a, b) => a + b, 0);

  return (
    <div className="animate-fade-in">
      <div className="mb-6 stagger-item" style={{ animationDelay: '40ms' }}>
        <h1 className="text-xl font-bold text-brand-forest">Prompt Templates</h1>
        <p className="text-sm text-brand-slate mt-0.5">
          {templateList.length} templates · {totalImages} images generated
        </p>
      </div>

      <AdminTemplateGrid
        templates={templateList}
        imagesByTemplate={imagesByTemplate}
        countByTemplate={countByTemplate}
      />
    </div>
  );
}
