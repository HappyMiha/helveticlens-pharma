/* oxlint-disable next/no-html-link-for-pages -- Native navigation avoids the deployed runtime namespace failure. */
export default function PublicDossierMissing() {
  return (
    <main className="public-shell public-empty">
      <h1>This public dossier is unavailable</h1>
      <p>Its author may have withdrawn it, or the address may be incorrect.</p>
      <a href="/public-dossiers">Browse public dossiers</a>
    </main>
  );
}
