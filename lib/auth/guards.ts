/**
 * lib/auth/guards.ts — the ONE authorization module.
 *
 * House data-access pattern: cookie client proves identity (auth.getUser()),
 * then all DB work runs on the service client with EXPLICIT predicates —
 * RLS is bypassed on these paths, so guards + query predicates are the
 * enforcement, not policies.
 *
 * Role model (Phase 1: 'user' | 'admin'; 'dev' arrives with the workspace
 * migration and is already accepted by every admin check below so the
 * rollout needs no second pass here):
 *   dev   — super admin, passes every check
 *   admin — workspace owner (workspace scoping lands in Phase 3)
 *   user  — member
 *
 * Conventions:
 *   401 unauthenticated · 403 role failure on a resource the caller may know
 *   exists · 404 for existence-hiding ownership failures.
 *
 * Three call styles:
 *   API routes:        const ctx = await requireAdmin(); if (!ctx.ok) return ctx.response;
 *   Server actions:    const { user, service } = await assertAdmin();   // throws
 *   Server components: const ctx = await requirePageAdmin();            // redirects
 */
import { NextResponse } from 'next/server';
import { redirect } from 'next/navigation';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export type Role = 'user' | 'admin' | 'dev';

export interface AuthProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  usage_cap: number;
  usage_count: number;
  workspace_id?: string | null; // present after the workspace migration
}

export interface AuthOk {
  ok: true;
  user: User;
  profile: AuthProfile;
  service: SupabaseClient;
}
export interface AuthFail {
  ok: false;
  response: NextResponse;
}
export type Guarded = AuthOk | AuthFail;

export function jsonError(status: number, message: string): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export function isAdminRole(role: Role | null | undefined): boolean {
  return role === 'admin' || role === 'dev';
}
export function isDevRole(role: Role | null | undefined): boolean {
  return role === 'dev';
}

/** Authenticated user + their profile + service client. */
export async function requireUser(): Promise<Guarded> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, response: jsonError(401, 'Unauthorized') };

  const service = await createServiceClient();
  const { data: profile } = await service
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();
  if (!profile) return { ok: false, response: jsonError(401, 'Unauthorized') };

  return { ok: true, user, profile: profile as AuthProfile, service };
}

/** Authenticated admin or dev. */
export async function requireAdmin(): Promise<Guarded> {
  const ctx = await requireUser();
  if (!ctx.ok) return ctx;
  if (!isAdminRole(ctx.profile.role)) {
    return { ok: false, response: jsonError(403, 'Forbidden') };
  }
  return ctx;
}

/** Authenticated dev only. */
export async function requireDev(): Promise<Guarded> {
  const ctx = await requireUser();
  if (!ctx.ok) return ctx;
  if (!isDevRole(ctx.profile.role)) {
    return { ok: false, response: jsonError(403, 'Forbidden') };
  }
  return ctx;
}

// ── Throw-style (server actions) ─────────────────────────────────────────────

export async function assertUser(): Promise<AuthOk> {
  const ctx = await requireUser();
  if (!ctx.ok) throw new Error('Unauthorized');
  return ctx;
}

export async function assertAdmin(): Promise<AuthOk> {
  const ctx = await requireAdmin();
  if (!ctx.ok) throw new Error('Forbidden: admin access required');
  return ctx;
}

export async function assertDev(): Promise<AuthOk> {
  const ctx = await requireDev();
  if (!ctx.ok) throw new Error('Forbidden: dev access required');
  return ctx;
}

// ── Redirect-style (server components / layouts) ─────────────────────────────

export async function requirePageUser(): Promise<AuthOk> {
  const ctx = await requireUser();
  if (!ctx.ok) redirect('/login');
  return ctx;
}

export async function requirePageAdmin(): Promise<AuthOk> {
  const ctx = await requireUser();
  if (!ctx.ok) redirect('/login');
  if (!isAdminRole(ctx.profile.role)) redirect('/dashboard');
  return ctx;
}
