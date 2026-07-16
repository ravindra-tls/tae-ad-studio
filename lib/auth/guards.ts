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
import { cookies } from 'next/headers';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export type Role = 'user' | 'admin' | 'dev';

/** Cookie a dev sets to act inside a specific workspace (they have none of their own). */
export const ACTING_WORKSPACE_COOKIE = 'acting_workspace';

export interface AuthProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  usage_cap: number;
  usage_count: number;
  workspace_id: string | null;
}

export interface AuthOk {
  ok: true;
  user: User;
  profile: AuthProfile;
  service: SupabaseClient;
  /**
   * The workspace this request acts within:
   *   admin/user → their own profile.workspace_id
   *   dev        → the acting_workspace cookie, else null (must pick one)
   * null for pending users and for devs who haven't chosen a workspace.
   */
  workspaceId: string | null;
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

/**
 * Resolve the acting workspace for a profile. Devs stand outside workspaces
 * and choose one via the acting_workspace cookie; everyone else acts within
 * their own membership.
 */
export function resolveActingWorkspace(profile: AuthProfile): string | null {
  if (profile.role === 'dev') {
    try {
      return cookies().get(ACTING_WORKSPACE_COOKIE)?.value ?? null;
    } catch {
      return null; // cookies() unavailable (shouldn't happen in route/RSC context)
    }
  }
  return profile.workspace_id;
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

  const p = profile as AuthProfile;
  return { ok: true, user, profile: p, service, workspaceId: resolveActingWorkspace(p) };
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

/**
 * Authenticated member of a workspace (not pending). Guarantees a non-null
 * workspaceId. Pending users (workspace_id null, non-dev) get 403; devs
 * without an acting workspace also get 403 (they must pick one).
 */
export async function requireMember(): Promise<Guarded> {
  const ctx = await requireUser();
  if (!ctx.ok) return ctx;
  if (!ctx.workspaceId) {
    return {
      ok: false,
      response: jsonError(403, ctx.profile.role === 'dev'
        ? 'No workspace selected'
        : 'Your account is awaiting a workspace invite'),
    };
  }
  return ctx;
}

/**
 * Admin (or dev) of a specific workspace. When wsId is omitted, uses the
 * acting workspace. Devs pass for any workspace; admins only for their own.
 */
export async function requireWorkspaceAdmin(wsId?: string): Promise<Guarded> {
  const ctx = await requireUser();
  if (!ctx.ok) return ctx;
  const target = wsId ?? ctx.workspaceId;
  if (!target) return { ok: false, response: jsonError(403, 'No workspace selected') };
  if (isDevRole(ctx.profile.role)) return ctx;
  if (ctx.profile.role === 'admin' && ctx.profile.workspace_id === target) return ctx;
  return { ok: false, response: jsonError(403, 'Forbidden') };
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

/**
 * Page gate for workspace members. Pending users (no workspace, non-dev) are
 * sent to /pending; devs with no acting workspace continue (the dev area lets
 * them pick). Use in the app-shell layouts.
 */
export async function requirePageMember(): Promise<AuthOk> {
  const ctx = await requireUser();
  if (!ctx.ok) redirect('/login');
  if (!ctx.workspaceId && ctx.profile.role !== 'dev') redirect('/pending');
  return ctx;
}
