import assert from 'node:assert/strict'
import { test } from 'node:test'
import { detectRenames } from './rename-detect.ts'
import { type Manifest, emptyManifest } from './schema.ts'

function man(nodeIds: string[], edges: [string, string][], over: Partial<Manifest> = {}): Manifest {
  const m = emptyManifest()
  for (const id of nodeIds) m.nodes[id] = { id, type: 'component', origin: 'machine', data: { label: id } }
  for (const [s, t] of edges) m.edges[`${s}->${t}`] = { id: `${s}->${t}`, source: s, target: t, type: 'imports' }
  return { ...m, ...over }
}

test('detectRenames: a moved file (same stem + same neighborhood) is aliased', () => {
  const OLD = 'module:lib/dag.mjs'
  const NEW = 'module:lib/graph/dag.mjs'
  const t0 = man([OLD, 'a', 'b'], [['a', OLD], [OLD, 'b']])
  const t1 = man([NEW, 'a', 'b'], [['a', NEW], [NEW, 'b']])
  assert.deepEqual(detectRenames(t0, t1), { [OLD]: NEW })
})

test('detectRenames: a genuinely-new split module is NOT aliased', () => {
  // policy.mjs stays; policy-rules.mjs is brand new (different stem, partial neighborhood).
  const t0 = man(['module:policy.mjs', 'gate'], [['gate', 'module:policy.mjs']])
  const t1 = man(['module:policy.mjs', 'module:policy-rules.mjs', 'gate'], [
    ['gate', 'module:policy.mjs'],
    ['module:policy.mjs', 'module:policy-rules.mjs'],
  ])
  assert.deepEqual(detectRenames(t0, t1), {}, 'no false alias for the new split module')
})

test('detectRenames: a vanished human-authored node is never aliased', () => {
  const t0 = man(['x'], [])
  t0.nodes['note:roadmap'] = { id: 'note:roadmap', type: 'decision', origin: 'human', data: { label: 'note' } }
  const t1 = man(['x', 'module:new.mjs'], [])
  assert.deepEqual(detectRenames(t0, t1), {}, 'human node disappearance is not a rename')
})

test('detectRenames: no change -> no aliases', () => {
  const t0 = man(['a', 'b'], [['a', 'b']])
  assert.deepEqual(detectRenames(t0, t0), {})
})
