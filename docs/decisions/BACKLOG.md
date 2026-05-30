# Cartograph backlog

Deferred work for the React Flow + agent-owned manifest engine ([ADR-0001](ADR-0001-react-flow-architecture-engine.md)).
Phasing follows the ADR + [app-shell-and-ia](../design/app-shell-and-ia.md). This file makes the
implicit phased plan explicit; update it as items land.

## Done

- **Layout stage** — elkjs run once per view, positions baked into `view.layout` (`fe5e093`).
- **LikeC4 migration/cleanup** — re-mapping a repo that still carries old `repo-to-likec4`
  artifacts now detects them and removes the wholly-owned ones by default unless
  `--keep-c4` is passed (`186b702`).
- **Three-way merge wired into the pipeline** — a re-run over an existing `architecture.json`
  merges instead of clobbering; human label/pin/position/annotation/suppression all survive,
  removed nodes are muted not deleted, renames migrate via `idAliases` (`3baa263`, `861b66b`,
  `d77e53a`). Proven end-to-end.
- **Incremental freeze layout** — only the nodes the merge reports as new get placed; existing
  positions are frozen (`374bd2f`).
- **Changelog** — each re-run's `MergeReport` becomes a `changelog.json` entry (`d4b181d`).
- **The viewer app (Phase-1 shell)** — `cartograph/viewer/`, a light-OKLCH React 19 + `@xyflow/react`
  v12 app: app shell (sidebar / canvas / detail panel / header), lanes as RF subflows reading the
  baked layout, 3 edge variants, ⌘K search, changelog, markdown pages with empty states, first-class
  a11y. Single-file `viewer.html` build. 82 unit tests; renders the fixture with 0 console errors
  (`c4e978d` + review fixes). Design direction settled **LIGHT** (ADR drift fixed).
- **Installable skill + GitHub Pages deploy** — `skills/cartograph/`: prebuilt template +
  toolchain-free `bundle.ts` injector (builds the viewer for ANY repo, no npm/vite for the user) +
  `cartograph-pages.yml` Pages deploy + `pack.sh` (`efd953a`, `f79b55b`). Proven end-to-end offline.
- **Rename detection wired into re-runs** — edge-neighborhood + filename-stem detector produces
  `idAliases` so a moved/renamed file migrates its human edits; human-origin nodes are never aliased.
- **Incremental placement into existing lanes** — a new node whose lane is laid out is nested
  lane-local at the lane's bottom and the lane box grows; ungrouped/new-lane nodes fall back to root.
- **C4 altitude ladder** — Containers view (synthetic container nodes + aggregated container edges),
  Components, and per-directory drill-downs; single-dir repos stay single-view.
- **Multi-language recon** — JS/TS (precise) + Python / Ruby / Go (`confidence:'inferred'`) via a
  pluggable extractor registry.
- **`view-refine` LLM stage** — authors each node's `summary` + a `pages/**.md` doc page from the
  manifest via the **`claude` CLI** (Haiku; injectable refiner, deterministic merge/write TDD'd).
  Opt-in `--refine`; prose is machine-provenance so the merge protects human edits. Authored real
  docs for the testbed; the viewer renders them (frontmatter-stripped) instead of the empty state.
- **In-viewer editing parity** — drag-reposition, rename, pin, annotate, hide from the canvas/panel,
  zundo undo/redo, and Export (downloads `architecture.json`); edits flip provenance to `human` and
  round-trip through the merge. (`zustand` + `zundo`.)
- **Learning UX** — deterministic role tours (understand / fix-bug / add-feature) generated from the
  graph + a `TourPlayer` overlay that drives the canvas via selection; the 3 role entry points + ⌘K.
- **Token-cost estimator** — `cost.ts` (full vs incremental, Haiku/Sonnet) + CLI.
- **Opt-in CI-rebuild Pages** — `cartograph-pages-rebuild.yml` (regenerate-on-push, debounced,
  deterministic; refine off by default). Manual `/map` remains the chosen default.

## Future enhancements (beyond this backlog)

- Archetype-driven view planning + a true C4 Context view of external systems (recon captures
  internal modules only today; external deps would need a package-manifest pass).
- Semantic-zoom LOD / lane collapse-expand on the canvas (lane header is a non-interactive label now).
- Go at package-node granularity (current Go recon links to the package's files, `inferred`).
- Rename-detection threshold tuning + a false-positive error bar; a LIVE billed token benchmark
  (the `claude` CLI returns real per-call usage — wire it into a readout).
- LLM-authored tour prose + per-component lessons (the structural tours are the deterministic default).
