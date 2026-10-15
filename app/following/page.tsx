/* oxlint-disable next/no-html-link-for-pages -- Native navigation avoids the deployed runtime namespace failure. */
import type { Metadata } from 'next';
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
        <a href="/public-dossiers">← Public dossiers · {product.name}</a>
        <a href="/">Open workspace</a>
      </header>
      <div className="public-intro">
        <p className="eyebrow">Personal research</p>
        <h1>Followed dossiers</h1>
        <p>
          Return to new evidence, possible contradictions and public discussion.
          Your list is personal; following sends no email.
        </p>
      </div>
      <FollowedDossiers />
      <footer className="public-footer">
        Research updates refresh while this page is open. Withdrawn evidence and
        dossiers you can no longer access are removed from the current view.
        Reading does not approve a finding; email delivery has separate
        settings.
      </footer>
    </main>
  );
}
