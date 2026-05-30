# Phase-0 spike — findings

**Date:** 2026-05-29
**Status:** complete — **GATING DE-RISK PASSED**; ADR-0001 promoted `proposed → accepted` with adjustments.
**Inputs:** the gating merge proof (built inline, TDD) + a 4-agent background workflow (`wf_830c7c2e-f77`) for the elkjs / X6 / token-cost spikes.
**Spike code:** `spike/phase0/` (`merge/` = the gating proof, zero-dep, Node 24 native test runner; `elk/`, `x6/`, `token-cost/` = the secondary spikes).

---

## Bottom line

Phase-0 set out to break the two things that would kill the project before any build: **(1) the incremental three-way merge** (does it preserve human edits across real ID churn?) and **(2) the layout-once-then-freeze model** (does elkjs actually let pinned nodes survive?). Both held. The X6 evaluation and token-cost benchmark were folded in. **Nothing flipped ADR-0001.** The only required change is wording: the layout freeze is **app-owned**, not an ELK flag.

| Spike | Result | Flips ADR? |
|---|---|---|
| **Three-way merge (gating)** | ✅ **GREEN** — 8/8 tests incl. a real software-factory file-move + module-split with correct rename detection | No |
| **elkjs once-then-freeze** | ✅ Viable — but freeze is **app-owned** (ELK = candidate generator; `elk.position` hints + overlap guard) | No (reword layout policy) |
| **AntV X6 1-day touch** | ✅ **Drop X6, keep React Flow** — confirmed empirically | No |
| **Incremental token cost** | ✅ ~$0.05–0.16/push incremental — CI viable with guardrails | No (resolves trigger) |

---

## 1. The gating merge proof — GREEN

The whole pivot rests on: *can an agent re-run recon and patch the manifest without clobbering human edits, across real refactors?* Built TDD (red → green), zero dependencies, runs on Node 24's native test runner + TS type-stripping (`cd spike/phase0/merge && node --test`).

**8/8 tests pass.** Seven unit scenarios encode the merge contract; the eighth is the red-team's required real-repo proof.

The merge contract (in `merge.ts`), proven by `merge.test.ts`:
- **A** — human-edited `label`/`summary` + `pinned` position survive a recon refresh; recon-owned `metadata` still refreshes. *(the core promise)*
- **B** — a module split adds the new nodes (flagged `nodesNeedingLayout`) while the surviving node keeps its human edits; pinned nodes are excluded from layout.
- **C** — a file move migrates the human label + pinned position to the **new** id via `idAliases`; old id and its layout key disappear; edge endpoints repoint.
- **D / D2** — a human-**suppressed** edge/node is **not re-added** even when recon rediscovers it. *(kills the "agent re-adds the edge I deleted" failure that sinks regenerate-on-run competitors)*
- **E** — a node recon no longer sees is **muted** (`confidence: 'unknown'`), not hard-deleted, and keeps its human annotation.
- **F** — a human-authored node (`origin: 'human'`) survives a recon that never produced it.

**The real-repo proof** (`real-proof.test.ts`) — exactly what the red-team demanded ("two real refactor commits, not a fake recon"):
1. `recon.ts` extracts the **real** ESM module+import graph from software-factory's `tools/factory/` (13 `.mjs` modules).
2. On a copy, performs a **real file move** (`lib/dag.mjs → lib/graph/dag.mjs`, fixing all 3 importers) and a **real module split** (`lib/policy.mjs → + lib/policy-rules.mjs`, repointing `policy-gate-run`).
3. `rename-detect.ts` (edge-neighborhood Jaccard + filename-stem) emits **exactly** `{dag old → new}` and correctly does **not** alias the genuinely-new `policy-rules`.
4. The merge then migrates the human label + pin + annotation + position to the moved node's new id, adds the split module (needing layout), and holds the suppressed edge — **across real ID churn.**

> **De-risk verdict:** the merge model works. The remaining risk the red-team named — **rename-detection accuracy** — is real but bounded: the neighborhood+stem heuristic was correct on this refactor with no false positive. The error-bar question (how aggressive to tune the threshold) moves to Phase-2 with a clear test harness now in place. Two design simplifications proved out: explicit per-field `provenance` + an explicit `suppressions` list make the `base` ancestor unnecessary for the cases that matter (it's retained in the signature for future audit).

## 2. elkjs once-then-freeze — viable, freeze is app-owned

Ran real `elkjs@0.11.1` in pure Node 24 (`spike/phase0/elk/`).

- **Compound layout works cleanly:** `algorithm=layered, edgeRouting=ORTHOGONAL, hierarchyHandling=INCLUDE_CHILDREN` produces sane nested child coords and auto-sizes parent lanes. Pure Node (no browser/jsdom); ~676ms for 500 nodes/5 lanes. Footprint: `node_modules` 7.7M; the browser worker `elk-worker.min.js` is **1.52MB raw / 453KB gzipped** (corrects the "~600KB" estimate).
- **No native "pin most, place one" mode survives orthogonal routing.** `org.eclipse.elk.fixed` throws on orthogonal edges; the layered `INTERACTIVE` strategies preserve only *ordering*, not exact coords; cross-hierarchy algorithm mixing is forbidden by ELK.
- **The freeze that works is app-side:** the manifest is the source of truth; ELK is a **candidate generator**; the app keeps pinned coords and accepts ELK's coords **only for new/unpinned nodes** → a clean *0/6 pinned nodes moved*.
- **New-node placement needs a hint + a guard:** a naive candidate-merge dropped the new node *on top of* a frozen one. Feeding existing coords back as `elk.position` hints under `INTERACTIVE` + `interactiveReferencePoint=TOP_LEFT` placed the newcomer cleanly — but an **app-side overlap guard is still mandatory.**

> **ADR change (wording, not direction):** "ELK fixed-position pinning" → **"ELK candidate + app-owned freeze, with `elk.position` hints seeding new-node placement and a mandatory post-placement overlap guard."** This is the concrete mitigation for the red-team's "managed decay / overlap" risk, and it's the same hand-built layer that already owns `nodesNeedingLayout` in the merge.

## 3. AntV X6 1-day touch — drop X6, keep React Flow

Installed `@antv/x6@3.1.7` (MIT) and ran headless under jsdom (`spike/phase0/x6/`).

- X6 **preserves** unknown custom fields (`data.provenance`, `pinned`, `links`, `confidence`, deep nesting) losslessly through `toJSON()/fromJSON()` — a **wash** with React Flow on the source-of-truth requirement.
- X6's editing chrome (history, clipboard, selection, snapline, keyboard, transform, minimap) ships in-core and instantiates cleanly, and its history commands are **serializable** `{key, prev, next}` deltas (fairer than the research's "in-memory imperative stack" framing).
- **But the decisive points hold:** `graph.fromJSON()` is a **zero-merge whole-graph replace** — proven: a live human drag + a data flag were **wiped** on reload. And its history is keyed on X6 **cell paths, not our manifest's RFC-6902 pointers**, so it would run a *second* undo history parallel to the manifest. X6 also needs a bundler (no Node-native ESM) for any agent-side `toJSON`.

> **Verdict:** X6 buys nothing on the provenance three-way merge — the part that actually defines the product, which you build identically either way — while adding an imperative API, a competing undo stack, and a manifest adapter. **Stay on React Flow.** Borrow X6's serializable command *shape* as inspiration for the patch log; get undo/redo from `zundo` + RF's `snapToGrid`/helper-lines.

## 4. Incremental token cost — CI viable with guardrails (resolves the trigger)

Parametric model against current (2026-05-29) Anthropic pricing (Opus 4.7 $5/$25, Sonnet 4.6 $3/$15, Haiku 4.5 $1/$5 per MTok; Batch −50%). Writeup: `spike/phase0/token-cost/ESTIMATE.md`.

- **Incremental run (200 nodes / 10 views, skip-unchanged-views):** ~**$0.05 (Haiku) – $0.16 (Sonnet)** per push — ~90% cheaper than a full regen ($0.52–$1.55). A view-refine call (~12.3k tokens) is the dominant unit; a full gen ≈ 12.5 LLM calls, an incremental run ≈ 2.1.
- **CI economics:** the $5/day line is crossed at ~32 pushes/day (Sonnet) / ~94 (Haiku) for the target repo — fine at normal velocity. The real hazard is the **tail**: a big refactor with verbose prose makes a single Sonnet run ~$1.43 (→ $5/day at just 4 pushes/day). Large monorepos cross sooner.
- **Tiering:** deterministic recon/layout/validate = $0; **Model Builder = Sonnet 4.6** (single high-judgment call; Opus only for a first-ever unfamiliar-repo gen, never per-push); **View-Refine = Haiku 4.5** (high call count, output-heavy, schema-constrained).

> **Trigger decision (was deferred):** ship **manual `/map` as the default**; offer **opt-in CI-on-merge-to-default-branch** with incremental + Batch API + Haiku-for-view-refine + debounce + a **daily spend cap** to neutralize the tail. Reject naive full-regen-every-push CI ($228–$684/mo) and pre-commit hooks (latency). *Caveat: these are modeled, not a live billed benchmark — a real usage-readout on the testbed is a Phase-1 follow-up.*

---

## What changed in the plan

- **ADR-0001 → `accepted`** (gating spike passed).
- **Layout policy reworded** to "ELK candidate + app-owned freeze + position-hint seeding + overlap guard"; the **overlap guard** is added to Phase-1 scope.
- **Trigger resolved:** manual default + opt-in guardrailed CI; **model tiering** set (Sonnet model-builder / Haiku view-refine / deterministic rest).
- **X6 closed out:** evaluated and dropped; `zundo` + RF snapping is the undo/redo path.
- **Carried to Phase-2:** rename-detection threshold tuning + a false-positive error bar (harness exists in `rename-detect.ts` + `real-proof.test.ts`); a live token-cost benchmark.
