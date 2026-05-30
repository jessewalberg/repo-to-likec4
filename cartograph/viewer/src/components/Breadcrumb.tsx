import type { ReactElement } from "react"
import {
  BookOpen,
  ChevronRight,
  FolderTree,
  GraduationCap,
  Map as MapIcon,
  MoreHorizontal,
  type LucideIcon,
} from "lucide-react"

import type { AppRoute, NavEntry, Site } from "../lib/types"

// CONTRACT §2 — the header breadcrumb. Derive crumbs by locating the active
// route's entry in `site.sidebar` and walking its ancestor chain
// (Architecture › Components, or Modules › tools › factory › lib › policy.mjs).
// Chevron-separated; leading crumbs are --text-muted clickable shortcuts
// (onNavigate), the last crumb is --text-strong non-link; the first crumb shows
// its section icon; the chain overflows past 4 levels with an ellipsis. When a
// node is selected the caller passes `trailingLabel` → we append a `·` middot
// then the tinted you-are-here pin so the breadcrumb is a cross-surface anchor.
//
// The derivation logic (deriveCrumbs + helpers) is React-free and kept private
// to honour this file's single-export (`Breadcrumb`) contract; it is mirrored
// verbatim in breadcrumbCrumbs.test.ts and proven there. Keep the two in step.

const MAX_VISIBLE = 4 // §2 — overflow with an ellipsis past 4 levels.

export interface BreadcrumbProps {
  route: AppRoute
  site: Site
  /** When a node is selected, the filename to pin as the you-are-here crumb. */
  trailingLabel?: string
  /** The selected node's --kind-stripe so the pin colour travels canvas→header. */
  trailingTint?: string
  onNavigate: (route: AppRoute) => void
}

/** One resolved breadcrumb. `route` undefined → non-link (the destination). */
interface Crumb {
  key: string
  label: string
  /** Section icon token — populated on the FIRST crumb only (§2). */
  icon?: string
  route?: AppRoute
}

export function Breadcrumb({
  route,
  site,
  trailingLabel,
  trailingTint,
  onNavigate,
}: BreadcrumbProps): ReactElement {
  const crumbs = collapse(deriveCrumbs(route, site))
  const pin = trailingLabel && trailingLabel.trim() ? trailingLabel.trim() : null

  return (
    <nav aria-label="Breadcrumb" className="carto-crumb">
      <ol className="carto-crumb__list">
        {crumbs.length === 0 ? (
          // Unresolvable route → never render blank; show a single neutral crumb
          // so the header chrome stays intact (graceful degrade, §0 fixture truths).
          <li className="carto-crumb__item">
            <span className="carto-crumb__leaf" aria-current="page">
              {fallbackLabel(route)}
            </span>
          </li>
        ) : (
          crumbs.map((crumb, i) => (
            <li key={crumb.key} className="carto-crumb__item">
              {i > 0 ? (
                <ChevronRight
                  className="carto-crumb__sep"
                  size={13}
                  strokeWidth={2}
                  aria-hidden="true"
                />
              ) : null}
              <CrumbNode crumb={crumb} index={i} onNavigate={onNavigate} />
            </li>
          ))
        )}

        {/* You-are-here pin: a middot then the tinted selected-node filename. */}
        {pin ? (
          <li className="carto-crumb__item carto-crumb__item--pin">
            <span className="carto-crumb__middot" aria-hidden="true">
              ·
            </span>
            <span
              className="carto-crumb__pin"
              aria-current="location"
              title={pin}
              style={trailingTint ? { color: trailingTint } : undefined}
            >
              {pin}
            </span>
          </li>
        ) : null}
      </ol>
    </nav>
  )
}

interface CrumbNodeProps {
  crumb: Crumb
  index: number
  onNavigate: (route: AppRoute) => void
}

function CrumbNode({ crumb, index, onNavigate }: CrumbNodeProps): ReactElement {
  // The collapsed-middle marker: a static ellipsis crumb (never a link); its
  // `title` lists the hidden segments so the path stays recoverable as text.
  if (crumb.key === ELLIPSIS_KEY) {
    return (
      <span
        className="carto-crumb__ellipsis"
        role="presentation"
        title={crumb.label}
      >
        <MoreHorizontal size={14} strokeWidth={2} aria-hidden="true" />
      </span>
    )
  }

  const SectionIcon = index === 0 && crumb.icon ? SECTION_ICONS[crumb.icon] : undefined

  const glyph = SectionIcon ? (
    <SectionIcon
      className="carto-crumb__icon"
      size={14}
      strokeWidth={2}
      aria-hidden="true"
    />
  ) : null

  // Last crumb (no route) → --text-strong non-link destination.
  if (!crumb.route) {
    return (
      <span className="carto-crumb__leaf" aria-current="page" title={crumb.label}>
        {glyph}
        <span className="carto-crumb__text">{crumb.label}</span>
      </span>
    )
  }

  // Leading crumb → --text-muted clickable shortcut.
  const target = crumb.route
  return (
    <button
      type="button"
      className="carto-crumb__link"
      title={crumb.label}
      onClick={() => onNavigate(target)}
    >
      {glyph}
      <span className="carto-crumb__text">{crumb.label}</span>
    </button>
  )
}

// ---- derivation (React-free; mirrored in breadcrumbCrumbs.test.ts) ----------

const ELLIPSIS_KEY = "__crumb_ellipsis__"

/** Section eyebrow glyphs keyed by the manifest `icon` token (mirrors NavTree §7). */
const SECTION_ICONS: Record<string, LucideIcon> = {
  book: BookOpen,
  map: MapIcon,
  "folder-tree": FolderTree,
  "graduation-cap": GraduationCap,
}

/** A NavEntry's own navigable route, when it is a leaf kind. */
function routeOf(entry: NavEntry): AppRoute | undefined {
  switch (entry.kind) {
    case "view":
      return entry.viewId ? { kind: "view", viewId: entry.viewId } : undefined
    case "page":
      return entry.page
        ? { kind: "page", page: entry.page, node: entry.node }
        : undefined
    case "tour":
      return entry.tourId ? { kind: "tour", tourId: entry.tourId } : undefined
    case "changelog":
      return { kind: "changelog" }
    default:
      return undefined
  }
}

/**
 * A clickable target for a *leading* crumb: its own route if it is a leaf, else
 * the first navigable descendant so a non-routable section/tree crumb (e.g.
 * "Architecture", "tools") is still a working shortcut.
 */
function firstNavigableRoute(entry: NavEntry): AppRoute | undefined {
  const own = routeOf(entry)
  if (own) return own
  for (const child of entry.children ?? []) {
    const r = firstNavigableRoute(child)
    if (r) return r
  }
  return undefined
}

/** Does this leaf entry correspond to the active route? Mirrors NavTree's matcher. */
function matchesRoute(entry: NavEntry, route: AppRoute): boolean {
  switch (entry.kind) {
    case "view":
      return route.kind === "view" && route.viewId === entry.viewId
    case "page":
      return (
        route.kind === "page" &&
        (route.page === entry.page ||
          (entry.node !== undefined && route.node === entry.node))
      )
    case "tour":
      return route.kind === "tour" && route.tourId === entry.tourId
    case "changelog":
      return route.kind === "changelog"
    default:
      return false
  }
}

/** Depth-first search for the route's entry; returns the ancestor→leaf chain. */
function findPath(entries: NavEntry[], route: AppRoute): NavEntry[] | null {
  for (const entry of entries) {
    if (matchesRoute(entry, route)) return [entry]
    const childPath = entry.children ? findPath(entry.children, route) : null
    if (childPath) return [entry, ...childPath]
  }
  return null
}

/** Locate the route in `site.sidebar` and turn its ancestor chain into crumbs. */
function deriveCrumbs(route: AppRoute, site: Site): Crumb[] {
  const path = findPath(site.sidebar ?? [], route)
  if (!path || path.length === 0) return []
  const last = path.length - 1
  return path.map((entry, i) => ({
    key: entry.id,
    label: entry.label,
    icon: i === 0 ? entry.icon : undefined,
    route: i === last ? undefined : firstNavigableRoute(entry),
  }))
}

/**
 * Overflow past 4 levels (§2): keep the first crumb (carries the section icon),
 * collapse the middle into a single ellipsis crumb whose `title` lists the
 * hidden segments, and keep the last two so the destination + its parent stay
 * visible. Chains of ≤4 are returned untouched.
 */
function collapse(crumbs: Crumb[]): Crumb[] {
  if (crumbs.length <= MAX_VISIBLE) return crumbs
  const head = crumbs[0]
  const tail = crumbs.slice(-2)
  const hidden = crumbs.slice(1, -2)
  const ellipsis: Crumb = {
    key: ELLIPSIS_KEY,
    label: hidden.map((c) => c.label).join(" › "),
  }
  return [head, ellipsis, ...tail]
}

/** Last-ditch label when no sidebar entry matches the route (never blank). */
function fallbackLabel(route: AppRoute): string {
  switch (route.kind) {
    case "view":
      return route.viewId
    case "page":
      return route.page.split("/").pop() ?? route.page
    case "tour":
      return route.tourId
    case "changelog":
      return "What changed"
    default:
      return "Cartograph"
  }
}
