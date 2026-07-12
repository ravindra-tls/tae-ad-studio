/**
 * GET /api/forge/taxonomies
 *
 * Static creative-strategy taxonomy payload for the composer UI.
 */
import { NextResponse } from 'next/server';
import { requireUser, taxonomiesPayload } from '@/lib/forge/route-helpers';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  return NextResponse.json(taxonomiesPayload());
}
