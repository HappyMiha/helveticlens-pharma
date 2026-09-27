import Link from 'next/link';
export default function PublicDossierMissing() {
  return (
    <main className="public-shell public-empty">
      <h1>This public dossier is unavailable</h1>
      <p>Its author may have withdrawn it, or the address may be incorrect.</p>
      <Link href="/public-dossiers">Browse public dossiers</Link>
    </main>
  );
}
