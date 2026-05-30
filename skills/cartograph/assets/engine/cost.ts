import { readFileSync } from 'node:fs'

// Token-cost estimator for a view-refine run. Recon/model/layout/validate are
// deterministic ($0); the only LLM cost is view-refine (one call per node). This
// models that cost from node count + measured prompt sizes, full vs incremental,
// so a user can decide between manual /map and opt-in CI. (The `claude` CLI also
// returns real per-call usage in its JSON envelope — this is the up-front estimate.)

export interface ModelRate {
  name: string
  inPerMTok: number // USD per 1M input tokens
  outPerMTok: number // USD per 1M output tokens
}

// Phase-0 pricing (per MTok). view-refine is tiered to Haiku.
export const RATES: Record<string, ModelRate> = {
  haiku: { name: 'Haiku 4.5', inPerMTok: 1, outPerMTok: 5 },
  sonnet: { name: 'Sonnet 4.6', inPerMTok: 3, outPerMTok: 15 },
}

// Measured-ish per-call token sizes for the refine prompt (system + per-node
// facts in, summary + short doc page out). The CLI re-sends the system each call
// (no cross-call cache), so input is system + facts every time.
export const TOKENS = {
  system: 260, // refine-cli SYSTEM block
  factsPerNode: 70, // label/tech/path/imports/importedby
  outputPerNode: 200, // summary + a few-sentence page
}

export interface RunCost {
  calls: number
  inputTokens: number
  outputTokens: number
  usd: number
}

export interface CostEstimate {
  model: string
  nodes: number
  full: RunCost
  incremental: RunCost
  changedFraction: number
}

function runCost(calls: number, rate: ModelRate): RunCost {
  const inputTokens = calls * (TOKENS.system + TOKENS.factsPerNode)
  const outputTokens = calls * TOKENS.outputPerNode
  const usd = (inputTokens / 1e6) * rate.inPerMTok + (outputTokens / 1e6) * rate.outPerMTok
  return { calls, inputTokens, outputTokens, usd: Math.round(usd * 10000) / 10000 }
}

export function estimateRefineCost(
  nodeCount: number,
  opts: { model?: keyof typeof RATES; changedFraction?: number } = {},
): CostEstimate {
  const rate = RATES[opts.model ?? 'haiku']
  const changedFraction = opts.changedFraction ?? 0.15
  return {
    model: rate.name,
    nodes: nodeCount,
    full: runCost(nodeCount, rate),
    incremental: runCost(Math.max(1, Math.ceil(nodeCount * changedFraction)), rate),
    changedFraction,
  }
}

// ---- CLI: estimate from an existing architecture.json ----
function arg(name: string, def?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : def
}

if (process.argv[1]?.endsWith('cost.ts')) {
  const file = arg('manifest', 'out/architecture.json')!
  const model = (arg('model', 'haiku') as keyof typeof RATES) ?? 'haiku'
  const m = JSON.parse(readFileSync(file, 'utf8')) as { nodes: Record<string, unknown> }
  const est = estimateRefineCost(Object.keys(m.nodes).length, { model })
  const fmt = (c: RunCost) => `${c.calls} calls, ${c.inputTokens}+${c.outputTokens} tok, ~$${c.usd.toFixed(4)}`
  console.log(`view-refine cost estimate (${est.model}), ${est.nodes} nodes:`)
  console.log(`  full run:        ${fmt(est.full)}`)
  console.log(`  incremental (~${Math.round(est.changedFraction * 100)}% changed): ${fmt(est.incremental)}`)
}
