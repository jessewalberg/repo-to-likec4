import assert from 'node:assert/strict'
import { test } from 'node:test'
import { iconFor, normalizeTech } from './icons.ts'

test('normalizeTech: lowercases, strips noise, resolves aliases', () => {
  assert.equal(normalizeTech('JavaScript'), 'javascript')
  assert.equal(normalizeTech('TS'), 'typescript')
  assert.equal(normalizeTech('Node.js'), 'node')
  assert.equal(normalizeTech('  Golang '), 'go')
  assert.equal(normalizeTech(undefined), '')
})

test('iconFor: exact tech match -> brand slug', () => {
  assert.deepEqual(iconFor({ type: 'component', data: { technology: 'JavaScript' } }), { kind: 'brand', slug: 'javascript' })
  assert.deepEqual(iconFor({ type: 'service', data: { technology: 'Postgres' } }), { kind: 'brand', slug: 'postgresql' })
})

test('iconFor: no certain brand -> neutral lucide glyph by type (never a wrong brand)', () => {
  assert.deepEqual(iconFor({ type: 'datastore', data: { technology: 'SomeProprietaryDB' } }), { kind: 'lucide', name: 'database' })
  assert.deepEqual(iconFor({ type: 'service' }), { kind: 'lucide', name: 'server' })
  assert.deepEqual(iconFor({ type: 'totally-unknown' }), { kind: 'lucide', name: 'box' })
})

test('iconFor: explicit manifest icon overrides as a brand slug', () => {
  assert.deepEqual(iconFor({ type: 'service', data: { icon: 'Redis' } }), { kind: 'brand', slug: 'redis' })
})
