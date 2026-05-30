# Phase-0 Spike — Incremental-Run Token Cost

**Spike:** `incremental-run token-cost`
**Date:** 2026-05-29
**Decides:** the manual-vs-CI-vs-hook update trigger for Cartograph (ADR-0001, "Update trigger: deferred — let the economics decide").
**Method:** a reproducible Node cost model (`model.mjs`) + a sensitivity sweep (`sensitivity.mjs`), priced against the **official Anthropic pricing page fetched 2026-05-29**. No SDK install needed — this is an arithmetic model, but the arithmetic is real, runnable, and the output below is pasted verbatim.

---

## 1. Current Claude API pricing (verified, official)

Source: <https://platform.claude.com/docs/en/about-claude/pricing> (fetched 2026-05-29). USD per million tokens (MTok).

| Model | Base input | 5m cache write | Cache read (hit) | Output | Batch input | Batch output |
|---|---|---|---|---|---|---|
| **Opus 4.7** | $5.00 | $6.25 | $0.50 | $25.00 | $2.50 | $12.50 |
| **Sonnet 4.6** | $3.00 | $3.75 | $0.30 | $15.00 | $1.50 | $7.50 |
| **Haiku 4.5** | $1.00 | $1.25 | $0.10 | $5.00 | $0.50 | $2.50 |

Notes that matter for this model:
- **Output is 5x input** on every tier. View-refine is output-heavy (prose), so output dominates the bill — model choice matters most on the output rate.
- **Prompt caching:** cache-read = 0.1x input. The stable system prompt (skill instructions + schema + style guide + few-shot, ~2,500 tok) is cached once per run and read by every call. 5-min cache write = 1.25x input.
- **Batch API:** flat 50% off input *and* output. Architecture docs are not latency-sensitive on CI, so batch is viable and roughly halves the bill — but it does not stack with the cached-system-prompt path in a simple way, so the two are reported as separate brackets.
- There is **no Haiku 4.6**; the current small tier is Haiku 4.5. Sonnet's current point is 4.6; Opus's is 4.7.
- Opus 4.7's new tokenizer can emit up to ~35% more tokens for the same text — another reason to keep Opus off the per-push hot path.

---

## 2. The pipeline being modelled

Per ADR-0001 / the research doc, the 5-stage pipeline is:

| Stage | LLM? | Cost in this model |
|---|---|---|
| 1. Recon (ctags/ast-grep/dep-cruiser, XXH3 diff, Louvain) | **No — deterministic** | $0 |
| 2. Model Builder (recon facts → typed nodes/edges, stable IDs) | **Yes** — 1 call | input = recon facts; output = manifest skeleton |
| 3. Layout (elkjs in Node, run-once-then-freeze) | **No — deterministic** | $0 |
| 4. **View-Refine** — 1 LLM call **per view**, parallel | **Yes — dominant cost** | input = manifest *slice* for that view + framing; output = prose (summary/description/labels) |
| 5. Assembler + Validator (orphan/overlap/ID checks) | **No, except on failure** | modelled as a 15% targeted-regen surcharge on view-refine |

Key cost-control design choices already baked in (from the research doc) and honored by the model:
- The agent **never passes the whole manifest to the model** — only the per-view slice.
- **Incremental runs skip unchanged views entirely** ($0 for those calls) and only re-type changed nodes in Stage 2.
- System prompt is **stable → prompt-cached**.

---

## 3. Token assumptions (the load-bearing inputs)

All in `model.mjs`, `const T`. ~4 chars/token (Anthropic's own rule of thumb). These are the numbers to challenge:

| Quantity | Value | Rationale |
|---|---|---|
| System prompt (cached) | 2,500 tok | skill instructions + JSON schema + style guide + a few-shot example |
| Model-builder input / node | 60 tok | one compact recon fact line (path, lang, loc, boundary, churn) |
| Model-builder input / edge | 25 tok | source→target + kind + confidence |
| Model-builder output / node | 70 tok | `{id,type,parentId,data:{label,tech,icon,path,links,metadata}}` skeleton, no prose |
| Model-builder output / edge | 35 tok | typed edge object |
| **View-refine input / node** | 90 tok | skeleton node + neighborhood context fed in |
| **View-refine input / edge** | 30 tok | |
| View-refine per-view framing | 400 tok | title, layoutDir, intent, what-to-emphasize |
| **View-refine output / node** | **220 tok** | summary (1–2 sentences) + markdown description + refined label — **prose-heavy, the dominant term** |
| View-refine output / edge | 25 tok | human-readable edge sentence/label |
| Validation retry rate | 15% | fraction of view-refine calls that trigger a targeted small-subgraph regen |
| Retry size | 30% of a view | a regen reprocesses part of the failing view |

**Repo shape (spike target):** 200 nodes, 300 edges, 10 views, ~25 nodes/view (C4-ladder views overlap on one shared node pool).

**Incremental churn (a "typical push"):** ~5% of nodes changed (≈10 nodes), each appearing in ~1.5 views → typically **1 changed view** regenerates at 200n/10v.

---

## 4. Headline result — per-view call & per-run cost (verbatim model output)

Per **view-refine** call at the spike target (25 nodes/view):
**~6,050 input tokens** (incl. the 2,500 cached system block) **+ 6,250 output tokens = ~12,300 tokens/call.**

| | Sonnet 4.6 (std+cache) | Sonnet 4.6 (batch) | Haiku 4.5 (std+cache) | Haiku 4.5 (batch) |
|---|---|---|---|---|
| **FULL generation** (1 model-builder + 10 view-refine + retries ≈ 12.5 LLM calls) | **$1.55** | $0.81 | **$0.52** | $0.27 |
| **INCREMENTAL run** (1 changed view ≈ 2.1 LLM calls) | **$0.16** | $0.073 | **$0.053** | $0.024 |
| Savings (incr vs full) | 90% | 91% | 90% | 91% |

**Mixed tier (recommended: Sonnet for model-builder, Haiku for view-refine), std+cache:**
- FULL gen: **$0.79** · INCREMENTAL run: **$0.070**

So: a full first-time generation of a 200-node/10-view repo is **~$0.50–$1.55** depending on tier; an incremental update after a normal push is **~$0.05–$0.16** (single-digit to low-double-digit **cents**).

---

## 5. When does CI-on-push become uneconomical (>$5/day)?

`daily = incremental-run cost × pushes/day`. STANDARD+cache pricing. `*` = over the $5/day line.

### Sonnet 4.6
```
  repo                          5/day    20/day    50/day   100/day   200/day
  spike target 200n/10v        $0.80     $3.20     $8.01*   $16.01*   $32.03*   (1 run=$0.1601)
  mid repo 500n/20v            $1.09     $4.36    $10.91*   $21.82*   $43.63*   (1 run=$0.2182)
  large monorepo 1000n/30v     $2.51    $10.03*   $25.08*   $50.16*  $100.32*   (1 run=$0.5016)
```

### Haiku 4.5
```
  repo                          5/day    20/day    50/day   100/day   200/day
  spike target 200n/10v        $0.27     $1.07     $2.67     $5.34*   $10.68*   (1 run=$0.0534)
  mid repo 500n/20v            $0.36     $1.45     $3.64     $7.27*   $14.54*   (1 run=$0.0727)
  large monorepo 1000n/30v     $0.84     $3.34     $8.36*   $16.72*   $33.44*   (1 run=$0.1672)
```

### Break-even (pushes/day to hit $5), spike-target 200n/10v
| Model | Incremental run | Pushes/day to $5 | Full gen | Full-runs/day to $5 |
|---|---|---|---|---|
| Sonnet 4.6 | $0.16 | **32** | $1.55 | 4 |
| Haiku 4.5 | $0.053 | **94** | $0.52 | 10 |
| Mixed tier | $0.070 | **72** | $0.79 | 6 |

### Steady-state monthly (CI on every push, 20 pushes/day × 22 days = 440 runs/mo)
| Model | Incremental | If every run were a *full* regen |
|---|---|---|
| Sonnet 4.6 | **$70/mo** | $684/mo |
| Haiku 4.5 | **$23/mo** | $228/mo |
| Mixed tier | **$31/mo** | — |

**Read-out:** with the incremental design (skip-unchanged-views), CI-on-push at the **200n/10v target is comfortably economical** for normal team velocity (≤20 pushes/day ⇒ ≤$3.20/day on Sonnet, ≤$1.07/day on Haiku). The $5/day line is only crossed at hyperactive monorepo velocity (50+ pushes/day) or on large repos.

---

## 6. Sensitivity — what would break this conclusion

`sensitivity.mjs` output (verbatim):

```
(a) view-refine OUTPUT tokens/node sensitivity — FULL gen (10 views) cost:
   outPerNode:   120     220(base)   400     600
  sonnet-4.6      $1.122    $1.497    $2.172    $2.922
  haiku-4.5       $0.374    $0.499    $0.724    $0.974

(b) churn sensitivity — INCREMENTAL run cost & changed-view count:
   changedNodes%:  2%      5%(base)  10%     20%     40%
  sonnet-4.6    $0.133/1v  $0.146/1v  $0.167/1v  $0.315/2v  $0.716/5v
  haiku-4.5     $0.044/1v  $0.049/1v  $0.056/1v  $0.105/2v  $0.239/5v

(c) WORST-CASE incremental (40% churn -> ~6 views, 600 out/node) daily @ pushes/day:
  sonnet-4.6  1 run=$1.428  -> $5/day at 4 pushes/day
  haiku-4.5   1 run=$0.476  -> $5/day at 11 pushes/day
```

Findings:
- **Output-per-node (prose volume) is the #1 driver.** Tripling it (220→600) nearly doubles full-gen cost. "Beauty on a blank canvas" means richer descriptions — budget for the high end. Even so, a full Haiku gen stays under $1.
- **Churn fraction is the #1 driver of the incremental bill** — because it controls *how many views regenerate*. At ≤10% churn the incremental run barely moves (1 view). A big refactor (40% churn) fans out to ~5 views and is ~5x more expensive.
- **The dangerous combination is "big refactor + verbose prose + per-push trigger":** worst-case incremental on Sonnet ($1.43/run) crosses $5/day at just **4 pushes/day**. This is the scenario that makes naive CI-on-every-push risky — not the steady state, but the bad-day tail.

---

## 7. Recommended model tier per stage

| Stage | Recommended tier | Why |
|---|---|---|
| 1. Recon | **none** (deterministic) | ctags/ast-grep/dep-cruiser; $0 |
| 2. Model Builder | **Sonnet 4.6** | one call; structural typing + stable-ID assignment + archetype reasoning is where correctness compounds across the whole manifest. The most "judgment" per token; cheap because it's a single call (~$0.07–0.44 full). Use **Opus only** for the first-ever generation of a genuinely unfamiliar repo if recon quality is poor — never on the per-push path (5x output cost + 35% tokenizer inflation). |
| 3. Layout | **none** (elkjs) | $0 |
| 4. View-Refine | **Haiku 4.5** | high call count, output-heavy prose, schema-constrained, per-view chunked — exactly Haiku's sweet spot. 3x cheaper output than Sonnet. If prose quality audits poorly, selectively promote *only* the top-level Context/Container views to Sonnet, leave the long tail on Haiku. |
| 5. Validator | **none** (deterministic) + Haiku for the 15% regen | regen reuses the view-refine tier |

**Net recommendation: mixed tier — Sonnet model-builder + Haiku view-refine.** Full gen ~$0.79, incremental ~$0.07. Add **batch API on CI** (not latency-sensitive) to roughly halve again.

---

## 8. Trigger decision (what this number decides)

| Option | Verdict | Economics |
|---|---|---|
| **Manual `/map` re-run** | **Default. Always safe.** | Each run $0.05–0.16. A human runs it occasionally; cost is noise. |
| **CI on push (incremental)** | **Economical and recommended *with two guardrails*** | At ≤20 pushes/day on a 200n/10v repo: ≤$3.20/day (Sonnet) / ≤$1.07/day (Haiku) / well under the $5/day line. |
| **CI on push (naive full regen every time)** | **Reject.** | $0.52–$1.55/run; crosses $5/day at 4–10 pushes/day; $228–$684/mo steady-state. The skip-unchanged-views design is what makes CI viable — do not ship CI without it. |
| **Pre-commit hook** | **Reject** (cost-independent reason). | Adds LLM latency to every commit; the research doc already leaned against it. Economics don't save it. |

**Two guardrails that make CI-on-push safe (they cap the bad-day tail from §6):**
1. **Debounce / coalesce** pushes — run at most once per N minutes per branch (or only on merge to the default branch), so a 50-push afternoon bills like a handful of runs, not 50.
2. **Per-run + daily spend cap** — skip the LLM stages and post a "diagram update deferred (budget)" check when a refactor would fan out to many views or the daily cap is hit. This neutralizes the worst-case "$5/day at 4 pushes" tail.

**Recommendation:** ship **manual `/map` as the default trigger**, and offer **opt-in CI-on-merge-to-default-branch with incremental + batch + Haiku-for-view-refine + a daily spend cap**. Do **not** offer a pre-commit hook. This finding **does not flip ADR-0001's renderer direction** — it resolves the deferred *trigger* sub-decision in favor of "manual default + economical opt-in CI," exactly the workflow's prior lean, now with numbers.

---

## 9. Honesty / limitations

- This is a **parametric model, not a live API benchmark.** No tokens were actually billed. The arithmetic is exact and reproducible (`node model.mjs`); the *inputs* are estimates. The §6 sweep brackets the realistic range.
- The most uncertain input is **view-refine output tokens/node** (prose volume) — directly tied to the unresolved "beauty on a blank canvas" question. If Phase-1 prose runs long, costs scale linearly with it; even at 600 tok/node a full Haiku gen is <$1.
- Caching assumes the system block is genuinely stable across calls in a run (it is, by design) and that calls land within the 5-min window (parallel view-refine calls do).
- Real-world wrinkle not modelled: **thinking/reasoning tokens** if extended thinking is enabled on model-builder — would add output-priced tokens to that one call. Keep thinking off for view-refine.
- A true live benchmark (run the real pipeline against the `software-factory` testbed and read `usage` from the API response) is the natural Phase-1 follow-up to replace these estimates with measured numbers.

---

## Reproduce

```
node /Volumes/home-ext/projects/repo-to-likec4/spike/phase0/token-cost/model.mjs
node /Volumes/home-ext/projects/repo-to-likec4/spike/phase0/token-cost/sensitivity.mjs
```
