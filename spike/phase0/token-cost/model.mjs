#!/usr/bin/env node
/**
 * Cartograph incremental-run token-cost model.
 *
 * Models ONE run of the 5-stage pipeline (recon -> model-builder -> layout ->
 * view-refine -> validate) for a ~200-node, ~10-view repo, and compares the
 * $ cost of a FULL generation vs an INCREMENTAL run for Sonnet 4.6 and Haiku 4.5.
 *
 * Pricing source: https://platform.claude.com/docs/en/about-claude/pricing
 * (fetched 2026-05-29). Prices in USD per 1,000,000 tokens (MTok).
 *
 * Stages that consume LLM tokens:
 *   - Stage 2 Model Builder: recon facts -> typed nodes/edges JSON. ONE call.
 *   - Stage 4 View-Refine: ONE LLM call PER VIEW (parallel), writes summary/
 *     description/labels for the nodes in that view. This is the dominant cost.
 * Stages 1 (recon), 3 (layout/elkjs), 5 (validate) are deterministic = 0 LLM.
 * Stage 5 only re-invokes the LLM on a validation FAILURE (targeted regen);
 * modelled as a probabilistic retry surcharge.
 */

// ---------------------------------------------------------------------------
// PRICING (USD per MTok) — official Anthropic pricing page, 2026-05-29
// ---------------------------------------------------------------------------
const MTOK = 1_000_000;
const PRICING = {
  'opus-4.7':   { in: 5.0,  out: 25.0, cacheWrite5m: 6.25, cacheRead: 0.50 },
  'sonnet-4.6': { in: 3.0,  out: 15.0, cacheWrite5m: 3.75, cacheRead: 0.30 },
  'haiku-4.5':  { in: 1.0,  out: 5.0,  cacheWrite5m: 1.25, cacheRead: 0.10 },
};
// Batch API = 50% off input AND output (no time-sensitivity needed for CI docs).
const BATCH_DISCOUNT = 0.5;

// ---------------------------------------------------------------------------
// REPO SHAPE — the spike target: ~200 nodes, ~10 views
// ---------------------------------------------------------------------------
const REPO = {
  nodes: 200,
  views: 10,
  edges: 300,          // ~1.5x nodes is typical for an arch graph
  avgNodesPerView: 25, // 200 nodes spread/overlapping across 10 C4-ladder views
};

// ---------------------------------------------------------------------------
// TOKEN ASSUMPTIONS  (the load-bearing estimates — documented in ESTIMATE.md)
// All counts are tokens. "~4 chars/token" per Anthropic's own rule of thumb.
// ---------------------------------------------------------------------------
const T = {
  // System / instruction prompt shared by every LLM call. Held STABLE so it
  // can be prompt-cached (cache-write once, cache-read on every later call).
  systemPrompt: 2500,        // skill instructions + schema + style guide + few-shot

  // ---- Stage 2: Model Builder (ONE call) ----
  // IN: the deterministic recon facts for the whole repo (node inventory,
  //     boundary edges, paths, langs, loc, churn). Compact JSONL-ish.
  // OUT: typed nodes+edges manifest skeleton (no prose yet), stable IDs.
  modelBuilder_inPerNode: 60,   // recon fact line per node fed in
  modelBuilder_inPerEdge: 25,
  modelBuilder_outPerNode: 70,  // {id,type,parentId,data:{label,tech,icon,path,links,metadata}}
  modelBuilder_outPerEdge: 35,

  // ---- Stage 4: View-Refine (ONE call PER VIEW) ----
  // IN per call: the manifest SLICE for that view's nodes/edges (skeleton from
  //     stage 2) — NOT the whole manifest. The agent passes only the slice.
  // OUT per call: summary (1-2 sentences) + description (markdown) + refined
  //     labels for each node in the view + edge labels.
  viewRefine_inPerNode: 90,     // skeleton node + neighborhood context fed in
  viewRefine_inPerEdge: 30,
  viewRefine_inViewFraming: 400, // per-view: title, layoutDir, intent, what-to-emphasize
  viewRefine_outPerNode: 220,   // summary + ~markdown description + label  (prose-heavy)
  viewRefine_outPerEdge: 25,    // edge label / sentence

  // ---- Stage 5: validation-failure retry surcharge ----
  validationRetryRate: 0.15,    // 15% of view-refine calls regen a small subgraph
  validationRetrySizeFraction: 0.3, // a retry reprocesses ~30% of a view
};

// ---------------------------------------------------------------------------
// INCREMENTAL CHURN — what one "typical push" actually changes
// ---------------------------------------------------------------------------
const CHURN = {
  changedFilesFraction: 0.05,   // a typical push touches ~5% of files
  // -> which maps to changed nodes; a changed file's node + its view(s).
  changedNodesFraction: 0.05,   // ~10 of 200 nodes touched
  // A changed node appears in ~1.5 views on average (a node lives in context +
  // its container view). So changed views = clamp(changedNodes * 1.5 / avg, ...)
  viewsPerChangedNode: 1.5,
};

// ---------------------------------------------------------------------------
// COST HELPERS
// ---------------------------------------------------------------------------
function dollars(tokens, ratePerMTok) { return (tokens / MTOK) * ratePerMTok; }

/**
 * Cost of N LLM calls that share one cached system prompt.
 * - First call writes the system prompt to cache (cacheWrite5m rate).
 * - Every call reads it back (cacheRead rate) — net of the writing call we
 *   model: 1 write + N reads of the system block. (Conservative: we still pay
 *   a read on the writing call too; difference is sub-cent.)
 * - The per-call variable input (manifest slice) is NOT cached (changes each call).
 */
function callsCost({ model, nCalls, sysTokens, varInPerCall, outPerCall, batch }) {
  const p = PRICING[model];
  const inRate  = batch ? p.in  * (1 - BATCH_DISCOUNT) : p.in;
  const outRate = batch ? p.out * (1 - BATCH_DISCOUNT) : p.out;
  // Cache write/read rates do NOT get the batch discount stacked here for
  // simplicity in the cached path; we report a non-batch cached path and a
  // batch non-cached path separately to bracket the true number.
  if (nCalls <= 0) return { input: 0, cache: 0, output: 0, total: 0 };

  let cacheCost = 0;
  let inputCost = 0;
  if (!batch) {
    // cached system prompt path
    cacheCost += dollars(sysTokens, p.cacheWrite5m);          // write once
    cacheCost += dollars(sysTokens * nCalls, p.cacheRead);    // read every call
    inputCost += dollars(varInPerCall * nCalls, inRate);      // variable slice, uncached
  } else {
    // batch path: no caching, system prompt re-sent each call at discounted input
    inputCost += dollars((sysTokens + varInPerCall) * nCalls, inRate);
  }
  const outputCost = dollars(outPerCall * nCalls, outRate);
  return {
    input: inputCost,
    cache: cacheCost,
    output: outputCost,
    total: inputCost + cacheCost + outputCost,
  };
}

// ---------------------------------------------------------------------------
// STAGE TOKEN COMPUTATION
// ---------------------------------------------------------------------------
function modelBuilderTokens(nodes, edges) {
  const varIn =
    nodes * T.modelBuilder_inPerNode + edges * T.modelBuilder_inPerEdge;
  const out =
    nodes * T.modelBuilder_outPerNode + edges * T.modelBuilder_outPerEdge;
  return { varIn, out };
}

function viewRefinePerCallTokens(nodesInView, edgesInView) {
  const varIn =
    T.viewRefine_inViewFraming +
    nodesInView * T.viewRefine_inPerNode +
    edgesInView * T.viewRefine_inPerEdge;
  const out =
    nodesInView * T.viewRefine_outPerNode +
    edgesInView * T.viewRefine_outPerEdge;
  return { varIn, out };
}

// edges within a view scale with nodes in view (~1.2x here for a focused view)
function edgesInView(nodesInView) { return Math.round(nodesInView * 1.2); }

// ---------------------------------------------------------------------------
// FULL GENERATION
// ---------------------------------------------------------------------------
function fullRun(model, repo, { batch = false } = {}) {
  const nodesPerView = repo.avgNodesPerView;
  const eInView = edgesInView(nodesPerView);

  // Stage 2: one model-builder call over the whole repo
  const mb = modelBuilderTokens(repo.nodes, repo.edges);
  const mbCost = callsCost({
    model, nCalls: 1, sysTokens: T.systemPrompt,
    varInPerCall: mb.varIn, outPerCall: mb.out, batch,
  });

  // Stage 4: one view-refine call per view
  const vr = viewRefinePerCallTokens(nodesPerView, eInView);
  const baseViewCost = callsCost({
    model, nCalls: repo.views, sysTokens: T.systemPrompt,
    varInPerCall: vr.varIn, outPerCall: vr.out, batch,
  });

  // Stage 5: validation-retry surcharge on view-refine
  const retryCalls = repo.views * T.validationRetryRate;
  const retryCost = callsCost({
    model, nCalls: retryCalls, sysTokens: T.systemPrompt,
    varInPerCall: vr.varIn * T.validationRetrySizeFraction,
    outPerCall: vr.out * T.validationRetrySizeFraction, batch,
  });

  const total = mbCost.total + baseViewCost.total + retryCost.total;
  return {
    llmCalls: 1 + repo.views + retryCalls,
    perViewIn: vr.varIn + T.systemPrompt,
    perViewOut: vr.out,
    perViewTotalTokens: vr.varIn + T.systemPrompt + vr.out,
    breakdown: { modelBuilder: mbCost, viewRefine: baseViewCost, validationRetry: retryCost },
    total,
  };
}

// ---------------------------------------------------------------------------
// INCREMENTAL RUN  (skip-unchanged-views; only changed files' views regen)
// ---------------------------------------------------------------------------
function incrementalRun(model, repo, { batch = false } = {}) {
  const changedNodes = Math.max(1, Math.round(repo.nodes * CHURN.changedNodesFraction));
  const changedViews = Math.min(
    repo.views,
    Math.max(1, Math.round(changedNodes * CHURN.viewsPerChangedNode / repo.avgNodesPerView)),
  );

  // Stage 2 (model-builder) on an incremental run only re-types the CHANGED
  // nodes/edges (delta), via the provenance merge. Much smaller than full.
  const changedEdges = Math.round(repo.edges * CHURN.changedNodesFraction);
  const mb = modelBuilderTokens(changedNodes, changedEdges);
  const mbCost = callsCost({
    model, nCalls: 1, sysTokens: T.systemPrompt,
    varInPerCall: mb.varIn, outPerCall: mb.out, batch,
  });

  // Stage 4: only the changed views regenerate. (Unchanged views skipped = $0.)
  const nodesPerView = repo.avgNodesPerView;
  const eInView = edgesInView(nodesPerView);
  const vr = viewRefinePerCallTokens(nodesPerView, eInView);
  const viewCost = callsCost({
    model, nCalls: changedViews, sysTokens: T.systemPrompt,
    varInPerCall: vr.varIn, outPerCall: vr.out, batch,
  });

  const retryCalls = changedViews * T.validationRetryRate;
  const retryCost = callsCost({
    model, nCalls: retryCalls, sysTokens: T.systemPrompt,
    varInPerCall: vr.varIn * T.validationRetrySizeFraction,
    outPerCall: vr.out * T.validationRetrySizeFraction, batch,
  });

  const total = mbCost.total + viewCost.total + retryCost.total;
  return {
    changedNodes, changedViews,
    llmCalls: 1 + changedViews + retryCalls,
    total,
    breakdown: { modelBuilder: mbCost, viewRefine: viewCost, validationRetry: retryCost },
  };
}

// ---------------------------------------------------------------------------
// CI ECONOMICS: at what (nodes, views, pushes/day) does CI exceed $5/day?
// ---------------------------------------------------------------------------
function dailyCost(model, repo, pushesPerDay, { batch = false } = {}) {
  return incrementalRun(model, repo, { batch }).total * pushesPerDay;
}

// ---------------------------------------------------------------------------
// REPORT
// ---------------------------------------------------------------------------
function fmt(n) { return '$' + n.toFixed(4); }
function fmt2(n) { return '$' + n.toFixed(2); }

const models = ['sonnet-4.6', 'haiku-4.5'];

console.log('='.repeat(78));
console.log('CARTOGRAPH TOKEN-COST MODEL  — repo:', JSON.stringify(REPO));
console.log('Pricing src: platform.claude.com/docs/en/about-claude/pricing (2026-05-29)');
console.log('='.repeat(78));

for (const m of models) {
  console.log('\n### MODEL:', m, '  (in $' + PRICING[m].in + '/out $' + PRICING[m].out + ' /MTok)');
  for (const batch of [false, true]) {
    const tag = batch ? 'BATCH(-50%)' : 'STANDARD+cache';
    const full = fullRun(m, REPO, { batch });
    const inc = incrementalRun(m, REPO, { batch });
    console.log(`\n  [${tag}]`);
    console.log(`   per view-refine call: ~${full.perViewIn} tok in (incl ${T.systemPrompt} sys) + ${full.perViewOut} tok out  = ${full.perViewTotalTokens} tok`);
    console.log(`   FULL gen:  ${full.llmCalls.toFixed(1)} LLM calls  ->  ${fmt(full.total)}`);
    console.log(`              (model-builder ${fmt(full.breakdown.modelBuilder.total)} + view-refine ${fmt(full.breakdown.viewRefine.total)} + retry ${fmt(full.breakdown.validationRetry.total)})`);
    console.log(`   INCR run:  ${inc.changedNodes} changed nodes -> ${inc.changedViews} changed views, ${inc.llmCalls.toFixed(1)} LLM calls  ->  ${fmt(inc.total)}`);
    console.log(`              savings vs full: ${(100 * (1 - inc.total / full.total)).toFixed(0)}%`);
  }
}

// ---------------------------------------------------------------------------
// SCALING: find where CI-on-push gets uneconomical (>$5/day)
// ---------------------------------------------------------------------------
console.log('\n' + '='.repeat(78));
console.log('CI-ON-PUSH ECONOMICS — incremental run, STANDARD+cache pricing');
console.log('Daily cost = incremental-run cost x pushes/day. Threshold: $5/day.');
console.log('='.repeat(78));

const scenarios = [
  { nodes: 200,  views: 10, label: 'spike target' },
  { nodes: 500,  views: 20, label: 'mid repo' },
  { nodes: 1000, views: 30, label: 'large monorepo' },
];
const pushRates = [5, 20, 50, 100, 200];

for (const m of models) {
  console.log(`\n### ${m}`);
  console.log('  repo'.padEnd(26), pushRates.map(p => (p + '/day').padStart(10)).join(''));
  for (const sc of scenarios) {
    const repo = {
      nodes: sc.nodes, views: sc.views,
      edges: Math.round(sc.nodes * 1.5),
      avgNodesPerView: Math.round(sc.nodes / sc.views * 1.25),
    };
    const incOne = incrementalRun(m, repo).total;
    const row = pushRates.map(p => {
      const d = incOne * p;
      const mark = d > 5 ? '*' : ' ';
      return (fmt2(d) + mark).padStart(10);
    }).join('');
    console.log(`  ${(sc.label + ' ' + sc.nodes + 'n/' + sc.views + 'v').padEnd(24)}`, row, ` (1 run=${fmt(incOne)})`);
  }
}

// Find break-even pushes/day for the spike target on each model
console.log('\n  Break-even (>$5/day) for spike-target 200n/10v repo:');
for (const m of models) {
  const incOne = incrementalRun(m, REPO).total;
  const breakEven = Math.ceil(5 / incOne);
  const fullOne = fullRun(m, REPO).total;
  const breakEvenFull = Math.ceil(5 / fullOne);
  console.log(`   ${m}: incremental run = ${fmt(incOne)} -> ${breakEven} pushes/day to hit $5  |  full gen = ${fmt(fullOne)} -> ${breakEvenFull} full-runs/day to hit $5`);
}

// Monthly framing for "CI on every push" steady state
console.log('\n  Monthly (CI on every push, 20 pushes/day x 22 working days = 440 runs/mo):');
for (const m of models) {
  const incOne = incrementalRun(m, REPO).total;
  const fullOne = fullRun(m, REPO).total;
  console.log(`   ${m}: incremental ${fmt2(incOne * 440)}/mo  |  if every run were full: ${fmt2(fullOne * 440)}/mo`);
}

// Mixed-tier recommendation cost
console.log('\n' + '='.repeat(78));
console.log('MIXED-TIER (recommended): Sonnet for model-builder, Haiku for view-refine');
console.log('='.repeat(78));
function mixedFull(repo, { batch = false } = {}) {
  const mb = modelBuilderTokens(repo.nodes, repo.edges);
  const mbCost = callsCost({ model: 'sonnet-4.6', nCalls: 1, sysTokens: T.systemPrompt, varInPerCall: mb.varIn, outPerCall: mb.out, batch });
  const nodesPerView = repo.avgNodesPerView; const eInView = edgesInView(nodesPerView);
  const vr = viewRefinePerCallTokens(nodesPerView, eInView);
  const viewCost = callsCost({ model: 'haiku-4.5', nCalls: repo.views, sysTokens: T.systemPrompt, varInPerCall: vr.varIn, outPerCall: vr.out, batch });
  return mbCost.total + viewCost.total;
}
function mixedInc(repo, { batch = false } = {}) {
  const changedNodes = Math.max(1, Math.round(repo.nodes * CHURN.changedNodesFraction));
  const changedViews = Math.min(repo.views, Math.max(1, Math.round(changedNodes * CHURN.viewsPerChangedNode / repo.avgNodesPerView)));
  const changedEdges = Math.round(repo.edges * CHURN.changedNodesFraction);
  const mb = modelBuilderTokens(changedNodes, changedEdges);
  const mbCost = callsCost({ model: 'sonnet-4.6', nCalls: 1, sysTokens: T.systemPrompt, varInPerCall: mb.varIn, outPerCall: mb.out, batch });
  const nodesPerView = repo.avgNodesPerView; const eInView = edgesInView(nodesPerView);
  const vr = viewRefinePerCallTokens(nodesPerView, eInView);
  const viewCost = callsCost({ model: 'haiku-4.5', nCalls: changedViews, sysTokens: T.systemPrompt, varInPerCall: vr.varIn, outPerCall: vr.out, batch });
  return mbCost.total + viewCost.total;
}
console.log(`  FULL gen (200n/10v): ${fmt(mixedFull(REPO))}   INCR run: ${fmt(mixedInc(REPO))}`);
console.log(`  Break-even >$5/day (incremental): ${Math.ceil(5 / mixedInc(REPO))} pushes/day`);
console.log(`  Monthly @440 runs/mo (incremental): ${fmt2(mixedInc(REPO) * 440)}/mo`);
