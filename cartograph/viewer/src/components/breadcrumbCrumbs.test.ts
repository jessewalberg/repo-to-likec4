import assert from 'node:assert/strict'
import { test } from 'node:test'

import type { AppRoute, NavEntry, Site } from '../lib/types.ts'

// Breadcrumb.tsx is a render-only JSX module and this repo has no React-DOM test
// renderer (tests run under bare `node --test`). Following the navTree precedent,
// the NON-trivial, DOM-free decision logic (`deriveCrumbs`) is mirrored here
// verbatim from the component's private helpers and proven directly; the
// component keeps them private to honour its single-export (`Breadcrumb`)
// contract. Keep the two in lockstep.

// ---- MIRROR of Breadcrumb.tsx private helpers (keep in lockstep) ------------

interface Crumb {
  key: string
  label: string
  /** Section/branch crumbs carry the section icon token on the FIRST crumb. */
  icon?: string
  /** A navigable route, when one can be resolved; undefined → non-link. */
  route?: AppRoute
}

function routeOf(entry: NavEntry): AppRoute | undefined {
  switch (entry.kind) {
    case 'view':
      return entry.viewId ? { kind: 'view', viewId: entry.viewId } : undefined
    case 'page':
      return entry.page
        ? { kind: 'page', page: entry.page, node: entry.node }
        : undefined
    case 'tour':
      return entry.tourId ? { kind: 'tour', tourId: entry.tourId } : undefined
    case 'changelog':
      return { kind: 'changelog' }
    default:
      return undefined
  }
}

function firstNavigableRoute(entry: NavEntry): AppRoute | undefined {
  const own = routeOf(entry)
  if (own) return own
  for (const child of entry.children ?? []) {
    const r = firstNavigableRoute(child)
    if (r) return r
  }
  return undefined
}

function matchesRoute(entry: NavEntry, route: AppRoute): boolean {
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

function findPath(
  entries: NavEntry[],
  route: AppRoute,
): NavEntry[] | null {
  for (const entry of entries) {
    if (matchesRoute(entry, route)) return [entry]
    const childPath = entry.children
      ? findPath(entry.children, route)
      : null
    if (childPath) return [entry, ...childPath]
  }
  return null
}

function deriveCrumbs(route: AppRoute, site: Site): Crumb[] {
  const path = findPath(site.sidebar ?? [], route)
  if (!path || path.length === 0) return []
  const last = path.length - 1
  return path.map((entry, i) => {
    const isLast = i === last
    return {
      key: entry.id,
      label: entry.label,
      icon: i === 0 ? entry.icon : undefined,
      // Last crumb is the destination → non-link. Leading crumbs link to their
      // own route, or (for non-routable sections/trees) their first navigable
      // descendant so the crumb is still a working shortcut.
      route: isLast ? undefined : firstNavigableRoute(entry),
    }
  })
}

// ---- fixture-shaped site ----------------------------------------------------

const site: Site = {
  schemaVersion: 1,
  home: 'view:components',
  search: { enabled: true, index: [] },
  sidebar: [
    {
      id: 'documentation',
      kind: 'section',
      label: 'Documentation',
      icon: 'book',
      children: [
        { id: 'overview', kind: 'page', label: 'Overview', page: 'pages/overview.md' },
        { id: 'changelog', kind: 'changelog', label: 'What changed', feed: 'changelog.json' },
      ],
    },
    {
      id: 'architecture',
      kind: 'section',
      label: 'Architecture',
      icon: 'map',
      children: [
        { id: 'view:components', kind: 'view', label: 'Components', viewId: 'components' },
      ],
    },
    {
      id: 'modules',
      kind: 'tree',
      label: 'Modules',
      icon: 'folder-tree',
      children: [
        {
          id: 'dir:tools',
          kind: 'tree',
          label: 'tools',
          children: [
            {
              id: 'dir:tools/factory',
              kind: 'tree',
              label: 'factory',
              children: [
                {
                  id: 'dir:tools/factory/lib',
                  kind: 'tree',
                  label: 'lib',
                  children: [
                    {
                      id: 'page:policy',
                      kind: 'page',
                      label: 'policy.mjs',
                      page: 'pages/modules/tools/factory/lib/policy.md',
                      node: 'module:tools/factory/lib/policy.mjs',
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'learning',
      kind: 'section',
      label: 'Learning',
      icon: 'graduation-cap',
      children: [
        { id: 'tour:understand', kind: 'tour', label: 'Understand the system', tourId: 'understand' },
      ],
    },
  ],
}

test('deriveCrumbs: a view route → [Architecture, Components]', () => {
  const crumbs = deriveCrumbs({ kind: 'view', viewId: 'components' }, site)
  assert.deepEqual(crumbs.map((c) => c.label), ['Architecture', 'Components'])
})

test('deriveCrumbs: first crumb carries the section icon, the rest do not', () => {
  const crumbs = deriveCrumbs({ kind: 'view', viewId: 'components' }, site)
  assert.equal(crumbs[0].icon, 'map')
  assert.equal(crumbs[1].icon, undefined)
})

test('deriveCrumbs: the last crumb is non-link, leading crumbs are links', () => {
  const crumbs = deriveCrumbs({ kind: 'view', viewId: 'components' }, site)
  assert.equal(crumbs[crumbs.length - 1].route, undefined)
  assert.notEqual(crumbs[0].route, undefined)
})

test('deriveCrumbs: a non-routable section links to its first navigable descendant', () => {
  const crumbs = deriveCrumbs({ kind: 'view', viewId: 'components' }, site)
  // Architecture (a section) has no route of its own → resolves to its view.
  assert.deepEqual(crumbs[0].route, { kind: 'view', viewId: 'components' })
})

test('deriveCrumbs: a deep page route yields the full 5-level path', () => {
  const route: AppRoute = {
    kind: 'page',
    page: 'pages/modules/tools/factory/lib/policy.md',
  }
  const crumbs = deriveCrumbs(route, site)
  assert.deepEqual(crumbs.map((c) => c.label), [
    'Modules',
    'tools',
    'factory',
    'lib',
    'policy.mjs',
  ])
})

test('deriveCrumbs: a page route matched by node still resolves the path', () => {
  const route: AppRoute = {
    kind: 'page',
    page: 'unrelated.md',
    node: 'module:tools/factory/lib/policy.mjs',
  }
  const crumbs = deriveCrumbs(route, site)
  assert.equal(crumbs[crumbs.length - 1].label, 'policy.mjs')
})

test('deriveCrumbs: changelog and tour routes resolve under their sections', () => {
  assert.deepEqual(
    deriveCrumbs({ kind: 'changelog' }, site).map((c) => c.label),
    ['Documentation', 'What changed'],
  )
  assert.deepEqual(
    deriveCrumbs({ kind: 'tour', tourId: 'understand' }, site).map((c) => c.label),
    ['Learning', 'Understand the system'],
  )
})

test('deriveCrumbs: an unresolvable route yields no crumbs (caller shows fallback)', () => {
  assert.deepEqual(deriveCrumbs({ kind: 'view', viewId: 'ghost' }, site), [])
})
