import type { Metadata } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Komon',
    template: '%s · Komon',
  },
  description: 'Gemeinsame Verwaltung mehrerer Communities: Teilnehmende, Kommunikation, Dateien, Events und Termine.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
