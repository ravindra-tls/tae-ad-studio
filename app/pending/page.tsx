import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth/guards';

/**
 * Landing page for authenticated users who have no workspace yet (signed up
 * without a matching invite). They can log in but see only this page until a
 * workspace admin invites their email.
 */
export default async function PendingPage() {
  const ctx = await requireUser();
  if (!ctx.ok) redirect('/login');
  // Already a member (or a dev) → nothing pending.
  if (ctx.workspaceId || ctx.profile.role === 'dev') redirect('/dashboard');

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-cream p-6">
      <div className="w-full max-w-md rounded-2xl border border-brand-sage/25 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-brand-forest/10 text-2xl">
          ⏳
        </div>
        <h1 className="font-serif text-2xl text-brand-forest">Awaiting a workspace invite</h1>
        <p className="mt-3 text-sm leading-relaxed text-brand-slate">
          Your account <span className="font-medium text-brand-forest">{ctx.profile.email}</span> isn&apos;t
          part of a workspace yet. Ask your team admin to invite this email, then
          reload this page — you&apos;ll be let in automatically.
        </p>
        <form action="/api/auth/logout" method="post" className="mt-6">
          <button
            type="submit"
            className="text-sm font-medium text-brand-slate underline-offset-2 hover:text-brand-forest hover:underline"
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
