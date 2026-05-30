import { useEffect, useRef, useState } from "react"
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpFromLine,
  BookOpen,
  Check,
  Copy,
  ExternalLink,
  EyeOff,
  Pin,
  X,
} from "lucide-react"

import { NodeIcon } from "./NodeIcon"
import { Legend } from "./Legend"
import { importedBy, importsOf, laneOf } from "../lib/graph"
import { kindForType, zoneForLane } from "../lib/manifestToFlow"
import type {
  Confidence,
  Group,
  KindKey,
  Manifest,
  ManifestEdge,
  ManifestNode,
  View,
} from "../lib/types"

// CONTRACT §7 — the right rail. It is NEVER empty: with nothing selected it shows
// the <Legend/>; on a node it shows header (stripe accent + full wrapping label +
// kind/confidence pills), Details (tech / path / territory), Connections
// (Imports / Imported-by, each row selects+pans the target), Source links, a
// Documentation launcher (with the honest "not written yet" sub-label, since the
// fixture's doc pages do not exist), and a Summary block only when present
// (absent on all 15 fixture nodes -> the slot collapses cleanly). On an edge it
// shows an "imports" header, source->target chips, and type/confidence pills.
// Esc or the × button closes (App returns focus to the selected node).

type Selection =
  | { kind: "node"; node: ManifestNode }
  | { kind: "edge"; edge: ManifestEdge }
  | null

interface DetailPanelProps {
  selection: Selection
  manifest: Manifest
  view: View
  onSelectNode: (id: string) => void
  onClose: () => void
  /** Navigate to a node's doc page. */
  onOpenDoc?: (docRef: string, nodeId: string) => void
  /** Whether a doc page actually exists (drives the "not written yet" sub-label). */
  docExists?: (docRef: string) => boolean
  // Editing parity (optional): rename / pin / annotate / hide.
  onRename?: (nodeId: string, label: string) => void
  onTogglePin?: (nodeId: string, pinned: boolean) => void
  onAnnotate?: (nodeId: string, text: string) => void
  onHide?: (nodeId: string) => void
}

// ---------------------------------------------------------------------------
// Pure decision helpers (DOM-free; mirrored verbatim in detailPanelText.test.ts).
// Kept private to honour the single-export contract — keep the two in lockstep.
// ---------------------------------------------------------------------------

// kindForType + zoneForLane are imported from ../lib/manifestToFlow (one source
// of truth — the same mapping the canvas transform uses) rather than re-declared.

/** Human label for a kind pill (calm, never an alarm). */
function kindLabel(kind: KindKey): string {
  if (kind === "external") return "module"
  return kind
}

/** Non-alarmist confidence pill (§7): `static` -> calm "verified" (--n-100). */
function confidencePill(
  confidence?: Confidence,
): { label: string; tone: "calm" | "soft" | "warn" } {
  switch (confidence) {
    case "static":
      return { label: "verified", tone: "calm" }
    case "inferred":
      return { label: "inferred", tone: "soft" }
    case "unknown":
      return { label: "unverified", tone: "warn" }
    default:
      return { label: "verified", tone: "calm" }
  }
}

const LANE_DESCRIPTOR: Record<string, string> = {
  root: "entry-point runners",
  lib: "shared modules",
}

/** Disambiguating territory chip (§5/§7): "Root — entry-point runners" / "lib — shared modules". */
function territoryChip(
  lane: Group | undefined,
): { label: string; descriptor: string | null } | null {
  if (!lane) return null
  const descriptor = LANE_DESCRIPTOR[lane.label.toLowerCase()] ?? null
  return { label: lane.label, descriptor }
}

/** Mono path from metadata.path (string only; numeric/absent -> null). */
function resolvePath(node: ManifestNode): string | null {
  const p = node.data.metadata?.path
  return typeof p === "string" && p.trim() ? p.trim() : null
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DetailPanel({
  selection,
  manifest,
  view,
  onSelectNode,
  onClose,
  onOpenDoc,
  docExists,
  onRename,
  onTogglePin,
  onAnnotate,
  onHide,
}: DetailPanelProps): React.ReactElement {
  const panelRef = useRef<HTMLDivElement>(null)

  // Esc closes (App returns focus to the selected node). Scoped to the panel so
  // it does not fight the canvas/global Esc handlers when nothing is selected.
  useEffect(() => {
    if (!selection) return
    const node = panelRef.current
    if (!node) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation()
        onClose()
      }
    }
    node.addEventListener("keydown", onKeyDown)
    return () => node.removeEventListener("keydown", onKeyDown)
  }, [selection, onClose])

  // Right rail is NEVER empty: no selection -> the Legend.
  if (!selection) {
    return (
      <aside
        ref={panelRef}
        id="detail"
        className="carto-detail"
        aria-label="Legend"
        tabIndex={-1}
        style={panelSurfaceStyle}
      >
        <Legend view={view} manifest={manifest} />
      </aside>
    )
  }

  if (selection.kind === "edge") {
    return (
      <aside
        ref={panelRef}
        id="detail"
        className="carto-detail"
        role="region"
        aria-label="Edge details"
        tabIndex={-1}
        style={panelSurfaceStyle}
      >
        <EdgeDetail edge={selection.edge} manifest={manifest} onClose={onClose} />
      </aside>
    )
  }

  return (
    <aside
      ref={panelRef}
      className="carto-detail"
      role="region"
      aria-label={`Details for ${selection.node.data.label}`}
      tabIndex={-1}
      style={panelSurfaceStyle}
    >
      <NodeDetail
        node={selection.node}
        manifest={manifest}
        view={view}
        onSelectNode={onSelectNode}
        onClose={onClose}
        onOpenDoc={onOpenDoc}
        docExists={docExists}
        onRename={onRename}
        onTogglePin={onTogglePin}
        onAnnotate={onAnnotate}
        onHide={onHide}
      />
    </aside>
  )
}

const panelSurfaceStyle: React.CSSProperties = {
  background: "var(--elev-panel)",
  borderLeft: "1px solid var(--elev-panel-border)",
}

// ---------------------------------------------------------------------------
// Node detail
// ---------------------------------------------------------------------------

function NodeDetail({
  node,
  manifest,
  view,
  onSelectNode,
  onClose,
  onOpenDoc,
  docExists,
  onRename,
  onTogglePin,
  onAnnotate,
  onHide,
}: {
  node: ManifestNode
  manifest: Manifest
  view: View
  onSelectNode: (id: string) => void
  onClose: () => void
  onOpenDoc?: (docRef: string, nodeId: string) => void
  docExists?: (docRef: string) => boolean
  onRename?: (nodeId: string, label: string) => void
  onTogglePin?: (nodeId: string, pinned: boolean) => void
  onAnnotate?: (nodeId: string, text: string) => void
  onHide?: (nodeId: string) => void
}): React.ReactElement {
  const kind = kindForType(node.type)
  const conf = confidencePill(node.data.confidence)
  const path = resolvePath(node)
  const summary = node.data.summary?.trim() ? node.data.summary.trim() : null
  const tech = node.data.technology?.trim() ? node.data.technology.trim() : null
  const links = node.data.links?.filter((l) => typeof l.url === "string" && l.url.trim()) ?? []

  // Territory: lane + zone for the swatch. Zone needs the lane order across the view.
  const lane = laneOf(manifest, node.id)
  const territory = territoryChip(lane)
  const laneOrder = laneOrderForView(manifest, view)
  const zone = lane ? zoneForLane(lane.id, laneOrder) : undefined

  // Connections (the panel's best trick): outgoing / incoming, deduped to nodes.
  const imports = importsOf(manifest, node.id)
  const importers = importedBy(manifest, node.id)

  return (
    <>
      {/* Header — 3px top accent rule travels the kind stripe colour canvas->panel. */}
      <header
        data-kind={kind}
        className="carto-detail__header"
        style={{ borderTop: "3px solid var(--kind-stripe)" }}
      >
        <button
          type="button"
          className="carto-detail__close"
          aria-label="Close details"
          onClick={onClose}
        >
          <X size={16} strokeWidth={2} aria-hidden="true" />
        </button>

        <div className="carto-detail__title">
          <span
            className="carto-detail__glyph"
            aria-hidden="true"
            style={{
              background: "var(--kind-bg)",
              color: "var(--kind-fg)",
              borderRadius: "var(--r-sm)",
            }}
          >
            <NodeIcon node={{ type: node.type, data: { technology: node.data.technology } }} size={18} />
          </span>
          {/* Full label, WRAPPING, no truncation (§7). */}
          <h2 className="carto-detail__label">{node.data.label}</h2>
        </div>

        <div className="carto-detail__pills">
          <span
            className="carto-detail__pill"
            style={{
              background: "var(--kind-bg)",
              color: "var(--kind-fg)",
              borderRadius: "var(--r-pill)",
            }}
          >
            {kindLabel(kind)}
          </span>
          <ConfidencePill pill={conf} />
        </div>
      </header>

      <div className="carto-detail__body">
        {/* Details — eyebrow captions. */}
        {tech ? (
          <Field caption="Technology">
            <span className="carto-detail__mono">{tech}</span>
          </Field>
        ) : null}

        {path ? (
          <Field caption="Path">
            <CopyPath path={path} />
          </Field>
        ) : null}

        {territory ? (
          <Field caption="Territory">
            <span data-zone={zone} className="carto-detail__territory">
              <span
                aria-hidden="true"
                className="carto-detail__territory-tick"
                style={{ background: "var(--zone)" }}
              />
              <span className="carto-detail__territory-label">{territory.label}</span>
              {territory.descriptor ? (
                <span className="carto-detail__territory-desc">— {territory.descriptor}</span>
              ) : null}
            </span>
          </Field>
        ) : null}

        {/* Connections — Imports(n) / Imported-by(n); each row selects+pans the target. */}
        <section className="carto-detail__section" aria-label="Connections">
          <ConnectionGroup
            caption={`Imports (${imports.length})`}
            icon={<ArrowDownToLine size={13} strokeWidth={2} aria-hidden="true" />}
            nodes={imports}
            emptyLabel="No imports recorded."
            onSelectNode={onSelectNode}
          />
          <ConnectionGroup
            caption={`Imported by (${importers.length})`}
            icon={<ArrowUpFromLine size={13} strokeWidth={2} aria-hidden="true" />}
            nodes={importers}
            emptyLabel="Not imported by anything in this view."
            onSelectNode={onSelectNode}
          />
        </section>

        {/* Source links — full rows, target _blank rel noreferrer. */}
        {links.length > 0 ? (
          <section className="carto-detail__section" aria-label="Source links">
            <p className="carto-detail__caption">Source</p>
            <ul className="carto-detail__links">
              {links.map((l, i) => (
                <li key={`${l.url}-${i}`}>
                  <a
                    className="carto-detail__link-row"
                    href={l.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink size={13} strokeWidth={2} aria-hidden="true" />
                    <span className="carto-detail__link-label">{l.label || "Open source"}</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* Documentation — Open doc page; the "not written yet" sub-label shows only
            when the page genuinely doesn't exist. */}
        {node.data.doc ? (
          <section className="carto-detail__section" aria-label="Documentation">
            <p className="carto-detail__caption">Documentation</p>
            <DocButton
              exists={docExists?.(node.data.doc) ?? false}
              onOpen={() => onOpenDoc?.(node.data.doc as string, node.id)}
            />
          </section>
        ) : null}

        {/* Summary — only when present. */}
        {summary ? (
          <section className="carto-detail__section" aria-label="Summary">
            <p className="carto-detail__caption">Summary</p>
            <p className="carto-detail__summary">{summary}</p>
          </section>
        ) : null}

        {/* Edit — rename / pin / annotate / hide (editing parity). */}
        {onRename || onTogglePin || onAnnotate || onHide ? (
          <EditSection
            node={node}
            onRename={onRename}
            onTogglePin={onTogglePin}
            onAnnotate={onAnnotate}
            onHide={onHide}
          />
        ) : null}
      </div>
    </>
  )
}

function EditSection({
  node,
  onRename,
  onTogglePin,
  onAnnotate,
  onHide,
}: {
  node: ManifestNode
  onRename?: (nodeId: string, label: string) => void
  onTogglePin?: (nodeId: string, pinned: boolean) => void
  onAnnotate?: (nodeId: string, text: string) => void
  onHide?: (nodeId: string) => void
}): React.ReactElement {
  const [label, setLabel] = useState(node.data.label)
  const [note, setNote] = useState(node.data.annotation ?? "")
  // Re-seed local fields when the selected node changes.
  const seededFor = useRef(node.id)
  if (seededFor.current !== node.id) {
    seededFor.current = node.id
    setLabel(node.data.label)
    setNote(node.data.annotation ?? "")
  }
  const pinned = node.data.pinned === true

  return (
    <section className="carto-detail__section carto-detail__edit" aria-label="Edit">
      <p className="carto-detail__caption">Edit</p>

      {onRename ? (
        <label className="carto-detail__field">
          <span className="carto-detail__field-label">Label</span>
          <input
            className="carto-detail__input"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={() => label.trim() && label !== node.data.label && onRename(node.id, label.trim())}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur()
            }}
          />
        </label>
      ) : null}

      {onAnnotate ? (
        <label className="carto-detail__field">
          <span className="carto-detail__field-label">Annotation</span>
          <textarea
            className="carto-detail__textarea"
            rows={2}
            placeholder="Add a note…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => note !== (node.data.annotation ?? "") && onAnnotate(node.id, note)}
          />
        </label>
      ) : null}

      <div className="carto-detail__edit-actions">
        {onTogglePin ? (
          <button
            type="button"
            className="carto-detail__edit-btn"
            aria-pressed={pinned}
            onClick={() => onTogglePin(node.id, !pinned)}
          >
            <Pin size={13} strokeWidth={2} aria-hidden="true" />
            {pinned ? "Pinned" : "Pin"}
          </button>
        ) : null}
        {onHide ? (
          <button type="button" className="carto-detail__edit-btn carto-detail__edit-btn--danger" onClick={() => onHide(node.id)}>
            <EyeOff size={13} strokeWidth={2} aria-hidden="true" />
            Hide
          </button>
        ) : null}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Edge detail
// ---------------------------------------------------------------------------

function EdgeDetail({
  edge,
  manifest,
  onClose,
}: {
  edge: ManifestEdge
  manifest: Manifest
  onClose: () => void
}): React.ReactElement {
  const conf = confidencePill(edge.confidence)
  const sourceLabel = manifest.nodes[edge.source]?.data.label ?? edge.source
  const targetLabel = manifest.nodes[edge.target]?.data.label ?? edge.target
  const typeLabel = edge.type || "imports"

  return (
    <>
      <header className="carto-detail__header" style={{ borderTop: "3px solid var(--n-500)" }}>
        <button
          type="button"
          className="carto-detail__close"
          aria-label="Close details"
          onClick={onClose}
        >
          <X size={16} strokeWidth={2} aria-hidden="true" />
        </button>
        <div className="carto-detail__title">
          <span
            className="carto-detail__glyph"
            aria-hidden="true"
            style={{ background: "var(--canvas-sunken)", color: "var(--text-muted)", borderRadius: "var(--r-sm)" }}
          >
            <ArrowDownToLine size={18} strokeWidth={2} aria-hidden="true" />
          </span>
          <h2 className="carto-detail__label">{typeLabel}</h2>
        </div>
      </header>

      <div className="carto-detail__body">
        <section className="carto-detail__section" aria-label="Relationship">
          <p className="carto-detail__caption">Relationship</p>
          <p
            className="carto-detail__edge-flow"
            aria-label={`${sourceLabel} ${typeLabel} ${targetLabel}`}
          >
            <span className="carto-detail__chip" title={sourceLabel}>
              {sourceLabel}
            </span>
            <span className="carto-detail__edge-arrow" aria-hidden="true">
              {typeLabel} ↓
            </span>
            <span className="carto-detail__chip" title={targetLabel}>
              {targetLabel}
            </span>
          </p>
        </section>

        <div className="carto-detail__pills carto-detail__pills--edge">
          <span
            className="carto-detail__pill"
            style={{
              background: "var(--canvas-sunken)",
              color: "var(--text-muted)",
              borderRadius: "var(--r-pill)",
            }}
          >
            {typeLabel}
          </span>
          <ConfidencePill pill={conf} />
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Small parts
// ---------------------------------------------------------------------------

function Field({
  caption,
  children,
}: {
  caption: string
  children: React.ReactNode
}): React.ReactElement {
  return (
    <div className="carto-detail__field">
      <p className="carto-detail__caption">{caption}</p>
      {children}
    </div>
  )
}

function ConfidencePill({
  pill,
}: {
  pill: { label: string; tone: "calm" | "soft" | "warn" }
}): React.ReactElement {
  const bg =
    pill.tone === "warn"
      ? "color-mix(in oklch, var(--warn-fg) 14%, var(--canvas))"
      : pill.tone === "soft"
        ? "var(--canvas-sunken)"
        : "var(--n-100)"
  const fg = pill.tone === "warn" ? "var(--warn-fg)" : "var(--text-muted)"
  return (
    <span
      className="carto-detail__pill"
      style={{ background: bg, color: fg, borderRadius: "var(--r-pill)" }}
    >
      {pill.label}
    </span>
  )
}

function ConnectionGroup({
  caption,
  icon,
  nodes,
  emptyLabel,
  onSelectNode,
}: {
  caption: string
  icon: React.ReactNode
  nodes: ManifestNode[]
  emptyLabel: string
  onSelectNode: (id: string) => void
}): React.ReactElement {
  return (
    <div className="carto-detail__conn">
      <p className="carto-detail__caption carto-detail__caption--icon">
        {icon}
        <span>{caption}</span>
      </p>
      {nodes.length === 0 ? (
        <p className="carto-detail__empty">{emptyLabel}</p>
      ) : (
        <ul className="carto-detail__conn-list">
          {nodes.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                className="carto-detail__conn-row"
                onClick={() => onSelectNode(n.id)}
                title={
                  typeof n.data.metadata?.path === "string"
                    ? n.data.metadata.path
                    : n.data.label
                }
              >
                <span
                  className="carto-detail__conn-glyph"
                  aria-hidden="true"
                  data-kind={kindForType(n.type)}
                  style={{ color: "var(--kind-fg)" }}
                >
                  <NodeIcon node={{ type: n.type, data: { technology: n.data.technology } }} size={13} />
                </span>
                <span className="carto-detail__conn-label">{n.data.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function CopyPath({ path }: { path: string }): React.ReactElement {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  const onCopy = () => {
    const done = () => {
      setCopied(true)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), 1400)
    }
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(path).then(done, () => {})
    } else {
      done()
    }
  }

  return (
    <button
      type="button"
      className="carto-detail__copy"
      onClick={onCopy}
      aria-label={copied ? `Copied ${path}` : `Copy path ${path}`}
      title="Copy path"
    >
      <span className="carto-detail__mono carto-detail__copy-text">{path}</span>
      <span className="carto-detail__copy-icon" aria-hidden="true">
        {copied ? <Check size={13} strokeWidth={2.25} /> : <Copy size={13} strokeWidth={2} />}
      </span>
    </button>
  )
}

function DocButton({ exists, onOpen }: { exists: boolean; onOpen: () => void }): React.ReactElement {
  // Routes to the doc page (App owns the route). When the page hasn't been
  // authored yet, an honest --warn-fg sub-label sets the expectation up front
  // (the route still works — it lands on the missing-page launchpad). §6/§11.
  return (
    <div className="carto-detail__doc">
      <button type="button" className="carto-detail__doc-btn" onClick={onOpen}>
        <BookOpen size={14} strokeWidth={2} aria-hidden="true" />
        <span>Open doc page</span>
        <ArrowRight size={13} strokeWidth={2} aria-hidden="true" className="carto-detail__doc-arrow" />
      </button>
      {exists ? null : (
        <span className="carto-detail__doc-sub" style={{ color: "var(--warn-fg)" }}>
          not written yet
        </span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Local helpers
// ---------------------------------------------------------------------------

/** Distinct lane parentIds in first-appearance order across the view (zone source). */
function laneOrderForView(manifest: Manifest, view: View): string[] {
  const order: string[] = []
  for (const id of view.nodeIds) {
    const p = manifest.nodes[id]?.parentId
    if (p && manifest.groups[p] && !order.includes(p)) order.push(p)
  }
  return order
}
