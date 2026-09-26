# Product development

Work on the requested product only. Reuse the shared HelveticLens API and its authorization boundaries. Never copy private data or credentials into this repository. Preserve Apache-2.0 attribution.

Run `pnpm test`, `pnpm lint`, `pnpm typecheck` and `pnpm build` for changes to the product gateway/workflow. Keep upstream UI primitives intact. Do not fabricate source coverage, AI results, notifications or monitoring events.

The shared platform lives in HappyMiha/helvetic-lens; changes to its API require its own instructions, tests and deployment. The product's own Sites project_id in .openai/hosting.json must be reused. Publish only the exact validated source.
