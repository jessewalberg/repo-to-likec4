import assert from 'node:assert/strict'
import { test } from 'node:test'
import { TOKENS, estimateRefineCost } from './cost.ts'

test('estimateRefineCost: full run = one call per node; incremental scales by changed fraction', () => {
  const est = estimateRefineCost(200, { model: 'haiku', changedFraction: 0.15 })
  assert.equal(est.full.calls, 200)
  assert.equal(est.incremental.calls, 30, '15% of 200')
  assert.ok(est.full.usd > est.incremental.usd, 'incremental is cheaper')
})

test('estimateRefineCost: token math matches the per-call sizes + Haiku rates', () => {
  const est = estimateRefineCost(10, { model: 'haiku' })
  assert.equal(est.full.inputTokens, 10 * (TOKENS.system + TOKENS.factsPerNode))
  assert.equal(est.full.outputTokens, 10 * TOKENS.outputPerNode)
  // 10 nodes: in = 10*330=3300, out = 10*200=2000 -> $1*0.0033 + $5*0.002 = 0.0133
  assert.ok(Math.abs(est.full.usd - 0.0133) < 1e-6, `got ${est.full.usd}`)
})

test('estimateRefineCost: sonnet costs more than haiku for the same graph', () => {
  const h = estimateRefineCost(50, { model: 'haiku' }).full.usd
  const s = estimateRefineCost(50, { model: 'sonnet' }).full.usd
  assert.ok(s > h, 'sonnet pricier')
})

test('estimateRefineCost: at least one incremental call even for a tiny graph', () => {
  assert.equal(estimateRefineCost(1).incremental.calls, 1)
})
