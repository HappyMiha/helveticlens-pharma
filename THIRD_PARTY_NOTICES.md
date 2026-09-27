# Third-party notices

HelveticLens platform code and the product clients are Apache-2.0; see LICENSE and NOTICE.

The generated Sites/Vinext interface uses React, Vite, TypeScript, Tailwind CSS, Base UI, shadcn primitives, Lucide icons and their pinned transitive packages. Those packages retain the licenses supplied with their distributions. `pnpm-lock.yaml` records the exact dependency graph; do not remove package license files when redistributing bundled dependencies.

Names of authorities identify original publishers and do not imply endorsement. Official source documents and user attachments are not relicensed under this project's Apache license. Their source-specific rights and access conditions remain applicable. No proprietary model weights, API credentials, or private source documents are included.

The optional shared decision service uses [Laya](https://github.com/NandhaKishorM/laya)
0.3.20 and [laya-multilingual](https://huggingface.co/convaiinnovations/laya-multilingual),
both Apache-2.0. No model weights are bundled in this client. Hosted Jev and
Search1API are external services subject to their own terms. Upstream runtime
commit/checkpoint and deployment controls are recorded in the shared core's
`deploy/laya` and `docs/PRODUCT_DECISION_SEARCH.md`.
