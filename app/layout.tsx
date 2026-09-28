import type { Metadata } from 'next';
import { THEME_BOOTSTRAP } from '@/lib/theme-preference';
import './globals.css';
import './visual-language.css';
import './source-reading.css';
import './saved-comparisons.css';
import { ResearchEnvironment } from '@/components/app-shell';
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
    <html lang="en" className="dark" data-theme="dark" suppressHydrationWarning>
      <head>
        <script
          id="helvetic-theme"
          dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }}
        />
      </head>
      <body>
        <ResearchEnvironment>{children}</ResearchEnvironment>
      </body>
    </html>
  );
}
