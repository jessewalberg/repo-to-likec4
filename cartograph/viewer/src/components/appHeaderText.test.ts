import assert from 'node:assert/strict'
import { test } from 'node:test'
import { crumbsForRoute, layoutDirLabel, viewStats } from './appHeaderText.ts'
import type { Manifest, View } from '../lib/types.ts'

// --- fixtures --------------------------------------------------------------

function makeManifest(): Manifest {
  return {
    schemaVersion: 1,
    nodes: {
      'lib/a.mjs': { id: 'lib/a.mjs', type: 'component', parentId: 'lane:lib', data: { label: 'a.mjs' } },
      'lib/b.mjs': { id: 'lib/b.mjs', type: 'component', parentId: 'lane:lib', data: { label: 'b.mjs' } },
      'root/cli.mjs': { id: 'root/cli.mjs', type: 'component', parentId: 'lane:root', data: { label: 'cli.mjs' } },
      orphan: { id: 'orphan', type: 'component', parentId: null, data: { label: 'orphan' } },
    },
    edges: {
      e1: { id: 'e1', source: 'root/cli.mjs', target: 'lib/a.mjs', type: 'imports' },
      e2: { id: 'e2', source: 'lib/a.mjs', target: 'lib/b.mjs', type: 'imports' },
      // dangling: target not in view -> excluded from the in-view edge count
      e3: { id: 'e3', source: 'lib/b.mjs', target: 'not-in-view', type: 'imports' },
    },
    suppressions: { nodes: [], edges: [] },
    idAliases: {},
    groups: {
      'lane:root': { id: 'lane:root', label: 'Root' },
      'lane:lib': { id: 'lane:lib', label: 'lib' },
    },
    views: [],
  }
}

function makeView(overrides: Partial<View> = {}): View {
  return {
    id: 'components',
    title: 'Components',
    nodeIds: ['lib/a.mjs', 'lib/b.mjs', 'root/cli.mjs'],
    layoutDir: 'DOWN',
    layout: {},
    ...overrides,
  }
}

// --- viewStats -------------------------------------------------------------

test('viewStats: counts nodes, in-view edges, and distinct lanes', () => {
  const stats = viewStats(makeView(), makeManifest())
  assert.deepEqual(stats, { nodes: 3, edges: 2, lanes: 2, empty: false })
})

test('viewStats: excludes edges that dangle outside the view', () => {
  // e3 targets a node not present in the view -> must not be counted.
  const stats = viewStats(makeView(), makeManifest())
  assert.equal(stats.edges, 2)
})

test('viewStats: ignores nodeIds that resolve to no manifest node', () => {
  const stats = viewStats(makeView({ nodeIds: ['lib/a.mjs', 'ghost'] }), makeManifest())
  assert.equal(stats.nodes, 1)
})

test('viewStats: empty view flags empty:true with zeroed counts (never NaN)', () => {
  const stats = viewStats(makeView({ nodeIds: [] }), makeManifest())
  assert.deepEqual(stats, { nodes: 0, edges: 0, lanes: 0, empty: true })
  assert.ok(Number.isFinite(stats.nodes) && Number.isFinite(stats.edges) && Number.isFinite(stats.lanes))
})

test('viewStats: undefined view flags empty:true', () => {
  assert.deepEqual(viewStats(undefined, makeManifest()), { nodes: 0, edges: 0, lanes: 0, empty: true })
})

// --- crumbsForRoute --------------------------------------------------------

test('crumbsForRoute (view): Architecture > view title, last crumb non-link', () => {
  const crumbs = crumbsForRoute({ kind: 'view', viewId: 'components' }, makeView())
  assert.equal(crumbs.length, 2)
  assert.equal(crumbs[0].label, 'Architecture')
  assert.deepEqual(crumbs[0].route, { kind: 'view', viewId: 'components' })
  assert.equal(crumbs[1].label, 'Components')
  assert.equal(crumbs[1].route, undefined)
})

test('crumbsForRoute (view): falls back to viewId when no view title', () => {
  const crumbs = crumbsForRoute({ kind: 'view', viewId: 'components' }, undefined)
  assert.equal(crumbs[1].label, 'components')
})

test('crumbsForRoute: appends selected-node label as trailing pin (you-are-here)', () => {
  const crumbs = crumbsForRoute({ kind: 'view', viewId: 'components' }, makeView(), 'cli.mjs')
  assert.equal(crumbs.length, 3)
  assert.equal(crumbs[2].label, 'cli.mjs')
  assert.equal(crumbs[2].route, undefined) // current location, non-link
  // the previously-last crumb is now navigable
  assert.notEqual(crumbs[1].route, undefined)
})

test('crumbsForRoute: blank selected label is not appended', () => {
  const crumbs = crumbsForRoute({ kind: 'view', viewId: 'components' }, makeView(), '   ')
  assert.equal(crumbs.length, 2)
})

test('crumbsForRoute (changelog): single non-link crumb', () => {
  const crumbs = crumbsForRoute({ kind: 'changelog' }, undefined)
  assert.equal(crumbs.length, 1)
  assert.equal(crumbs[0].label, 'Changelog')
  assert.equal(crumbs[0].route, undefined)
})

test('crumbsForRoute (page): Modules > page leaf', () => {
  const crumbs = crumbsForRoute({ kind: 'page', page: 'lib/policy' }, undefined)
  assert.equal(crumbs[0].label, 'Modules')
  assert.equal(crumbs[1].label, 'lib/policy')
})

test('crumbsForRoute (tour): Tours > tour id', () => {
  const crumbs = crumbsForRoute({ kind: 'tour', tourId: 'fix-bug' }, undefined)
  assert.equal(crumbs[0].label, 'Tours')
  assert.equal(crumbs[1].label, 'fix-bug')
})

// --- layoutDirLabel --------------------------------------------------------

test('layoutDirLabel: DOWN -> down arrow + top-down', () => {
  assert.deepEqual(layoutDirLabel('DOWN'), { arrow: '↓', words: 'top-down' })
})

test('layoutDirLabel: unknown/undefined falls back to top-down (never blank)', () => {
  assert.deepEqual(layoutDirLabel(undefined), { arrow: '↓', words: 'top-down' })
  assert.deepEqual(layoutDirLabel('SIDEWAYS'), { arrow: '↓', words: 'top-down' })
})

test('layoutDirLabel: RIGHT -> right arrow + left-right', () => {
  assert.deepEqual(layoutDirLabel('RIGHT'), { arrow: '→', words: 'left-right' })
})
