// Pure presentation-text derivations for AppHeader (React-free, unit-testable).
// The component is render-only; these helpers own the live stat readout and the
// inline breadcrumb path so the behaviour (CONTRACT §2) can be proven without a
// DOM. Never returns NaN/undefined for a slot the header renders.

import type { AppRoute, Manifest, View } from '../lib/types'

export interface ViewStats {
  nodes: number
  edges: number
  lanes: number
  /** True when the view carries no nodes — the header shows "empty view". */
  empty: boolean
}

/**
 * CONTRACT §2 live stat readout, computed from the view + manifest:
 * - nodes  = count of view.nodeIds that resolve to a real manifest node
 * - edges  = manifest edges whose BOTH ends are inside the view (no dangling)
 * - lanes  = distinct lane parentIds among the in-view nodes
 * Counts are always finite, never NaN; an empty view flags `empty:true` so the
 * header renders the words "empty view" instead of "0 nodes".
 */
export function viewStats(view: View | undefined, manifest: Manifest): ViewStats {
  if (!view) return { nodes: 0, edges: 0, lanes: 0, empty: true }

  const inView = new Set<string>()
  for (const id of view.nodeIds) {
    if (manifest.nodes[id]) inView.add(id)
  }

  let edges = 0
  for (const e of Object.values(manifest.edges)) {
    if (inView.has(e.source) && inView.has(e.target)) edges += 1
  }

  const lanes = new Set<string>()
  for (const id of inView) {
    const parentId = manifest.nodes[id]?.parentId
    if (parentId && manifest.groups[parentId]) lanes.add(parentId)
  }

  return {
    nodes: inView.size,
    edges,
    lanes: lanes.size,
    empty: inView.size === 0,
  }
}

/** A single rendered crumb in the inline breadcrumb. `route` undefined => non-link. */
export interface Crumb {
  label: string
  /** Navigation target; undefined for the last (current) crumb. */
  route?: AppRoute
}

/**
 * Inline breadcrumb derived from the route + view title (CONTRACT §2). We render
 * crumbs here rather than reuse <Breadcrumb> because AppHeader has no `site` prop.
 *
 * - view    -> `Architecture › {view.title}` (e.g. "Architecture › Components")
 * - page    -> `Modules › {page}` (the doc ref is the leaf)
 * - changelog -> `Changelog`
 * - tour    -> `Tours › {tourId}`
 *
 * When `selectedLabel` is set, it is appended as a trailing "you are here" pin so
 * the breadcrumb mirrors the selected canvas node cross-surface. The first crumb
 * is always a section root the user can navigate back to (carries a `route`);
 * the last crumb is the current location (no `route` -> non-link).
 */
export function crumbsForRoute(
  route: AppRoute,
  view: View | undefined,
  selectedLabel?: string | null,
): Crumb[] {
  const crumbs: Crumb[] = []

  switch (route.kind) {
    case 'view': {
      const title = cleanTitle(view?.title) ?? cleanTitle(route.viewId) ?? 'Architecture'
      crumbs.push({ label: 'Architecture', route: { kind: 'view', viewId: route.viewId } })
      crumbs.push({ label: title })
      break
    }
    case 'page': {
      crumbs.push({ label: 'Modules' })
      const leaf = cleanTitle(route.page) ?? 'Page'
      crumbs.push({ label: leaf })
      break
    }
    case 'changelog': {
      crumbs.push({ label: 'Changelog' })
      break
    }
    case 'tour': {
      crumbs.push({ label: 'Tours' })
      crumbs.push({ label: cleanTitle(route.tourId) ?? 'Tour' })
      break
    }
  }

  // Append the selected-node label as the trailing cross-surface pin (§2).
  const trailing = selectedLabel?.trim()
  if (trailing) {
    // The previous last crumb becomes a link back to its surface; the pin is now
    // the current location.
    const prev = crumbs[crumbs.length - 1]
    if (prev && prev.route === undefined) prev.route = routeForCrumbAt(route)
    crumbs.push({ label: trailing })
  }

  // Ensure exactly the final crumb is a non-link "current" location.
  const last = crumbs[crumbs.length - 1]
  if (last) last.route = undefined

  return crumbs
}

/** The route a non-trailing crumb navigates to (its own surface). */
function routeForCrumbAt(route: AppRoute): AppRoute {
  return route
}

/** Trim a title-ish string; collapse blank/undefined to undefined (slot hides). */
function cleanTitle(value: string | undefined): string | undefined {
  if (!value) return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

/** Layout-direction indicator words from view.layoutDir (CONTRACT §2: "↓ top-down"). */
export function layoutDirLabel(layoutDir: string | undefined): { arrow: string; words: string } {
  switch ((layoutDir ?? '').toUpperCase()) {
    case 'DOWN':
      return { arrow: '↓', words: 'top-down' }
    case 'UP':
      return { arrow: '↑', words: 'bottom-up' }
    case 'RIGHT':
      return { arrow: '→', words: 'left-right' }
    case 'LEFT':
      return { arrow: '←', words: 'right-left' }
    default:
      return { arrow: '↓', words: 'top-down' }
  }
}
