import assert from 'node:assert/strict'
import { test } from 'node:test'
import { kindForType, manifestToFlow, variantForEdge, zoneForLane } from './manifestToFlow.ts'
import type { Manifest, View } from './types.ts'

function baseManifest(): Manifest {
  return {
    schemaVersion: 2,
    meta: { repo: 'demo' },
    nodes: {},
    edges: {},
    suppressions: { nodes: [], edges: [] },
    idAliases: {},
    groups: {
      'lane:root': { id: 'lane:root', label: 'Root', laneType: 'layer' },
      'lane:lib': { id: 'lane:lib', label: 'lib', laneType: 'layer' },
    },
    views: [],
  }
}

function fixture(): { manifest: Manifest; view: View } {
  const manifest = baseManifest()
  manifest.nodes = {
    'm:cli': { id: 'm:cli', type: 'component', parentId: 'lane:root', data: { label: 'cli.mjs', technology: 'JavaScript', metadata: { path: 'tools/factory/cli.mjs' }, confidence: 'static' }, width: 220, height: 72 },
    'm:dag': { id: 'm:dag', type: 'component', parentId: 'lane:lib', data: { label: 'dag.mjs', technology: 'JavaScript', confidence: 'static' }, width: 220, height: 72 },
  }
  manifest.edges = {
    'e1': { id: 'e1', source: 'm:cli', target: 'm:dag', type: 'imports' },
    'e:out': { id: 'e:out', source: 'm:cli', target: 'm:missing', type: 'imports' }, // out of view
  }
  const view: View = {
    id: 'components',
    title: 'Components',
    nodeIds: ['m:cli', 'm:dag'],
    layoutDir: 'DOWN',
    layout: {
      'lane:root': { x: 200, y: 40, w: 600, h: 160 },
      'lane:lib': { x: 200, y: 240, w: 900, h: 200 },
      'm:cli': { x: 24, y: 44 }, // lane-LOCAL
      'm:dag': { x: 24, y: 44 },
    },
  }
  manifest.views = [view]
  return { manifest, view }
}

test('kindForType: component aliases to external; service stays service; unknown -> external', () => {
  assert.equal(kindForType('component'), 'external')
  assert.equal(kindForType('service'), 'service')
  assert.equal(kindForType('datastore'), 'datastore')
  assert.equal(kindForType('totally-unknown'), 'external')
})

test('zoneForLane: even index -> a, odd -> b', () => {
  const order = ['lane:root', 'lane:lib']
  assert.equal(zoneForLane('lane:root', order), 'a')
  assert.equal(zoneForLane('lane:lib', order), 'b')
  assert.equal(zoneForLane('not-present', order), 'a') // index -1 treated as 0
})

test('variantForEdge: imports->sync, writes->data, emits->async, default->sync', () => {
  assert.equal(variantForEdge('imports'), 'sync')
  assert.equal(variantForEdge('writes'), 'data')
  assert.equal(variantForEdge('emits'), 'async')
  assert.equal(variantForEdge('weird'), 'sync')
})

test('manifestToFlow: lanes emitted before their children (RF parent-precedes-child rule)', () => {
  const { manifest, view } = fixture()
  const { nodes } = manifestToFlow(view, manifest)
  const idx = (id: string) => nodes.findIndex((n) => n.id === id)
  assert.ok(idx('lane:root') < idx('m:cli'), 'root lane before its child')
  assert.ok(idx('lane:lib') < idx('m:dag'), 'lib lane before its child')
  assert.equal(nodes.filter((n) => n.type === 'lane').length, 2)
})

test('manifestToFlow: card keeps lane-LOCAL position; lane carries absolute + size', () => {
  const { manifest, view } = fixture()
  const { nodes } = manifestToFlow(view, manifest)
  const cli = nodes.find((n) => n.id === 'm:cli')!
  const root = nodes.find((n) => n.id === 'lane:root')!
  assert.deepEqual(cli.position, { x: 24, y: 44 }, 'card position is lane-local, not double-offset')
  assert.equal(cli.parentId, 'lane:root')
  assert.deepEqual(root.position, { x: 200, y: 40 }, 'lane carries the absolute offset')
  assert.equal(root.width, 600)
  assert.equal(root.height, 160)
})

test('manifestToFlow: card data carries kind/zone/tech/path/degree; never NaN', () => {
  const { manifest, view } = fixture()
  const { nodes } = manifestToFlow(view, manifest)
  const cli = nodes.find((n) => n.id === 'm:cli')!
  const d = cli.data as Record<string, unknown>
  assert.equal(d.kind, 'external')
  assert.equal(d.zone, 'a')
  assert.equal(d.technology, 'JavaScript')
  assert.equal(d.metadataPath, 'tools/factory/cli.mjs')
  assert.equal(d.importsCount, 1, 'cli imports dag (in-view)')
  assert.equal(d.importedByCount, 0)
  assert.ok(Number.isFinite(cli.position.x) && Number.isFinite(cli.position.y))
})

test('manifestToFlow: lane data carries count + descriptor disambiguation', () => {
  const { manifest, view } = fixture()
  const { nodes } = manifestToFlow(view, manifest)
  const root = nodes.find((n) => n.id === 'lane:root')!.data as Record<string, unknown>
  assert.equal(root.count, 1)
  assert.equal(root.descriptor, 'entry-point runners', '"Root" disambiguated, not the repo root')
})

test('manifestToFlow: only in-view edges; mapped to sync variant with arrow marker', () => {
  const { manifest, view } = fixture()
  const { edges } = manifestToFlow(view, manifest)
  assert.equal(edges.length, 1, 'out-of-view edge dropped')
  assert.equal(edges[0].type, 'sync')
  assert.equal((edges[0].data as Record<string, unknown>).variant, 'sync')
  assert.ok(edges[0].markerEnd)
})

test('manifestToFlow: suppressed nodes/edges are excluded from the rendered graph', () => {
  const { manifest, view } = fixture()
  manifest.suppressions = { nodes: ['m:dag'], edges: [] }
  const { nodes, edges } = manifestToFlow(view, manifest)
  assert.ok(!nodes.some((n) => n.id === 'm:dag'), 'suppressed node hidden')
  assert.equal(edges.length, 0, 'an edge incident to a suppressed node is dropped')
})

test('manifestToFlow: missing node w/h falls back to 220x72 (no NaN)', () => {
  const { manifest, view } = fixture()
  delete manifest.nodes['m:dag'].width
  delete manifest.nodes['m:dag'].height
  const { nodes } = manifestToFlow(view, manifest)
  const dag = nodes.find((n) => n.id === 'm:dag')!
  assert.equal(dag.width, 220)
  assert.equal(dag.height, 72)
})
