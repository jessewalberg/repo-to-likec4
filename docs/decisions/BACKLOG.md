# Cartograph backlog

Deferred work for the React Flow + agent-owned manifest engine ([ADR-0001](ADR-0001-react-flow-architecture-engine.md)).
Phasing follows the ADR + [app-shell-and-ia](../design/app-shell-and-ia.md). This file makes the
implicit phased plan explicit; update it as items land.

## Done

- **Layout stage** — elkjs run once per view, positions baked into `view.layout` (`fe5e093`).
- **LikeC4 migration/cleanup** — re-mapping a repo that still carries old `repo-to-likec4`
  artifacts now detects them and removes the wholly-owned ones on `--migrate` (`186b702`).

## Phase 1 — the viewer app (next up)

The generation pipeline (recon → model → layout → validate) exists; **there is no app yet.**

- **React Flow viewer** — self-contained `viewer.html` with an inlined JSON data island;
  `@xyflow/react` v12 canvas that *reads the baked `view.layout`* (lanes as RF subflows), no
  layout at view-time.
- **App shell** — shadcn sidebar (Documentation / Architecture / Modules / Learning) + main +
  detail panel; MDX page renderer; `site.json`-driven nav; per-node `doc`/`lesson` attachment.
- **Global ⌘K search.**
- **Design system** — OKLCH dark-first, `@xyflow/react/dist/base.css` + owned `--xy-*` tokens.
- **`view-refine` agent stage** — authors the editable docs/lessons + per-field provenance
  (`pages/**.md`). Today `buildSite` only scaffolds nav.
- **Live token-cost benchmark** on the software-factory testbed — Phase-0 numbers are modeled,
  not a real billed run (carried from `phase0-findings`).

## Phase 2 — incremental + changelog

- **Wire the merge/patch layer into `generate.ts`** — the three-way merge is proven (8/8 spike)
  but the pipeline still does a clean regenerate every run; human edits won't survive yet. This
  is the load-bearing pivot promise.
- **Incremental freeze layout** — pin existing nodes, place only new ones via `elk.position`
  hints + an overlap guard (noted in `layout.ts` header).
- **Changelog** — `changelog.json` produced from the merge run's `MergeReport`.
- **Rename-detection threshold tuning** + a false-positive error bar (harness exists in the
  spike: `rename-detect.ts` + `real-proof.test.ts`).
- **Opt-in CI-on-merge** — Batch API + Haiku-for-view-refine + debounce + a daily spend cap
  (manual `/map` is the chosen default; see `phase0-findings`).

## Phase 3 — learning UX

- Deep learning / role tours, full auto-generated nested Modules trees, per-component lessons
  (multi-view + learning UX).
