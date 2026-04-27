import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// This route is excluded from the auth middleware (see middleware.ts) because
// image providers POST here without session cookies. Security is enforced via
// the WEBHOOK_SECRET shared-secret header instead.

const VALID_STATUSES = new Set(['queued', 'in_progress', 'completed', 'failed', 'nsfw']);

export async function POST(request: Request) {
  // 1. Shared-secret authentication — providers must send the secret in the
  //    x-webhook-secret header. If WEBHOOK_SECRET is not set in env the check
  //    is skipped (dev convenience only; always set it in production).
  const secret = process.env.WEBHOOK_SECRET;
  if (secret) {
    const incoming = request.headers.get('x-webhook-secret');
    if (incoming !== secret) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  try {
    const payload = await request.json();
    const { request_id, status, images, error } = payload;

    if (!request_id) {
      return NextResponse.json({ error: 'Missing request_id' }, { status: 400 });
    }

    // 2. Validate status against known enum values — reject any arbitrary string
    //    a caller might inject to corrupt the record.
    if (!VALID_STATUSES.has(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const supabase = await createServiceClient();

    const updateData: Record<string, any> = { status };

    if (status === 'completed' && images?.[0]?.url) {
      updateData.image_url = images[0].url;
    }

    if (status === 'failed' || status === 'nsfw') {
      updateData.error_message = error || `Generation ${status}`;
    }

    // 3. Execute update and verify at least one row was actually touched.
    //    If no row matches request_id we return 404 — this makes spurious /
    //    replayed calls observable rather than silently swallowed.
    const { data: updated, error: updateError } = await supabase
      .from('generated_images')
      .update(updateData)
      .eq('request_id', request_id)
      .select('id');

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    if (!updated || updated.length === 0) {
      return NextResponse.json({ error: 'No matching record for request_id' }, { status: 404 });
    }

    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
}
