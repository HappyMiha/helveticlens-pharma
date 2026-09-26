# HelveticLens Pharma

[Production](https://pharma.helveticlens.ch) · [Apache License 2.0](LICENSE) · [Shared platform](https://github.com/HappyMiha/helvetic-lens)

A dedicated pharmaceutical monitoring workspace based on the HelveticLens platform and the September 2026 Legal Hackathon workflow.

Describe a monitoring question → review AI topics → select primary sources → choose delivery → start a collaborative dossier.

See [the product model](PRODUCT.md) for the research loop, intended users, coverage and pilot measures.

## What works

- Living professional topics with focused questions, attributed source-linked replies, team-accepted working answers and reopening.
- Workspace discovery plus explicit Fedlex official title search and Europe PMC literature lookup. Search results seed a topic or become saved references.
- Evidence-grounded AI research notes with exact quote checks, source snapshots, open gaps and manual acceptance.
- Accountable follow-up actions, owners, deadlines, review rhythm, team/personal work queue and a private printable topic brief.
- Existing HelveticLens sign-in and registration, organization permissions and server sessions.
- Durable five-step drafts, real configured AI proposals, manual editing, source recommendations restricted to the real catalogue, saved-evidence previews and idempotent activation.
- Organization- and product-scoped dossiers with original-source links, comments, files, relevance feedback, export and activity history.
- Native scheduled Swiss source collections and explicit individual-page watches with real fetching, stored baselines, daily jobs and visible failure states.
- In-app evidence and the existing verified-email daily/weekly personal organization digest.
- Team invitations and viewer/administrator roles. Drafts remain author-private; activated dossiers are shared within the current organization.
- AI improvements based on bounded saved feedback. Applying a reviewed suggestion creates a native topic revision; stale proposals cannot overwrite current monitoring.

## Architecture

This repository owns the product interface and a bounded, same-origin API gateway. The Apache-2.0 [HelveticLens platform](https://github.com/HappyMiha/helvetic-lens) owns identity, PostgreSQL, encrypted provider settings, persistent evidence, workers, source collection and email delivery. Backend implementation: `services/api/helvetic_lens/product_api.py`, `product_research.py`, `product_operations.py` and `product_models.py`; schema through migration `f4c495bef124`. The two products share that core while their dossier lists are separated by product and organization.

No production records, credentials, provider keys or uploaded files are stored in this repository. The browser never chooses the upstream origin. The gateway forwards only HelveticLens session/CSRF cookies, preserves HttpOnly cookies, checks mutation origins, bounds streamed uploads and sends private responses with `no-store`.

## Development

Node.js 22.13+ and pnpm. Dependencies are pinned in `pnpm-lock.yaml`.

```sh
pnpm install --frozen-lockfile
pnpm dev --port 3141
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```

Production defaults to the existing `https://helveticlens.ch` core. For a separate self-hosted installation, first deploy the upstream platform with the product-dossier migration and its documented production protections, then configure `HELVETICLENS_API_ORIGIN` as a server-side environment value. The core's SMTP, source access, model configuration and worker readiness remain required; this is not a browser-only demo.

## Deployment

`.openai/hosting.json` identifies this product's own Sites project. Vite/Vinext builds a Cloudflare-compatible Worker under `dist/server`, with client assets in `dist/client`. Publish only a validated build of the exact source commit. Configure custom-domain DNS using the deployment provider's returned validation records. The public interface retains application authentication for all private data.

## Coverage and review boundaries

Scheduled source coverage is the platform's actual Swiss catalogue. Extra jurisdiction names do not create coverage. Additional page watches monitor that URL rather than crawling the whole regulator's website; dynamic or unavailable pages may fail visibly. AI drafts are proposals, not verified medical or legal findings. Current-source interpretation and external usefulness assessment require professional review.

Email choices change the current user's personal organization digest, not an independent mailing list for each client. Topic pause leaves shared source collection and document watch settings separate. Attachments are private downloads (10 MB each, 50 per dossier, 500 MB per organization), not automatically parsed or sent to AI. Current UI language is English; the full platform retains its existing languages and expert settings.

## Verification

Production build, strict TypeScript and authored-source lint. Six gateway contract tests cover cookie filtering, session propagation, route/product restrictions, cross-origin writes, streamed upload bounds, private binary download, research/queue route isolation, brief security headers and failure recovery. Native backend tests cover persistence, activation, tenant isolation, author-private drafts, viewer denial, CSRF, file ownership/integrity/retention, genuine scheduler admission, bounded AI catalogue recommendations, reviewed topic revisions, collaborative questions, exact research citations, action ownership/outcomes, real pagination, migration preservation and retained team work after account erasure.

Vendored UI primitives and the generated mobile hook retain their upstream source. Lint excludes those generated files; all authored product code remains under the strict project rules.

## License

Apache-2.0 for the project code, with preserved upstream attribution in [NOTICE](NOTICE). Third-party libraries and source documents retain their own terms; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
