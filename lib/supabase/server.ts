import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

type CookieToSet = {
  name: string;
  value: string;
  options?: Record<string, unknown>;
};

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from Server Component — ignore
          }
        },
      },
    }
  );
}

// The service client is stateless (no cookies/session) — one instance per
// server process. Re-creating it per call site added avoidable setup work on
// every request; the singleton also lets undici reuse warm connections.
import type { SupabaseClient } from '@supabase/supabase-js';
let _serviceClient: SupabaseClient | null = null;

export async function createServiceClient(): Promise<SupabaseClient> {
  if (_serviceClient) return _serviceClient;
  const { createClient } = await import('@supabase/supabase-js');
  _serviceClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  return _serviceClient;
}
