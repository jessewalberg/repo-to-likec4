import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildTours } from './tours.ts'
import { type Manifest, emptyManifest } from './schema.ts'

function fixture(): Manifest {
  const m = emptyManifest()
  m.groups = { 'lane:root': { id: 'lane:root', label: 'Root' }, 'lane:lib': { id: 'lane:lib', label: 'lib' } }
  m.nodes.cli = { id: 'cli', type: 'component', parentId: 'lane:root', data: { label: 'cli.mjs' } }
  m.nodes.dag = { id: 'dag', type: 'component', parentId: 'lane:lib', data: { label: 'dag.mjs' } }
  m.nodes.util = { id: 'util', type: 'component', parentId: 'lane:lib', data: { label: 'util.mjs' } }
  m.nodes['container:root'] = { id: 'container:root', type: 'container', data: { label: 'Root', metadata: { modules: 1 } } }
  m.nodes['container:lib'] = { id: 'container:lib', type: 'container', data: { label: 'lib', metadata: { modules: 2 } } }
  m.edges['cli->dag'] = { id: 'cli->dag', source: 'cli', target: 'dag', type: 'imports' }
  m.edges['cli->util'] = { id: 'cli->util', source: 'cli', target: 'util', type: 'imports' }
  m.edges['dag->util'] = { id: 'dag->util', source: 'dag', target: 'util', type: 'imports' }
  return m
}

test('buildTours: emits the three role tours', () => {
  const { tours } = buildTours(fixture())
  assert.deepEqual(tours.map((t) => t.id), ['understand', 'fix-bug', 'add-feature'])
  for (const t of tours) assert.ok(t.steps.length >= 1, `${t.id} has steps`)
})

test('understand: an intro step + entry-point step for cli (nothing imports it)', () => {
  const { tours } = buildTours(fixture())
  const understand = tours.find((t) => t.id === 'understand')!
  assert.equal(understand.steps[0].nodeId, undefined, 'first step is a node-less intro')
  assert.ok(understand.steps.some((s) => s.nodeId === 'cli' && /entry point/i.test(s.title)), 'cli flagged as an entry point')
})

test('fix-bug: focuses the most-connected module and one of its imports', () => {
  const { tours } = buildTours(fixture())
  const fix = tours.find((t) => t.id === 'fix-bug')!
  const focused = fix.steps.filter((s) => s.nodeId).map((s) => s.nodeId)
  assert.ok(focused.includes('util') || focused.includes('cli'), 'walks a hub + its imports')
  assert.ok(fix.steps.every((s) => s.body.length > 0), 'every step has grounded prose')
})

test('add-feature: a step per container area with module counts', () => {
  const { tours } = buildTours(fixture())
  const add = tours.find((t) => t.id === 'add-feature')!
  const areas = add.steps.filter((s) => s.nodeId).map((s) => s.nodeId)
  assert.deepEqual(areas.sort(), ['container:lib', 'container:root'], 'one step per container')
  assert.ok(add.steps.some((s) => /2 modules/.test(s.body)), 'counts surfaced from container metadata')
})
