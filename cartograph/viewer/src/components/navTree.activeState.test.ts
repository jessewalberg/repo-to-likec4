import assert from 'node:assert/strict'
import { test } from 'node:test'

import type { AppRoute, NavEntry } from '../lib/types.ts'

// NavTree.tsx is a render-only JSX module and this repo has no React-DOM test
// renderer (tests run under bare `node --test`). Following the leanCollapsible
// precedent, the two pieces of NON-trivial, DOM-free decision logic are mirrored
// here verbatim from the component's private helpers and proven directly; the
// component keeps them private to honour its single-export (`NavTree`) contract.
// Keep the two in lockstep.
//
// (1) isEntryActive — the cross-surface highlight rule (CONTRACT §7): a leaf is
//     active when the route points at it OR when its `node` equals the selected
//     canvas node id (selecting a card lights up its Modules page row).
function isEntryActive(
  entry: NavEntry,
  route: AppRoute,
  activeNodeId: string | null,
): boolean {
  if (entry.node && activeNodeId && entry.node === activeNodeId) return true

  switch (entry.kind) {
    case 'view':
      return route.kind === 'view' && route.viewId === entry.viewId
    case 'page':
      return (
        route.kind === 'page' &&
        (route.page === entry.page ||
          (entry.node !== undefined && route.node === entry.node))
      )
    case 'tour':
      return route.kind === 'tour' && route.tourId === entry.tourId
    case 'changelog':
      return route.kind === 'changelog'
    default:
      return false
  }
}

// (2) isLibFolder — the deepest `lib` folder takes the --zone-b left tint
//     (sidebar↔canvas continuity, §5). A `lib` folder is a tree whose final
//     path segment (from its `dir:<path>` id) — equivalently its label — is
//     exactly `lib`.
function isLibFolder(entry: NavEntry): boolean {
  if (entry.kind !== 'tree') return false
  const lastSeg = entry.id.split(/[:/]/).pop() ?? ''
  return lastSeg === 'lib' || entry.label === 'lib'
}

const view = (viewId: string): NavEntry => ({ id: `view:${viewId}`, kind: 'view', label: viewId, viewId })
const page = (id: string, p: string, node?: string): NavEntry => ({ id, kind: 'page', label: id, page: p, node })

test('isEntryActive: a view is active when the route targets its viewId', () => {
  const route: AppRoute = { kind: 'view', viewId: 'components' }
  assert.equal(isEntryActive(view('components'), route, null), true)
  assert.equal(isEntryActive(view('other'), route, null), false)
})

test('isEntryActive: a page is active when the route page matches', () => {
  const entry = page('p1', 'pages/cli.md', 'module:cli.mjs')
  const route: AppRoute = { kind: 'page', page: 'pages/cli.md' }
  assert.equal(isEntryActive(entry, route, null), true)
})

test('isEntryActive: cross-surface — entry.node === selected node id lights the row regardless of route', () => {
  const entry = page('p1', 'pages/cli.md', 'module:cli.mjs')
  // Route is pointed elsewhere (a view), but the selected node matches → active.
  const route: AppRoute = { kind: 'view', viewId: 'components' }
  assert.equal(isEntryActive(entry, route, 'module:cli.mjs'), true)
  assert.equal(isEntryActive(entry, route, 'module:other.mjs'), false)
  assert.equal(isEntryActive(entry, route, null), false)
})

test('isEntryActive: changelog matches any changelog route; tour matches tourId', () => {
  const changelog: NavEntry = { id: 'cl', kind: 'changelog', label: 'What changed', feed: 'changelog.json' }
  assert.equal(isEntryActive(changelog, { kind: 'changelog' }, null), true)
  assert.equal(isEntryActive(changelog, { kind: 'view', viewId: 'components' }, null), false)

  const tour: NavEntry = { id: 't', kind: 'tour', label: 'Understand', tourId: 'understand' }
  assert.equal(isEntryActive(tour, { kind: 'tour', tourId: 'understand' }, null), true)
  assert.equal(isEntryActive(tour, { kind: 'tour', tourId: 'fix-bug' }, null), false)
})

test('isEntryActive: a branch/section (no node, non-leaf kind) is never active', () => {
  const section: NavEntry = { id: 's', kind: 'section', label: 'Docs', children: [] }
  assert.equal(isEntryActive(section, { kind: 'view', viewId: 'components' }, null), false)
})

test('isLibFolder: only the deepest lib tree folder gets the zone-b tint', () => {
  assert.equal(isLibFolder({ id: 'dir:tools/factory/lib', kind: 'tree', label: 'lib' }), true)
  assert.equal(isLibFolder({ id: 'dir:lib', kind: 'tree', label: 'lib' }), true)
  // A page that lives *inside* lib is not itself the lib folder.
  assert.equal(isLibFolder({ id: 'page:module:tools/factory/lib/dag.mjs', kind: 'page', label: 'dag.mjs' }), false)
  // A non-lib folder is untinted.
  assert.equal(isLibFolder({ id: 'dir:tools/factory', kind: 'tree', label: 'factory' }), false)
})
