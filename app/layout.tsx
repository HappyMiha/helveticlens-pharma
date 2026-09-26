import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'HelveticLens Pharma',
  description:
    'Pharmaceutical monitoring with primary sources, collaborative dossiers and reviewed AI guidance.',
  icons: { icon: '/favicon.svg' },
  metadataBase: new URL('https://pharma.helveticlens.ch'),
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
