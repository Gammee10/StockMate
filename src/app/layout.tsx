import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'StockMate - Kiosk Counter',
  description: 'Fast, touch-first inventory and sales ledger for retail shopkeepers',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="selection:bg-primary/20 min-h-screen bg-background font-sans text-foreground antialiased selection:text-primary">
        {children}
      </body>
    </html>
  );
}
