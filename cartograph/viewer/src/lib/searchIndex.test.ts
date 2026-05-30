import assert from 'node:assert/strict'
import { test } from 'node:test'
import { type SearchHandlers, buildSearchIndex } from './searchIndex.ts'
import type { CartographData } from './types.ts'

function data(indexCats: string[] = ['nodes', 'edges', 'pages', 'tours']): CartographData {
  return {
    architecture: {
      schemaVersion: 2,
      nodes: {
        'm:a': { id: 'm:a', type: 'component', data: { label: 'a.mjs', technology: 'JavaScript', metadata: { path: 'tools/a.mjs' } } },
        'm:b': { id: 'm:b', type: 'component', data: { label: 'b.mjs', technology: 'JavaScript' } },
      },
      edges: { e1: { id: 'e1', source: 'm:a', target: 'm:b', type: 'imports' } },
      suppressions: { nodes: [], edges: [] },
      idAliases: {},
      groups: {},
      views: [],
    },
    site: {
      schemaVersion: 1,
      home: 'view:components',
      search: { enabled: true, index: indexCats },
      sidebar: [
        { id: 'doc', kind: 'section', label: 'Documentation', children: [{ id: 'ov', kind: 'page', label: 'Overview', page: 'pages/overview.md' }] },
        { id: 'learn', kind: 'section', label: 'Learning', children: [{ id: 't1', kind: 'tour', label: 'Understand', tourId: 'understand' }] },
      ],
    },
    changelog: { schemaVersion: 1, entries: [] },
    pages: {},
  }
}

const noopHandlers = (): SearchHandlers => ({ selectNode() {}, selectEdge() {}, openPage() {}, openTour() {} })

test('buildSearchIndex: indexes nodes/edges/pages/tours per site.search.index', () => {
  const docs = buildSearchIndex(data(), noopHandlers())
  const groups = new Set(docs.map((d) => d.group))
  assert.deepEqual([...groups].sort(), ['Edges', 'Nodes', 'Pages', 'Tours'])
  assert.equal(docs.filter((d) => d.group === 'Nodes').length, 2)
  assert.equal(docs.filter((d) => d.group === 'Tours').length, 1)
})

test('buildSearchIndex: honors a restricted index (nodes only)', () => {
  const docs = buildSearchIndex(data(['nodes']), noopHandlers())
  assert.deepEqual([...new Set(docs.map((d) => d.group))], ['Nodes'])
})

test('buildSearchIndex: node keywords carry path + id, never undefined', () => {
  const docs = buildSearchIndex(data(), noopHandlers())
  const a = docs.find((d) => d.id === 'node:m:a')!
  assert.ok(a.keywords.includes('tools/a.mjs'))
  assert.ok(a.keywords.includes('m:a'))
  assert.ok(a.keywords.every((k) => typeof k === 'string' && k.length > 0))
  const b = docs.find((d) => d.id === 'node:m:b')!
  assert.ok(!b.keywords.includes(undefined as unknown as string), 'no undefined for missing path')
})

test('buildSearchIndex: go() dispatches to the right handler', () => {
  const calls: string[] = []
  const handlers: SearchHandlers = {
    selectNode: (id) => calls.push(`node:${id}`),
    selectEdge: (id) => calls.push(`edge:${id}`),
    openPage: (p) => calls.push(`page:${p}`),
    openTour: (t) => calls.push(`tour:${t}`),
  }
  const docs = buildSearchIndex(data(), handlers)
  docs.find((d) => d.id === 'node:m:a')!.go()
  docs.find((d) => d.id === 'edge:e1')!.go()
  docs.find((d) => d.id === 'page:ov')!.go()
  docs.find((d) => d.id === 'tour:t1')!.go()
  assert.deepEqual(calls, ['node:m:a', 'edge:e1', 'page:pages/overview.md', 'tour:understand'])
})
