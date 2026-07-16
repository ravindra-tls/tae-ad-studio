/**
 * Shared route guards for /api/forge/*.
 *
 * Auth/role checks delegate to lib/auth/guards.ts (the ONE authorization
 * module); this file only adds the forge-session ownership guard and the
 * forge-specific error/taxonomy helpers.
 */
import { NextResponse } from 'next/server';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import {
  requireUser as guardRequireUser,
  requireAdmin as guardRequireAdmin,
  jsonError as guardJsonError,
} from '@/lib/auth/guards';
import { taxonomies, staticFormats } from './knowledge';

export interface ForgeSessionRow {
  id: string;
  user_id: string;
  product_id: string;
  name: string;
  status: string;
  source: string | null;
}

export type AuthContext =
  | { ok: true; user: User; service: SupabaseClient }
  | { ok: false; response: NextResponse };

export type ForgeSessionContext =
  | { ok: true; user: User; service: SupabaseClient; session: ForgeSessionRow }
  | { ok: false; response: NextResponse };

export const jsonError = guardJsonError;

/** Authenticated user + service client (no session requirement). */
export async function requireUser(): Promise<AuthContext> {
  return guardRequireUser();
}

/** Authenticated user owning a forge-sourced session. */
export async function requireForgeSession(sessionId: string): Promise<ForgeSessionContext> {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  const { user, service } = auth;

  const { data: session, error } = await service
    .from('sessions')
    .select('id, user_id, product_id, name, status, source')
    .eq('id', sessionId)
    .maybeSingle();

  if (error || !session || session.user_id !== user.id || session.source !== 'forge') {
    return { ok: false, response: jsonError(404, 'Session not found') };
  }
  return { ok: true, user, service, session: session as ForgeSessionRow };
}

/** Authenticated admin (or dev — see lib/auth/guards.ts). */
export async function requireAdmin(): Promise<AuthContext> {
  return guardRequireAdmin();
}

/** Uniform error → response mapping for forge routes. */
export function forgeErrorResponse(err: unknown): NextResponse {
  const anyErr = err as { status?: number; code?: string; message?: string } | null;
  const message = (anyErr && anyErr.message) || 'Internal error';
  if (anyErr && anyErr.code === 'NO_API_KEY') return NextResponse.json({ error: message, code: anyErr.code }, { status: 400 });
  if (anyErr && anyErr.code === 'FORGE_STATE_CONFLICT') return NextResponse.json({ error: message, code: anyErr.code }, { status: 409 });
  if (anyErr && anyErr.code === 'FORGE_STATE_NOT_FOUND') return NextResponse.json({ error: message, code: anyErr.code }, { status: 404 });
  console.error('[forge] error:', message);
  return NextResponse.json({ error: message }, { status: 500 });
}

/** The static taxonomy payload every forge client needs (mirrors CF /api/taxonomies). */
export function taxonomiesPayload() {
  return {
    stages: taxonomies.awarenessStages,
    mechanics: taxonomies.mechanics,
    triggers: taxonomies.triggers,
    hookTactics: taxonomies.hookTactics,
    voicePatterns: taxonomies.voicePatterns,
    formats: staticFormats(),
    constraintCards: taxonomies.constraintCards,
    ctaOptions: taxonomies.ctaOptions,
    conversionEnhancers: taxonomies.conversionEnhancers,
  };
}
