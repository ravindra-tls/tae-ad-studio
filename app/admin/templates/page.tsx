import { requirePageAdmin, isDevRole } from '@/lib/auth/guards';
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
  const ctx = await requirePageAdmin();
  const supabase = ctx.service;
  const isDev = isDevRole(ctx.profile.role);
  const workspaceId = ctx.workspaceId;

  // Union catalog: universal templates + this workspace's own. Active only —
  // archived templates keep provenance but leave the grid. `*` includes
  // workspace_id so the grid can badge scope and gate edit/archive/promote.
  let templatesQuery = supabase
    .from('prompt_templates')
    .select('*')
    .eq('is_active', true);
  templatesQuery = workspaceId
    ? templatesQuery.or(`workspace_id.is.null,workspace_id.eq.${workspaceId}`)
    : templatesQuery.is('workspace_id', null);
  const { data: templates } = await templatesQuery.order('number');

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
        isDev={isDev}
        workspaceId={workspaceId}
      />
    </div>
  );
}
