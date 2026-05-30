---
name: repo-to-likec4
description: >-
  Legacy compatibility entry for old repo-to-likec4 invocations. The LikeC4
  workflow has been superseded by Cartograph. Use this only to redirect requests
  to the current cartograph skill unless the user explicitly asks for historical
  LikeC4 reference material.
---

# Legacy redirect: use Cartograph

The original `repo-to-likec4` LikeC4 workflow is no longer the active product.
ADR-0001 replaced it with **Cartograph**: a React Flow architecture-docs viewer
driven by `.cartograph/architecture.json` and bundled into
`cartograph-site/index.html`.

When a user asks to generate, refresh, publish, or inspect architecture diagrams
for a repo, follow `skills/cartograph/SKILL.md`.

Only use the old LikeC4 references in this directory when the user explicitly
asks for legacy LikeC4 behavior or historical migration context.

Important migration note: Cartograph's generator removes old LikeC4 artifacts by
default (`likec4/`, `*.c4`, `*.likec4`, `likec4.config.json`, and
`.github/workflows/likec4-pages.yml`). Pass `--keep-c4` only when the user wants
to preserve those legacy files.
