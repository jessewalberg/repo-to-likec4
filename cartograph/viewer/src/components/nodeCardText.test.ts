import assert from 'node:assert/strict'
import { test } from 'node:test'
import { nodeAriaLabel, parentDirCrumb, techTag } from './nodeCardText.ts'

test('techTag: abbreviates known languages (JavaScript -> JS)', () => {
  assert.equal(techTag('JavaScript'), 'JS')
  assert.equal(techTag('TypeScript'), 'TS')
  assert.equal(techTag('Python'), 'Py')
})

test('techTag: passes through unknown techs trimmed', () => {
  assert.equal(techTag('  Elixir '), 'Elixir')
})

test('techTag: absent/blank tech collapses to null (slot hidden)', () => {
  assert.equal(techTag(undefined), null)
  assert.equal(techTag(''), null)
  assert.equal(techTag('   '), null)
})

test('parentDirCrumb: returns parent dir of a metadata path', () => {
  assert.equal(parentDirCrumb('tools/factory/cli.mjs'), 'tools/factory')
  assert.equal(parentDirCrumb('lib/policy.mjs'), 'lib')
})

test('parentDirCrumb: bare filename or absent path collapses to null', () => {
  assert.equal(parentDirCrumb('cli.mjs'), null)
  assert.equal(parentDirCrumb(undefined), null)
  assert.equal(parentDirCrumb(''), null)
  assert.equal(parentDirCrumb('/'), null)
})

test('parentDirCrumb: normalises backslashes and trailing slash', () => {
  assert.equal(parentDirCrumb('tools\\factory\\cli.mjs'), 'tools/factory')
  assert.equal(parentDirCrumb('tools/factory/'), 'tools')
})

test('nodeAriaLabel: composes CONTRACT §9 label with lane + counts', () => {
  assert.equal(
    nodeAriaLabel({ label: 'cli.mjs', kind: 'external', zone: 'Root', importsCount: 3, importedByCount: 2 }),
    'cli.mjs, external, in Root lane, imports 3, imported by 2',
  )
})

test('nodeAriaLabel: drops lane clause when zone absent', () => {
  assert.equal(
    nodeAriaLabel({ label: 'index.mjs', kind: 'external', importsCount: 0, importedByCount: 0 }),
    'index.mjs, external, imports 0, imported by 0',
  )
})

test('nodeAriaLabel: never speaks NaN/undefined counts', () => {
  assert.equal(
    nodeAriaLabel({ label: 'x', kind: 'external', importsCount: Number.NaN, importedByCount: -1 }),
    'x, external, imports 0, imported by 0',
  )
})
