import assert from 'node:assert/strict'
import { test } from 'node:test'
import { type Refiner, applyRefinements, buildRefineRequests, pageIsHumanOwned, refineModel, renderPage } from './refine.ts'
import { type Manifest, emptyManifest } from './schema.ts'

function model(): Manifest {
  const m = emptyManifest()
  m.nodes.cli = { id: 'cli', type: 'component', data: { label: 'cli.mjs', technology: 'JavaScript', metadata: { path: 'tools/cli.mjs' }, doc: 'pages/modules/tools/cli.md', provenance: {} } }
  m.nodes.dag = { id: 'dag', type: 'component', data: { label: 'dag.mjs', doc: 'pages/modules/tools/dag.md', provenance: {} } }
  m.edges['cli->dag'] = { id: 'cli->dag', source: 'cli', target: 'dag', type: 'imports' }
  return m
}

test('buildRefineRequests: one request per node, with import/importedBy labels', () => {
  const reqs = buildRefineRequests(model())
  const cli = reqs.find((r) => r.nodeId === 'cli')!
  assert.equal(cli.label, 'cli.mjs')
  assert.equal(cli.path, 'tools/cli.mjs')
  assert.deepEqual(cli.imports, ['dag.mjs'])
  const dag = reqs.find((r) => r.nodeId === 'dag')!
  assert.deepEqual(dag.importedBy, ['cli.mjs'])
})

test('buildRefineRequests: skips a node whose summary is human-owned', () => {
  const m = model()
  m.nodes.cli.data.summary = 'my words'
  m.nodes.cli.data.provenance = { summary: 'human' }
  const ids = buildRefineRequests(m).map((r) => r.nodeId)
  assert.ok(!ids.includes('cli'), 'human-owned summary is left alone')
  assert.ok(ids.includes('dag'))
})

test('applyRefinements: sets node summary and emits a doc page at the node doc ref', () => {
  const { manifest, pages } = applyRefinements(model(), [
    { nodeId: 'cli', summary: 'The CLI entrypoint.', description: 'Parses args and runs the pipeline.' },
  ])
  assert.equal(manifest.nodes.cli.data.summary, 'The CLI entrypoint.')
  assert.ok(pages['pages/modules/tools/cli.md'], 'page emitted at the doc ref')
  assert.match(pages['pages/modules/tools/cli.md'], /node: cli/, 'frontmatter cross-links the node')
  assert.match(pages['pages/modules/tools/cli.md'], /Parses args/, 'body present')
})

test('applyRefinements: never clobbers a human-owned summary', () => {
  const m = model()
  m.nodes.cli.data.summary = 'mine'
  m.nodes.cli.data.provenance = { summary: 'human' }
  const { manifest } = applyRefinements(m, [{ nodeId: 'cli', summary: 'robot', description: 'x' }])
  assert.equal(manifest.nodes.cli.data.summary, 'mine', 'human summary preserved')
})

test('applyRefinements: tags the summary provenance machine (so a later human edit can flip it)', () => {
  const { manifest } = applyRefinements(model(), [{ nodeId: 'cli', summary: 's', description: 'd' }])
  assert.equal(manifest.nodes.cli.data.provenance?.summary, 'machine')
})

test('pageIsHumanOwned: true for provenance:human or pinned:true frontmatter; false otherwise', () => {
  assert.equal(pageIsHumanOwned('---\nnode: x\nprovenance: human\n---\nbody'), true)
  assert.equal(pageIsHumanOwned('---\nnode: x\npinned: true\n---\nbody'), true)
  assert.equal(pageIsHumanOwned('---\nnode: x\nprovenance: machine\npinned: false\n---\nbody'), false)
  assert.equal(pageIsHumanOwned('# no frontmatter'), false)
})

test('renderPage: adds an H1 only when the body lacks one', () => {
  assert.match(renderPage('Foo', 'body', 'n'), /# Foo\n\nbody/)
  assert.doesNotMatch(renderPage('Foo', '# Already\n\nbody', 'n').replace('# Already', ''), /# Foo/)
})

test('refineModel: orchestrates the injected refiner over all nodes', async () => {
  const refiner: Refiner = async (req) => ({ nodeId: req.nodeId, summary: `sum:${req.label}`, description: `doc for ${req.label}` })
  const { manifest, pages } = await refineModel(model(), refiner, { concurrency: 2 })
  assert.equal(manifest.nodes.cli.data.summary, 'sum:cli.mjs')
  assert.equal(manifest.nodes.dag.data.summary, 'sum:dag.mjs')
  assert.equal(Object.keys(pages).length, 2, 'a page per node with a doc ref')
})

test('refineModel: a refiner failure on one node does not sink the rest', async () => {
  const refiner: Refiner = async (req) => {
    if (req.nodeId === 'cli') throw new Error('rate limit')
    return { nodeId: req.nodeId, summary: 'ok', description: 'ok' }
  }
  const { manifest } = await refineModel(model(), refiner)
  assert.equal(manifest.nodes.dag.data.summary, 'ok', 'dag still refined')
  assert.notEqual(manifest.nodes.cli.data.summary, 'ok', 'cli left unrefined, no crash')
})
