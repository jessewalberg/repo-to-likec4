import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildModel } from './model.ts'
import { buildSite } from './site.ts'
import { validate } from './validate.ts'
import { type Manifest, emptyManifest } from './schema.ts'

const OPTS = { repo: 'org/name', blobBase: 'https://github.com/org/name/blob/main', idPrefix: 'tools/factory' }

// a tiny raw recon manifest: two modules (one in lib/, one at root) + an import edge
function reconFixture(): Manifest {
  const m = emptyManifest()
  m.nodes['module:tools/factory/cli.mjs'] = {
    id: 'module:tools/factory/cli.mjs',
    type: 'component',
    origin: 'machine',
    data: { label: 'cli.mjs', metadata: { path: 'tools/factory/cli.mjs' }, provenance: {}, confidence: 'static' },
    width: 220,
    height: 72,
  }
  m.nodes['module:tools/factory/lib/dag.mjs'] = {
    id: 'module:tools/factory/lib/dag.mjs',
    type: 'component',
    origin: 'machine',
    data: { label: 'dag.mjs', metadata: { path: 'tools/factory/lib/dag.mjs' }, provenance: {}, confidence: 'static' },
    width: 220,
    height: 72,
  }
  m.edges['imports:module:tools/factory/cli.mjs->module:tools/factory/lib/dag.mjs'] = {
    id: 'imports:module:tools/factory/cli.mjs->module:tools/factory/lib/dag.mjs',
    source: 'module:tools/factory/cli.mjs',
    target: 'module:tools/factory/lib/dag.mjs',
    type: 'imports',
    origin: 'machine',
    confidence: 'static',
  }
  return m
}

// ---- buildModel ----
test('buildModel: attaches absolute source links, a doc ref, and technology to each node', () => {
  const model = buildModel(reconFixture(), OPTS)
  const cli = model.nodes['module:tools/factory/cli.mjs']
  assert.ok(cli.data.links && cli.data.links.length >= 1, 'has a source link')
  assert.equal(cli.data.links![0].url, 'https://github.com/org/name/blob/main/tools/factory/cli.mjs', 'absolute blob url')
  assert.equal(cli.data.doc, 'pages/modules/tools/factory/cli.md', 'doc ref derived from path')
  assert.match(cli.data.technology ?? '', /JavaScript/i, 'technology inferred from .mjs')
})

test('buildModel: groups nodes into directory lanes and builds a Components view containing all nodes', () => {
  const model = buildModel(reconFixture(), OPTS)
  assert.ok(model.groups['lane:lib'], 'a lane group exists for lib/')
  assert.equal(model.nodes['module:tools/factory/lib/dag.mjs'].parentId, 'lane:lib', 'lib node assigned to its lane')
  const view = model.views.find((v) => v.id === 'components')
  assert.ok(view, 'a Components view exists')
  assert.equal(view!.nodeIds.length, 2, 'view contains both nodes')
  assert.deepEqual(view!.layout, {}, 'positions left empty for the layout stage')
})

// ---- buildSite ----
test('buildSite: produces the four sections with a changelog and search enabled', () => {
  const site = buildSite(buildModel(reconFixture(), OPTS))
  assert.equal(site.search.enabled, true)
  const ids = site.sidebar.map((s) => s.id)
  assert.deepEqual(ids, ['documentation', 'architecture', 'modules', 'learning'], 'four top-level sections in order')
  const docs = site.sidebar.find((s) => s.id === 'documentation')!
  assert.ok(docs.children!.some((c) => c.kind === 'changelog'), 'documentation has a changelog entry')
})

test('buildSite: Architecture lists each view; Modules tree is auto-built from per-node docs', () => {
  const site = buildSite(buildModel(reconFixture(), OPTS))
  const arch = site.sidebar.find((s) => s.id === 'architecture')!
  assert.ok(arch.children!.some((c) => c.kind === 'view' && c.viewId === 'components'), 'architecture lists the Components view')
  const modules = site.sidebar.find((s) => s.id === 'modules')!
  assert.equal(modules.source, 'auto:node-docs', 'modules tree is auto-sourced from node docs')
  // the tree should reach a leaf page for dag.mjs cross-linked to its node
  const flatten = (e: { children?: unknown[] }): unknown[] => [e, ...((e.children as { children?: unknown[] }[]) ?? []).flatMap(flatten)]
  const leaves = flatten(modules).filter((e): e is { kind: string; node?: string } => (e as { kind: string }).kind === 'page')
  assert.ok(leaves.some((l) => l.node === 'module:tools/factory/lib/dag.mjs'), 'a module page leaf cross-links to its node id')
})

test('buildSite: Learning seeds the three role tours', () => {
  const site = buildSite(buildModel(reconFixture(), OPTS))
  const learning = site.sidebar.find((s) => s.id === 'learning')!
  const tourIds = (learning.children ?? []).filter((c) => c.kind === 'tour').map((c) => c.tourId)
  assert.ok(['understand', 'fix-bug', 'add-feature'].every((t) => tourIds.includes(t)), 'three role tours present')
})

// ---- validate ----
test('validate: a well-formed model passes', () => {
  const res = validate(buildModel(reconFixture(), OPTS))
  assert.equal(res.ok, true, res.errors.join('; '))
})

test('validate: an orphan edge (dangling endpoint) is caught', () => {
  const model = buildModel(reconFixture(), OPTS)
  model.edges['bad'] = { id: 'bad', source: 'module:tools/factory/cli.mjs', target: 'module:ghost', type: 'imports' }
  const res = validate(model)
  assert.equal(res.ok, false)
  assert.ok(res.errors.some((e) => e.includes('module:ghost')), 'names the dangling endpoint')
})

test('validate: a node missing its source link is caught', () => {
  const model = buildModel(reconFixture(), OPTS)
  model.nodes['module:tools/factory/cli.mjs'].data.links = []
  const res = validate(model)
  assert.equal(res.ok, false)
  assert.ok(res.errors.some((e) => e.includes('cli.mjs') && /source link/i.test(e)), 'flags the missing source link')
})
