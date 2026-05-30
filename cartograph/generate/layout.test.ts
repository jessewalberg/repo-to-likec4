import { test } from 'node:test'
import assert from 'node:assert/strict'
import { type ElkNode, buildElkGraph, extractPositions, layoutView } from './layout.ts'
import { type Manifest, emptyManifest } from './schema.ts'

// ---- extractPositions (pure) ----
test('extractPositions: lanes get root-relative x/y/w/h; children get lane-local x/y', () => {
  const laid: ElkNode = {
    id: 'root',
    children: [
      {
        id: 'lane:backend',
        x: 10,
        y: 20,
        width: 300,
        height: 180,
        children: [
          { id: 'api', x: 12, y: 22 },
          { id: 'db', x: 12, y: 100 },
        ],
      },
      { id: 'standalone', x: 400, y: 20, width: 220, height: 72 },
    ],
  }
  const pos = extractPositions(laid)
  assert.deepEqual(pos['lane:backend'], { x: 10, y: 20, w: 300, h: 180 }, 'lane root-relative + sized')
  assert.deepEqual(pos.api, { x: 12, y: 22 }, 'child lane-local')
  assert.deepEqual(pos.db, { x: 12, y: 100 })
  assert.deepEqual(pos.standalone, { x: 400, y: 20, w: 220, h: 72 }, 'ungrouped leaf sized too')
})

// ---- buildElkGraph (pure) ----
test('buildElkGraph: groups nodes under their lane and keeps only in-view edges', () => {
  const m = emptyManifest()
  m.nodes.a = { id: 'a', type: 'component', parentId: 'lane:lib', data: { label: 'a' }, width: 220, height: 72 }
  m.nodes.b = { id: 'b', type: 'component', parentId: 'lane:lib', data: { label: 'b' }, width: 220, height: 72 }
  m.nodes.c = { id: 'c', type: 'component', data: { label: 'c' }, width: 220, height: 72 } // ungrouped
  m.edges['a->b'] = { id: 'a->b', source: 'a', target: 'b', type: 'imports' }
  m.edges['a->x'] = { id: 'a->x', source: 'a', target: 'x', type: 'imports' } // x not in view
  const view = { id: 'v', title: 'V', nodeIds: ['a', 'b', 'c'], layout: {} }

  const g = buildElkGraph(m, view)
  const lane = g.children!.find((n) => n.id === 'lane:lib')!
  assert.ok(lane, 'lane created')
  assert.deepEqual(lane.children!.map((k) => k.id).sort(), ['a', 'b'], 'lane holds its members')
  assert.ok(g.children!.some((n) => n.id === 'c'), 'ungrouped node at root')
  assert.equal(g.edges!.length, 1, 'only the in-view edge is kept')
})

// ---- layoutView (integration: real elkjs in Node) ----
test('layoutView: real ELK produces finite positions; lane is sized to fit its children', async () => {
  const m: Manifest = emptyManifest()
  m.nodes.api = { id: 'api', type: 'component', parentId: 'lane:backend', data: { label: 'api' }, width: 220, height: 72 }
  m.nodes.db = { id: 'db', type: 'component', parentId: 'lane:backend', data: { label: 'db' }, width: 220, height: 72 }
  m.edges['api->db'] = { id: 'api->db', source: 'api', target: 'db', type: 'writes' }
  const view = { id: 'components', title: 'Components', nodeIds: ['api', 'db'], layoutDir: 'DOWN', layout: {} }
  m.views = [view]

  await layoutView(m, view)

  for (const id of ['lane:backend', 'api', 'db']) {
    assert.ok(view.layout[id], `${id} positioned`)
    assert.ok(Number.isFinite(view.layout[id].x) && Number.isFinite(view.layout[id].y), `${id} finite coords`)
  }
  const lane = view.layout['lane:backend']
  assert.ok((lane.w ?? 0) >= 220 && (lane.h ?? 0) >= 144, 'lane sized to contain two stacked 220x72 nodes')
})
