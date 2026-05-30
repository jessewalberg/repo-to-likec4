import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mergeManifest } from './merge.ts'
import type { Manifest, ManifestEdge, ManifestNode } from './schema.ts'

// ---- fixture helpers -------------------------------------------------------

function m(partial: Partial<Manifest> = {}): Manifest {
  return {
    schemaVersion: 2,
    nodes: {},
    edges: {},
    suppressions: { nodes: [], edges: [] },
    idAliases: {},
    groups: {},
    views: [],
    ...partial,
  }
}

function node(id: string, over: Partial<ManifestNode> = {}): ManifestNode {
  return {
    id,
    type: 'service',
    origin: 'machine',
    data: { label: id, provenance: {}, ...(over.data ?? {}) },
    ...over,
    // keep nested data merge predictable: over.data already folded above
    ...(over.data ? { data: { label: id, provenance: {}, ...over.data } } : {}),
  }
}

function edge(id: string, source: string, target: string, over: Partial<ManifestEdge> = {}): ManifestEdge {
  return { id, source, target, type: 'sync', origin: 'machine', confidence: 'static', ...over }
}

function nodesMap(...ns: ManifestNode[]): Record<string, ManifestNode> {
  return Object.fromEntries(ns.map((n) => [n.id, n]))
}
function edgesMap(...es: ManifestEdge[]): Record<string, ManifestEdge> {
  return Object.fromEntries(es.map((e) => [e.id, e]))
}

// ===========================================================================
// Scenario A — a recon refresh must PRESERVE human-edited fields and pins,
// while still refreshing recon-owned facts (metadata).  The core promise.
// ===========================================================================
test('A: human-edited label/summary + pin survive a recon refresh; metadata is refreshed', () => {
  const base = m({
    nodes: nodesMap(node('db', { type: 'datastore', data: { label: 'db', metadata: { loc: 100 }, provenance: {} } })),
    views: [{ id: 'container', title: 'Container', nodeIds: ['db'], layout: { db: { x: 0, y: 0 } } }],
  })

  const current = m({
    nodes: nodesMap(
      node('db', {
        type: 'datastore',
        data: {
          label: 'Primary Postgres', // human relabel
          summary: 'the main store', // human summary
          metadata: { loc: 100 },
          pinned: true,
          provenance: { label: 'human', summary: 'human' },
        },
      }),
    ),
    views: [{ id: 'container', title: 'Container', nodeIds: ['db'], layout: { db: { x: 100, y: 200 } } }],
  })

  // fresh recon: machine label again, metadata changed (file grew), no positions
  const fresh = m({
    nodes: nodesMap(node('db', { type: 'datastore', data: { label: 'db', metadata: { loc: 180 }, provenance: {} } })),
    views: [{ id: 'container', title: 'Container', nodeIds: ['db'], layout: {} }],
  })

  const { manifest, report } = mergeManifest(base, fresh, current)
  const db = manifest.nodes.db

  assert.equal(db.data.label, 'Primary Postgres', 'human label must win')
  assert.equal(db.data.summary, 'the main store', 'human summary must win')
  assert.equal(db.data.metadata?.loc, 180, 'recon-owned metadata must refresh')
  assert.equal(db.data.pinned, true, 'pin survives')
  assert.deepEqual(manifest.views[0].layout.db, { x: 100, y: 200 }, 'human position survives')
  assert.ok(
    report.humanFieldsPreserved.some((h) => h.id === 'db' && h.fields.includes('label') && h.fields.includes('summary')),
    'report records preserved human fields',
  )
})

// ===========================================================================
// Scenario B — MODULE SPLIT: `api` splits into api + api-auth + api-users.
// The surviving node keeps human edits; new nodes are added and flagged as
// needing layout; new edges appear; pinned nodes are excluded from layout.
// ===========================================================================
test('B: module split adds new nodes (needing layout) while the surviving node keeps human edits', () => {
  const base = m({
    nodes: nodesMap(node('api', { data: { label: 'api', provenance: {} } }), node('db', { type: 'datastore' })),
    edges: edgesMap(edge('e:api->db', 'api', 'db', { type: 'writes' })),
    views: [{ id: 'container', title: 'Container', nodeIds: ['api', 'db'], layout: { api: { x: 0, y: 0 }, db: { x: 0, y: 120 } } }],
  })

  const current = m({
    nodes: nodesMap(
      node('api', { data: { label: 'Public API', pinned: true, provenance: { label: 'human' } } }),
      node('db', { type: 'datastore' }),
    ),
    edges: edgesMap(edge('e:api->db', 'api', 'db', { type: 'writes' })),
    views: [{ id: 'container', title: 'Container', nodeIds: ['api', 'db'], layout: { api: { x: 50, y: 50 }, db: { x: 0, y: 120 } } }],
  })

  const fresh = m({
    nodes: nodesMap(
      node('api', { data: { label: 'api', provenance: {} } }),
      node('api-auth', { data: { label: 'api-auth', provenance: {} } }),
      node('api-users', { data: { label: 'api-users', provenance: {} } }),
      node('db', { type: 'datastore' }),
    ),
    edges: edgesMap(
      edge('e:api->db', 'api', 'db', { type: 'writes' }),
      edge('e:api->api-auth', 'api', 'api-auth'),
      edge('e:api->api-users', 'api', 'api-users'),
    ),
    views: [{ id: 'container', title: 'Container', nodeIds: ['api', 'api-auth', 'api-users', 'db'], layout: {} }],
  })

  const { manifest, report, nodesNeedingLayout } = mergeManifest(base, fresh, current)

  assert.equal(manifest.nodes.api.data.label, 'Public API', 'surviving node keeps human label')
  assert.deepEqual(manifest.views[0].layout.api, { x: 50, y: 50 }, 'surviving node keeps human position')
  assert.ok(manifest.nodes['api-auth'] && manifest.nodes['api-users'], 'new split nodes are added')
  assert.ok(manifest.edges['e:api->api-auth'] && manifest.edges['e:api->api-users'], 'new edges are added')
  assert.deepEqual([...report.added].sort(), ['api-auth', 'api-users'], 'report lists the additions')
  assert.ok(nodesNeedingLayout.includes('api-auth') && nodesNeedingLayout.includes('api-users'), 'new nodes need layout')
  assert.ok(!nodesNeedingLayout.includes('api'), 'pinned surviving node does NOT need layout')
})

// ===========================================================================
// Scenario C — FILE MOVE / RENAME: `tool:tools/foo.ts` -> `tool:tools/foo`.
// idAliases migrates the human label + pinned position to the NEW id; the old
// id disappears; edge endpoints repoint.  (The red-team's highest-risk case.)
// ===========================================================================
test('C: file move migrates human edits + position to the new id via idAliases', () => {
  const OLD = 'tool:tools/foo.ts'
  const NEW = 'tool:tools/foo'

  const base = m({
    nodes: nodesMap(node(OLD, { type: 'component', data: { label: 'foo.ts', provenance: {} } }), node('cli', { type: 'service' })),
    edges: edgesMap(edge('e:cli->foo', 'cli', OLD)),
    views: [{ id: 'container', title: 'Container', nodeIds: [OLD, 'cli'], layout: { [OLD]: { x: 10, y: 20 }, cli: { x: 0, y: 0 } } }],
  })

  const current = m({
    nodes: nodesMap(
      node(OLD, { type: 'component', data: { label: 'Foo Tool', pinned: true, provenance: { label: 'human' } } }),
      node('cli', { type: 'service' }),
    ),
    edges: edgesMap(edge('e:cli->foo', 'cli', OLD)),
    views: [{ id: 'container', title: 'Container', nodeIds: [OLD, 'cli'], layout: { [OLD]: { x: 999, y: 888 }, cli: { x: 0, y: 0 } } }],
  })

  // recon at the new commit produces the NEW id; rename detection recorded the alias
  const fresh = m({
    nodes: nodesMap(node(NEW, { type: 'component', data: { label: 'foo', provenance: {} } }), node('cli', { type: 'service' })),
    edges: edgesMap(edge('e:cli->foo', 'cli', NEW)),
    views: [{ id: 'container', title: 'Container', nodeIds: [NEW, 'cli'], layout: {} }],
    idAliases: { [OLD]: NEW },
  })

  const { manifest, report } = mergeManifest(base, fresh, current)

  assert.ok(manifest.nodes[NEW], 'new id exists')
  assert.equal(manifest.nodes[OLD], undefined, 'old id is gone')
  assert.equal(manifest.nodes[NEW].data.label, 'Foo Tool', 'human label migrated to new id')
  assert.equal(manifest.nodes[NEW].data.pinned, true, 'pin migrated')
  assert.deepEqual(manifest.views[0].layout[NEW], { x: 999, y: 888 }, 'human position migrated to new id')
  assert.equal(manifest.views[0].layout[OLD], undefined, 'old layout key removed')
  assert.equal(manifest.edges['e:cli->foo'].target, NEW, 'edge endpoint repoints to new id')
  assert.ok(report.migrated.some((mig) => mig.from === OLD && mig.to === NEW), 'report records the migration')
})

// ===========================================================================
// Scenario D — SEMANTIC SUPPRESSION: human deleted edge api->redis; recon
// re-discovers it; it must STAY gone.  (Kills the "agent re-adds my deleted
// edge" failure that sinks every regenerate-on-run competitor.)
// ===========================================================================
test('D: a suppressed edge is not re-added even when recon rediscovers it', () => {
  const base = m({
    nodes: nodesMap(node('api'), node('redis', { type: 'cache' })),
    edges: edgesMap(),
  })
  const current = m({
    nodes: nodesMap(node('api'), node('redis', { type: 'cache' })),
    edges: edgesMap(),
    suppressions: { nodes: [], edges: ['e:api->redis'] },
  })
  const fresh = m({
    nodes: nodesMap(node('api'), node('redis', { type: 'cache' })),
    edges: edgesMap(edge('e:api->redis', 'api', 'redis', { type: 'reads' })),
  })

  const { manifest, report } = mergeManifest(base, fresh, current)
  assert.equal(manifest.edges['e:api->redis'], undefined, 'suppressed edge stays gone')
  assert.ok(report.suppressedSkipped.includes('e:api->redis'), 'report records the skip')
})

test('D2: a suppressed node is not re-added even when recon rediscovers it', () => {
  const base = m({ nodes: nodesMap(node('api')) })
  const current = m({ nodes: nodesMap(node('api')), suppressions: { nodes: ['file:src/util/log.ts'], edges: [] } })
  const fresh = m({ nodes: nodesMap(node('api'), node('file:src/util/log.ts', { type: 'component' })) })

  const { manifest } = mergeManifest(base, fresh, current)
  assert.equal(manifest.nodes['file:src/util/log.ts'], undefined, 'suppressed node stays gone')
})

// ===========================================================================
// Scenario E — REMOVED-IN-RECON node is MUTED (confidence 'unknown'), not
// hard-deleted, and any human annotation on it is preserved for review.
// ===========================================================================
test('E: a node recon no longer sees is muted (not deleted) and keeps its human annotation', () => {
  const base = m({ nodes: nodesMap(node('legacy'), node('api')) })
  const current = m({
    nodes: nodesMap(
      node('legacy', { data: { label: 'legacy', annotation: 'kept for the 2024 migration', provenance: { annotation: 'human' } } }),
      node('api'),
    ),
  })
  const fresh = m({ nodes: nodesMap(node('api')) }) // recon no longer sees `legacy`

  const { manifest, report } = mergeManifest(base, fresh, current)
  assert.ok(manifest.nodes.legacy, 'removed node is NOT hard-deleted')
  assert.equal(manifest.nodes.legacy.data.confidence, 'unknown', 'removed node is muted via confidence=unknown')
  assert.equal(manifest.nodes.legacy.data.annotation, 'kept for the 2024 migration', 'human annotation preserved')
  assert.ok(report.mutedRemoved.includes('legacy'), 'report records the muting')
})

// ===========================================================================
// Scenario F — a purely human-added annotation node (origin 'human') that
// recon never produced must survive a recon refresh untouched.
// ===========================================================================
test('F: a human-authored node (origin human) survives recon that never produced it', () => {
  const base = m({ nodes: nodesMap(node('api')) })
  const current = m({
    nodes: nodesMap(node('api'), node('note:roadmap', { type: 'decision', origin: 'human', data: { label: 'Q3: extract billing', provenance: { label: 'human' } } })),
  })
  const fresh = m({ nodes: nodesMap(node('api')) })

  const { manifest } = mergeManifest(base, fresh, current)
  assert.ok(manifest.nodes['note:roadmap'], 'human-authored node is not muted or deleted')
  assert.notEqual(manifest.nodes['note:roadmap'].data.confidence, 'unknown', 'human node is NOT muted as a recon removal')
})

// ===========================================================================
// Scenario G — a frozen LANE/container position (a layout key that is not a node
// id) survives a recon refresh, so grouped views don't lose their lane boxes.
// ===========================================================================
test('G: frozen lane/container layout positions survive a recon refresh', () => {
  const base = m({ nodes: nodesMap(node('a')) })
  const current = m({
    nodes: nodesMap(node('a')),
    views: [{ id: 'components', title: 'Components', nodeIds: ['a'], layout: { a: { x: 5, y: 5 }, 'lane:lib': { x: 0, y: 0, w: 300, h: 200 } } }],
  })
  const fresh = m({
    nodes: nodesMap(node('a')),
    views: [{ id: 'components', title: 'Components', nodeIds: ['a'], layout: {} }],
  })

  const { manifest } = mergeManifest(base, fresh, current)
  assert.deepEqual(manifest.views[0].layout['lane:lib'], { x: 0, y: 0, w: 300, h: 200 }, 'lane box carried forward')
  assert.deepEqual(manifest.views[0].layout.a, { x: 5, y: 5 }, 'node position still preserved')
})
