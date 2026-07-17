import type { Metadata } from 'next';
import { Inter, DM_Serif_Display } from 'next/font/google';
import './globals.css';
import ButtonGlowTracker from '@/components/ButtonGlowTracker';
import { SnackbarProvider } from '@/components/ui/snackbar';

// Self-hosted via next/font — replaces the render-blocking Google Fonts
// @import chain (globals.css → fonts.googleapis.com CSS → font files).
// The variables feed tailwind.config.js fontFamily (sans/serif).
const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-inter',
});
const dmSerif = DM_Serif_Display({
  subsets: ['latin'],
  weight: '400',
  display: 'swap',
  variable: '--font-dm-serif',
});

export const metadata: Metadata = {
  title: 'TAE Ad Studio',
  description: 'AI-powered ad image generation for The Ayurveda Experience',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${dmSerif.variable}`}>
      <body className="min-h-screen font-sans">
        <ButtonGlowTracker />
        <SnackbarProvider>{children}</SnackbarProvider>
      </body>
    </html>
  );
}
