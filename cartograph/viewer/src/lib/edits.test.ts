import assert from 'node:assert/strict'
import { test } from 'node:test'
import { annotateNode, moveNode, renameNode, setPinned, setSuppressedEdge, setSuppressedNode } from './edits.ts'
import type { Manifest } from './types.ts'

function m(): Manifest {
  return {
    schemaVersion: 2,
    nodes: { a: { id: 'a', type: 'component', data: { label: 'a.mjs', provenance: {} } } },
    edges: { e1: { id: 'e1', source: 'a', target: 'b', type: 'imports' } },
    suppressions: { nodes: [], edges: [] },
    idAliases: {},
    groups: {},
    views: [{ id: 'components', title: 'C', nodeIds: ['a'], layout: { a: { x: 1, y: 2 } } }],
  }
}

test('moveNode: updates the view position and pins the node; original untouched (immutable)', () => {
  const before = m()
  const after = moveNode(before, 'components', 'a', { x: 100, y: 200 })
  assert.deepEqual(after.views[0].layout.a, { x: 100, y: 200 })
  assert.equal(after.nodes.a.data.pinned, true, 'human-placed -> pinned')
  assert.deepEqual(before.views[0].layout.a, { x: 1, y: 2 }, 'input not mutated')
})

test('renameNode: sets label and flips provenance.label to human', () => {
  const after = renameNode(m(), 'a', 'Primary')
  assert.equal(after.nodes.a.data.label, 'Primary')
  assert.equal(after.nodes.a.data.provenance?.label, 'human')
})

test('annotateNode: sets/clears annotation with human provenance', () => {
  const a1 = annotateNode(m(), 'a', '  keep for Q3  ')
  assert.equal(a1.nodes.a.data.annotation, 'keep for Q3')
  assert.equal(a1.nodes.a.data.provenance?.annotation, 'human')
  const a2 = annotateNode(a1, 'a', '   ')
  assert.equal(a2.nodes.a.data.annotation, undefined, 'empty clears the annotation')
})

test('setPinned: toggles the pin flag', () => {
  assert.equal(setPinned(m(), 'a', true).nodes.a.data.pinned, true)
  assert.equal(setPinned(m(), 'a', false).nodes.a.data.pinned, false)
})

test('suppression: hide/unhide a node and an edge', () => {
  const hidden = setSuppressedNode(m(), 'a', true)
  assert.deepEqual(hidden.suppressions.nodes, ['a'])
  assert.deepEqual(setSuppressedNode(hidden, 'a', false).suppressions.nodes, [], 'unhide removes it')
  assert.deepEqual(setSuppressedEdge(m(), 'e1', true).suppressions.edges, ['e1'])
})
