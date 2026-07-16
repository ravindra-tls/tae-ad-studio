import type { Metadata } from 'next';
import './globals.css';
import ButtonGlowTracker from '@/components/ButtonGlowTracker';
import { SnackbarProvider } from '@/components/ui/snackbar';

export const metadata: Metadata = {
  title: 'TAE Ad Studio',
  description: 'AI-powered ad image generation for The Ayurveda Experience',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <ButtonGlowTracker />
        <SnackbarProvider>{children}</SnackbarProvider>
      </body>
    </html>
  );
}
