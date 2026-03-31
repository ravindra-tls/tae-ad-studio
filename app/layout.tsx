import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TAE Ad Studio',
  description: 'AI-powered ad image generation for The Ayurveda Experience',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        {children}
      </body>
    </html>
  );
}
