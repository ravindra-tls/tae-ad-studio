import { Sidebar } from '@/components/Sidebar';

interface AppLayoutProps {
  fullName: string | null;
  email: string | null;
  isAdmin: boolean;
  isDev?: boolean;
  children: React.ReactNode;
}

export function AppLayout({ fullName, email, isAdmin, isDev = false, children }: AppLayoutProps) {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar — sticky so it pins full-height to viewport left edge */}
      <div className="sticky top-0 h-screen shrink-0">
        <Sidebar fullName={fullName} email={email} isAdmin={isAdmin} isDev={isDev} />
      </div>

      {/* Main content — body scrolls so position:fixed works correctly */}
      <main className="flex-1 min-w-0">
        <div className="mx-auto max-w-6xl p-6 lg:p-8 has-[[data-fullbleed]]:max-w-none has-[[data-fullbleed]]:p-0">
          {children}
        </div>
      </main>
    </div>
  );
}
