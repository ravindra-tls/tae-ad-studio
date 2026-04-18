import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isEnabled } from '@/lib/feature-flags';

// Feature flag evaluation depends on the current user — never cache.
export const dynamic = 'force-dynamic';

/**
 * GET /api/feature-flags/check?flag=brief_first_ui
 *
 * Returns { enabled: boolean } for the current user. Used by the
 * client-side useFeatureFlag hook.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const flag = url.searchParams.get('flag');
  if (!flag) {
    return NextResponse.json({ error: 'Missing "flag" query param' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const enabled = await isEnabled(flag, user?.id);
  return NextResponse.json({ flag, enabled });
}
