# Cartograph backlog

Deferred work for the React Flow + agent-owned manifest engine ([ADR-0001](ADR-0001-react-flow-architecture-engine.md)).
Phasing follows the ADR + [app-shell-and-ia](../design/app-shell-and-ia.md). This file makes the
implicit phased plan explicit; update it as items land.

## Done

- **Layout stage** — elkjs run once per view, positions baked into `view.layout` (`fe5e093`).
- **LikeC4 migration/cleanup** — re-mapping a repo that still carries old `repo-to-likec4`
  artifacts now detects them and removes the wholly-owned ones on `--migrate` (`186b702`).
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

## Remaining — content & editing (the real next gaps)

- **`view-refine` LLM stage** *(biggest gap)* — generate each node's prose (`summary`/`description`)
  and its `pages/**.md` doc page from the manifest (schema-constrained, human-editable, merge-
  preserved). Until this lands: node cards have no summary, every doc route shows the missing-page
  state, and there's nothing for tours to teach. This is the only LLM-using stage; tier = Haiku.
- **In-viewer write-back (editing parity)** — the viewer is read-only (`nodesDraggable=false`); human
  edits today must be made by hand in `architecture.json`. ADR-0001 Phase-2 calls for drag / rename /
  group / hide / pin / annotate from the UI → manifest (RFC-6902 patch, `zundo` undo). The merge
  layer that makes those edits survive is already built; the UI surface that produces them is not.

## Remaining — engine refinements

- **Incremental placement into existing lanes** — a new node whose `parentId` is an existing lane is
  placed at root level (below content), not nested inside the frozen lane + grown box. `layoutNew`
  refinement.
- **Rename detection** — port `rename-detect.ts` from the spike so `idAliases` are produced on re-run
  (merge already consumes them); then threshold tuning + a false-positive error bar.
- **Multi-view / archetypes** — generate is single-view (`components`). The C4 altitude ladder
  (context / container / component), archetype-driven view planning, and collapse/semantic-zoom are
  still to come.
- **Multi-language recon** — recon walks JS/TS only; Python/Go/Java enhancers carry `confidence:'inferred'`.
- **Live token-cost benchmark** on the testbed — Phase-0 numbers are modeled, not a billed run.
- **Opt-in CI-on-merge** — Batch API + Haiku view-refine + debounce + a daily spend cap (manual
  `/map` is the chosen default).

## Remaining — learning UX (Phase 3)

- The tour **player** (currently a placeholder landing), per-component lessons, full auto-generated
  nested Modules/Learning trees, the 3 role entry points.
