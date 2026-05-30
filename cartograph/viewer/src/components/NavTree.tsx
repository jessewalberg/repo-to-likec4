import type { ReactElement } from "react"
import {
  BookOpen,
  ChevronRight,
  FileText,
  Folder,
  FolderTree,
  GraduationCap,
  History,
  Map,
  Route,
  Workflow,
  type LucideIcon,
} from "lucide-react"

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/leanCollapsible"
import { SidebarMenuButton } from "./ui/leanSidebar"
import type { AppRoute, NavEntry } from "../lib/types"

// CONTRACT §7 — the recursive Modules/nav renderer. The fixture's Modules tree
// nests 5 deep (modules → tools → factory → lib → page), so recursion is
// mandatory; this is the single component that walks NavEntry[] and decides,
// per entry, whether it's a *branch* (has a `children` array → a collapsible
// disclosure) or a *leaf* (a navigable destination → SidebarMenuButton).
//
// Two jobs beyond plain rendering: (1) cross-surface highlight — a leaf is
// active when it matches the active route OR when its `node` equals the
// selected canvas node id (selecting a card lights up its Modules row); and
// (2) wayfinding — 12px indent per depth, `--divider` guide rails, and the
// deepest `lib` folder takes the `--zone-b` left tint so the sidebar echoes the
// canvas territory. Empty branches (e.g. `per-node-lessons` with `children:[]`)
// degrade to a disabled italic empty-state leaf rather than an empty disclosure.

const MAX_DEPTH = 5 // fixture nests exactly 5 levels; guard runaway recursion.
const INDENT_PER_DEPTH = 12 // px — §7

export interface NavTreeProps {
  entries: NavEntry[]
  activeRoute: AppRoute
  activeNodeId: string | null
  onActivate: (entry: NavEntry) => void
  /** Recursion depth (0 at the section roots). Drives indent + guide rails. */
  depth?: number
}

/**
 * Recursive `role="tree"` renderer for a NavEntry[] level. The top-level call
 * (depth 0) is the tree root; nested calls (depth ≥ 1) render a `role="group"`
 * inside the parent branch's CollapsibleContent.
 */
export function NavTree({
  entries,
  activeRoute,
  activeNodeId,
  onActivate,
  depth = 0,
}: NavTreeProps): ReactElement {
  return (
    <ul
      role={depth === 0 ? "tree" : "group"}
      className="carto-nav__list"
      style={{ listStyle: "none", margin: 0, padding: 0 }}
    >
      {entries.map((entry) => (
        <NavNode
          key={entry.id}
          entry={entry}
          activeRoute={activeRoute}
          activeNodeId={activeNodeId}
          onActivate={onActivate}
          depth={depth}
        />
      ))}
    </ul>
  )
}

interface NavNodeProps {
  entry: NavEntry
  activeRoute: AppRoute
  activeNodeId: string | null
  onActivate: (entry: NavEntry) => void
  depth: number
}

function NavNode({
  entry,
  activeRoute,
  activeNodeId,
  onActivate,
  depth,
}: NavNodeProps): ReactElement {
  const isBranch = Array.isArray(entry.children)
  const indent = depth * INDENT_PER_DEPTH

  // The deepest `lib` folder gets the --zone-b left tint (sidebar↔canvas
  // continuity, §5): a tree whose final path segment (from its `dir:<path>` id),
  // equivalently its label, is exactly `lib`. A wayfinding echo, not state.
  const isLibFolder = isLibTree(entry)

  if (isBranch) {
    const children = entry.children ?? []
    const Glyph = glyphFor(entry)

    // Empty branch (e.g. per-node-lessons, children:[]) → a disabled italic
    // empty-state leaf instead of an empty, expandable-but-hollow disclosure.
    if (children.length === 0) {
      return (
        <li
          role="treeitem"
          aria-disabled="true"
          className="carto-nav__item"
          data-zone={isLibFolder ? "b" : undefined}
        >
          <div
            className="carto-nav__rail"
            style={{ paddingLeft: indent }}
            data-zone-tint={isLibFolder ? "b" : undefined}
          >
            <div className="carto-nav__row carto-nav__row--empty">
              <span className="carto-nav__chevron-spacer" aria-hidden="true" />
              <span className="carto-nav__glyph" aria-hidden="true">
                <Glyph size={14} strokeWidth={2} />
              </span>
              <span className="carto-nav__empty-label">{emptyLabelFor(entry)}</span>
            </div>
          </div>
        </li>
      )
    }

    // A real branch with children. Use the native <details> Collapsible so
    // keyboard + open state come for free; the chevron rotates on open and
    // carries aria-expanded. Guard depth so malformed data can't recurse away.
    const canRecurse = depth + 1 < MAX_DEPTH

    return (
      <li
        role="treeitem"
        aria-label={entry.label}
        className="carto-nav__item"
        data-zone={isLibFolder ? "b" : undefined}
      >
        <Collapsible defaultOpen={depth === 0} className="carto-nav__branch">
          <div
            className="carto-nav__rail"
            style={{ paddingLeft: indent }}
            data-zone-tint={isLibFolder ? "b" : undefined}
          >
            <CollapsibleTrigger className="carto-nav__row carto-nav__trigger">
              <span className="carto-nav__chevron" aria-hidden="true">
                <ChevronRight size={12} strokeWidth={2.25} />
              </span>
              <span className="carto-nav__glyph" aria-hidden="true">
                <Glyph size={14} strokeWidth={2} />
              </span>
              <span className="carto-nav__label">{entry.label}</span>
            </CollapsibleTrigger>
          </div>

          <CollapsibleContent>
            {canRecurse ? (
              <NavTree
                entries={children}
                activeRoute={activeRoute}
                activeNodeId={activeNodeId}
                onActivate={onActivate}
                depth={depth + 1}
              />
            ) : null}
          </CollapsibleContent>
        </Collapsible>
      </li>
    )
  }

  // ---- Leaf: a navigable destination. -------------------------------------
  const active = isEntryActive(entry, activeRoute, activeNodeId)
  const Glyph = glyphFor(entry)

  return (
    <li
      role="treeitem"
      aria-selected={active}
      className="carto-nav__item"
      data-zone={isLibFolder ? "b" : undefined}
    >
      <div
        className="carto-nav__rail"
        style={{ paddingLeft: indent }}
        data-zone-tint={isLibFolder ? "b" : undefined}
      >
        <SidebarMenuButton
          isActive={active}
          data-active={active ? "true" : undefined}
          className="carto-nav__row carto-nav__leaf"
          aria-current={active ? "page" : undefined}
          title={entry.label}
          onClick={() => onActivate(entry)}
        >
          {/* Leaves have no chevron; the spacer keeps glyph columns aligned. */}
          <span className="carto-nav__chevron-spacer" aria-hidden="true" />
          <span className="carto-nav__glyph" aria-hidden="true">
            <Glyph size={14} strokeWidth={2} />
          </span>
          <span className="carto-nav__label">{entry.label}</span>
        </SidebarMenuButton>
      </div>
    </li>
  )
}

/**
 * Per-kind lucide glyph (CONTRACT §7). `section` resolves by its declared
 * `entry.icon`; the rest map by kind. Every branch falls through to a Folder so
 * an unrecognised tree/group is still legible (never a blank or wrong glyph).
 */
function glyphFor(entry: NavEntry): LucideIcon {
  switch (entry.kind) {
    case "section":
      return SECTION_ICONS[entry.icon ?? ""] ?? FolderTree
    case "view":
      return Workflow
    case "page":
      return FileText
    case "changelog":
      return History
    case "tour":
      return Route
    case "group":
    case "tree":
    default:
      return Folder
  }
}

/** Section eyebrow glyphs keyed by the manifest's `icon` token (§7). */
const SECTION_ICONS: Record<string, LucideIcon> = {
  book: BookOpen,
  map: Map,
  "folder-tree": FolderTree,
  "graduation-cap": GraduationCap,
}

/**
 * Is this leaf the current destination? A page/view/tour/changelog matches when
 * the active route points at it; ANY entry additionally matches when its `node`
 * equals the selected canvas node id (cross-surface highlight, §7) — selecting a
 * card lights up its Modules page row even when the route hasn't changed.
 */
function isEntryActive(
  entry: NavEntry,
  route: AppRoute,
  activeNodeId: string | null,
): boolean {
  if (entry.node && activeNodeId && entry.node === activeNodeId) return true

  switch (entry.kind) {
    case "view":
      return route.kind === "view" && route.viewId === entry.viewId
    case "page":
      // The route carries the resolved page path; match on it, and (defensively)
      // on the node so a page selected via its node still reads active.
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

/** The deepest `lib` folder — a tree whose last path segment / label is `lib`. */
function isLibTree(entry: NavEntry): boolean {
  if (entry.kind !== "tree") return false
  const lastSeg = entry.id.split(/[:/]/).pop() ?? ""
  return lastSeg === "lib" || entry.label === "lib"
}

/** Empty-branch copy. `per-node-lessons` is the fixture's only empty group. */
function emptyLabelFor(entry: NavEntry): string {
  if (entry.source === "auto:node-lessons" || entry.id === "per-node-lessons") {
    return "No lessons captured yet"
  }
  return "Nothing here yet"
}
