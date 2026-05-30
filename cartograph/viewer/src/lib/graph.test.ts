import assert from 'node:assert/strict'
import { test } from 'node:test'
import { importedBy, importsOf, laneCounts, laneOf, neighborsOf, presentEdgeVariants, presentKinds } from './graph.ts'
import type { Manifest, View } from './types.ts'

function setup(): { manifest: Manifest; view: View } {
  const manifest: Manifest = {
    schemaVersion: 2,
    nodes: {
      a: { id: 'a', type: 'component', parentId: 'lane:root', data: { label: 'a' } },
      b: { id: 'b', type: 'service', parentId: 'lane:lib', data: { label: 'b' } },
      c: { id: 'c', type: 'datastore', parentId: 'lane:lib', data: { label: 'c' } },
    },
    edges: {
      'a->b': { id: 'a->b', source: 'a', target: 'b', type: 'imports' },
      'a->c': { id: 'a->c', source: 'a', target: 'c', type: 'writes' },
      'b->c': { id: 'b->c', source: 'b', target: 'c', type: 'imports' },
    },
    suppressions: { nodes: [], edges: [] },
    idAliases: {},
    groups: {
      'lane:root': { id: 'lane:root', label: 'Root' },
      'lane:lib': { id: 'lane:lib', label: 'lib' },
    },
    views: [],
  }
  const view: View = { id: 'v', title: 'V', nodeIds: ['a', 'b', 'c'], layout: {} }
  return { manifest, view }
}

test('importsOf / importedBy: directional neighbors resolved to nodes', () => {
  const { manifest } = setup()
  assert.deepEqual(importsOf(manifest, 'a').map((n) => n.id), ['b', 'c'])
  assert.deepEqual(importedBy(manifest, 'c').map((n) => n.id), ['a', 'b'])
  assert.deepEqual(importsOf(manifest, 'c').map((n) => n.id), [], 'c imports nothing')
})

test('neighborsOf: undirected union', () => {
  const { manifest } = setup()
  assert.deepEqual([...neighborsOf(manifest, 'a')].sort(), ['b', 'c'])
  assert.deepEqual([...neighborsOf(manifest, 'c')].sort(), ['a', 'b'])
})

test('laneOf: resolves a node to its group', () => {
  const { manifest } = setup()
  assert.equal(laneOf(manifest, 'a')?.label, 'Root')
  assert.equal(laneOf(manifest, 'b')?.label, 'lib')
})

test('laneCounts: members per lane in the view', () => {
  const { manifest, view } = setup()
  assert.deepEqual(laneCounts(manifest, view), { 'lane:root': 1, 'lane:lib': 2 })
})

test('presentKinds: distinct kinds in first-seen order (component->external)', () => {
  const { manifest, view } = setup()
  assert.deepEqual(presentKinds(manifest, view), ['external', 'service', 'datastore'])
})

test('presentEdgeVariants: distinct variants present in the view', () => {
  const { manifest, view } = setup()
  assert.deepEqual(presentEdgeVariants(manifest, view).sort(), ['data', 'sync'])
})
