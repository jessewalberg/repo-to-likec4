import { Fragment } from "react"
import {
  ChevronRight,
  Download,
  History,
  Maximize,
  Network,
  PanelLeft,
  Redo2,
  Route as RouteIcon,
  Search,
  Undo2,
  Workflow,
} from "lucide-react"
import {
  type Crumb,
  crumbsForRoute,
  layoutDirLabel,
  viewStats,
} from "./appHeaderText"
import type { AppRoute, Manifest, View } from "../lib/types"

// CONTRACT §2 — the 48px top bar. Quiet IDE chrome: bg --canvas, 1px --divider
// bottom, NO shadow, NO app name. Left = sidebar toggle + an INLINE breadcrumb
// (rendered here, not via <Breadcrumb>, because we have no `site` prop) that
// appends the selected node as a cross-surface "you are here" pin. Right = a
// live, never-NaN stat readout + Fit (key F) + a layoutDir indicator + a ⌘K
// trigger. All token colour is via CSS vars; only layout uses Tailwind utilities.

interface AppHeaderProps {
  route: AppRoute
  view?: View
  manifest: Manifest
  selectedNodeId: string | null
  onCrumbNavigate: (route: AppRoute) => void
  onFit: () => void
  onOpenSearch: () => void
  onToggleSidebar: () => void
  // Editing parity (undo/redo/export) — optional so the header degrades cleanly.
  dirty?: boolean
  canUndo?: boolean
  canRedo?: boolean
  onUndo?: () => void
  onRedo?: () => void
  onExport?: () => void
}

export function AppHeader({
  route,
  view,
  manifest,
  selectedNodeId,
  onCrumbNavigate,
  onFit,
  onOpenSearch,
  onToggleSidebar,
  dirty = false,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  onExport,
}: AppHeaderProps): React.ReactElement {
  // Selected-node label looked up from the manifest (graceful: unknown id -> no
  // pin rather than a blank/undefined crumb).
  const selectedLabel = selectedNodeId
    ? manifest.nodes[selectedNodeId]?.data.label ?? null
    : null

  const crumbs = crumbsForRoute(route, view, selectedLabel)
  const stats = viewStats(view, manifest)
  const dir = layoutDirLabel(view?.layoutDir)

  // The leading section icon belongs to the first crumb (its surface kind).
  const SectionIcon = sectionIconFor(route)

  return (
    <header
      className="carto-header"
      style={{
        background: "var(--canvas)",
        borderBottom: "1px solid var(--divider)",
      }}
    >
      {/* ---- Left: sidebar toggle + inline breadcrumb ---- */}
      <div className="carto-header__left">
        <button
          type="button"
          className="carto-header__icon-btn"
          onClick={onToggleSidebar}
          aria-label="Toggle sidebar"
          title="Toggle sidebar  ⌘B"
        >
          <PanelLeft size={16} strokeWidth={2} aria-hidden="true" />
        </button>

        <nav className="carto-header__crumbs" aria-label="Breadcrumb">
          <ol className="carto-header__crumb-list">
            {crumbs.map((crumb, i) => (
              <Fragment key={`${crumb.label}-${i}`}>
                {i > 0 && (
                  <li aria-hidden="true" className="carto-header__crumb-sep">
                    <ChevronRight size={13} strokeWidth={2} />
                  </li>
                )}
                <li className="carto-header__crumb">
                  <CrumbItem
                    crumb={crumb}
                    icon={i === 0 ? <SectionIcon size={13} strokeWidth={2} aria-hidden="true" /> : null}
                    isLast={i === crumbs.length - 1}
                    onNavigate={onCrumbNavigate}
                  />
                </li>
              </Fragment>
            ))}
          </ol>
        </nav>
      </div>

      {/* ---- Right: stat readout + Fit + layoutDir + ⌘K ---- */}
      <div className="carto-header__right">
        <p className="carto-header__stats" aria-label={statsAriaLabel(stats)}>
          {stats.empty ? (
            <span className="carto-header__stat-empty">empty view</span>
          ) : (
            <>
              <Stat value={stats.nodes} unit={plural(stats.nodes, "node")} />
              <Sep />
              <Stat value={stats.edges} unit={plural(stats.edges, "edge")} />
              <Sep />
              <Stat value={stats.lanes} unit={plural(stats.lanes, "lane")} />
            </>
          )}
        </p>

        <span className="carto-header__divider" aria-hidden="true" />

        <button
          type="button"
          className="carto-header__icon-btn"
          onClick={onFit}
          aria-label="Fit view"
          title="Fit view  F"
        >
          <Maximize size={15} strokeWidth={2} aria-hidden="true" />
        </button>

        <span
          className="carto-header__layoutdir"
          title={`Layout direction: ${dir.words}`}
        >
          <span aria-hidden="true" className="carto-header__layoutdir-arrow">
            {dir.arrow}
          </span>
          <span className="carto-header__layoutdir-words">{dir.words}</span>
        </span>

        <span className="carto-header__divider" aria-hidden="true" />

        {/* ---- Editing parity: undo / redo / export ---- */}
        <button
          type="button"
          className="carto-header__icon-btn"
          onClick={onUndo}
          disabled={!canUndo}
          aria-label="Undo"
          title="Undo  ⌘Z"
        >
          <Undo2 size={15} strokeWidth={2} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="carto-header__icon-btn"
          onClick={onRedo}
          disabled={!canRedo}
          aria-label="Redo"
          title="Redo  ⇧⌘Z"
        >
          <Redo2 size={15} strokeWidth={2} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="carto-header__icon-btn carto-header__export"
          onClick={onExport}
          aria-label={dirty ? "Export edited manifest (unsaved edits)" : "Export manifest"}
          title="Download architecture.json"
        >
          <Download size={15} strokeWidth={2} aria-hidden="true" />
          {dirty ? <span className="carto-header__dirty" aria-hidden="true" /> : null}
        </button>

        <span className="carto-header__divider" aria-hidden="true" />

        <button
          type="button"
          className="carto-header__cmdk"
          onClick={onOpenSearch}
          aria-label="Search  (Command or Control K)"
          title="Search  ⌘K"
        >
          <Search size={14} strokeWidth={2} aria-hidden="true" />
          <span className="carto-header__cmdk-label">Search</span>
          <kbd className="carto-header__kbd" aria-hidden="true">
            ⌘K
          </kbd>
        </button>
      </div>
    </header>
  )
}

/** One breadcrumb: a back-link when navigable, plain text for the current crumb. */
function CrumbItem({
  crumb,
  icon,
  isLast,
  onNavigate,
}: {
  crumb: Crumb
  icon: React.ReactNode
  isLast: boolean
  onNavigate: (route: AppRoute) => void
}): React.ReactElement {
  if (crumb.route) {
    const target = crumb.route
    return (
      <button
        type="button"
        className="carto-header__crumb-link"
        onClick={() => onNavigate(target)}
      >
        {icon}
        <span>{crumb.label}</span>
      </button>
    )
  }
  return (
    <span
      className="carto-header__crumb-current"
      aria-current={isLast ? "page" : undefined}
    >
      {icon}
      <span>{crumb.label}</span>
    </span>
  )
}

function Stat({ value, unit }: { value: number; unit: string }): React.ReactElement {
  return (
    <span className="carto-header__stat">
      <span className="carto-header__stat-num">{value}</span> {unit}
    </span>
  )
}

function Sep(): React.ReactElement {
  return (
    <span aria-hidden="true" className="carto-header__stat-sep">
      ·
    </span>
  )
}

/** "node" / "nodes" without ever showing a NaN-prone count. */
function plural(n: number, word: string): string {
  return n === 1 ? word : `${word}s`
}

/** Spoken summary of the stat readout for screen readers. */
function statsAriaLabel(stats: ReturnType<typeof viewStats>): string {
  if (stats.empty) return "Empty view"
  return `${stats.nodes} ${plural(stats.nodes, "node")}, ${stats.edges} ${plural(
    stats.edges,
    "edge",
  )}, ${stats.lanes} ${plural(stats.lanes, "lane")}`
}

/** Section glyph for the first crumb, by route kind (mirrors the sidebar §7). */
function sectionIconFor(route: AppRoute): typeof Network {
  switch (route.kind) {
    case "view":
      return Network
    case "page":
      return Workflow
    case "changelog":
      return History
    case "tour":
      return RouteIcon
  }
}
