import { requireMember } from '@/lib/auth/guards';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  // Members only — the workspace stamp routes template proposals to the
  // right admin queue (general feedback goes to the dev inbox regardless).
  const ctx = await requireMember();
  if (!ctx.ok) return ctx.response;
  const { user, service: serviceClient, workspaceId } = ctx;

  const {
    kind,
    title,
    message,
    templateName,
    templateCategory,
    promptExample,
  } = await request.json();

  if (!['feedback', 'template_proposal'].includes(kind)) {
    return NextResponse.json({ error: 'Invalid submission kind' }, { status: 400 });
  }

  if (!title?.trim() || !message?.trim()) {
    return NextResponse.json({ error: 'Title and message are required' }, { status: 400 });
  }

  if (kind === 'template_proposal' && !templateName?.trim()) {
    return NextResponse.json({ error: 'Template name is required for template proposals' }, { status: 400 });
  }

  const { data, error } = await serviceClient
    .from('feedback_submissions')
    .insert({
      user_id: user.id,
      workspace_id: workspaceId,
      kind,
      title: title.trim(),
      message: message.trim(),
      template_name: templateName?.trim() || null,
      template_category: templateCategory?.trim() || null,
      prompt_example: promptExample?.trim() || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
