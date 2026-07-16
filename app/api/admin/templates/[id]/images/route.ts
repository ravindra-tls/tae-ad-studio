import { requireAdmin } from '@/lib/auth/guards';
import { NextResponse } from 'next/server';

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const ctx = await requireAdmin();
  if (!ctx.ok) return ctx.response;

  const { data, error } = await ctx.service
    .from('generated_images')
    .select('id, image_url, aspect_ratio, prompt_used, created_at')
    .eq('template_id', params.id)
    .eq('status', 'completed')
    .not('image_url', 'is', null)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
