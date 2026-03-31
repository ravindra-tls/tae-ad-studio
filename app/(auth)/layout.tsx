export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand-cream to-white p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="font-serif text-3xl text-brand-teal">TAE Ad Studio</h1>
          <p className="mt-1 text-sm text-brand-slate">AI-powered ad creation for The Ayurveda Experience</p>
        </div>
        {children}
      </div>
    </div>
  );
}
