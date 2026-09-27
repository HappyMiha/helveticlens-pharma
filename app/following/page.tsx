import type { Metadata } from 'next';
import Link from 'next/link';
import { FollowedDossiers } from '@/components/public-following';
import { product } from '@/lib/product';
import '../public-dossiers/public.css';

export const metadata: Metadata = {
  title: `Followed dossiers · HelveticLens ${product.name}`,
  robots: { index: false, follow: false },
};
export default function FollowingPage() {
  return (
    <main className="public-shell">
      <header className="public-header">
        <Link href="/public-dossiers">← Public dossiers · {product.name}</Link>
        <Link href="/">Open workspace</Link>
      </header>
      <div className="public-intro">
        <p className="eyebrow">Your reading list</p>
        <h1>Followed dossiers</h1>
        <p>
          Return to new publication and public discussion changes. Your list is
          personal; following sends no email.
        </p>
      </div>
      <FollowedDossiers />
      <footer className="public-footer">
        Refresh to check current public changes. Withdrawn content is
        unavailable; deleted publications leave your list. Following is separate
        from monitoring and delivery settings in your private dossiers.
      </footer>
    </main>
  );
}
