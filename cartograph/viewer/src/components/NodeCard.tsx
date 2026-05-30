import { Handle, Position, type Node, type NodeProps } from "@xyflow/react"
import { ExternalLink, HelpCircle, Pin } from "lucide-react"
import { NodeIcon } from "./NodeIcon"
import { nodeAriaLabel, parentDirCrumb, techTag } from "./nodeCardText"
import type { CardNodeData, CartoNode } from "../lib/types"

// CONTRACT §3 — the HERO node (RF nodeType 'card'). Fixed 220x72, presentation
// only: selection / neighbor-dim arrive as data flags from Canvas. Every layer
// (kind stripe, role glyph, label, meta row, Source affordance, 2 handles) and
// every state (default / hover / focus / selected / muted / dimmed / pinned)
// lives here. Token colour comes from the [data-kind]/[data-zone] selectors in
// tokens.css via the data-kind attribute — never a hard-coded hue.

/** The card branch of the CartoNode union (lanes are rendered by LaneNode). */
type CardNode = Extract<CartoNode, { type: "card" }>

export function NodeCard(props: NodeProps<CardNode>): React.ReactElement {
  // NodeProps<CartoNode> per spec; this component owns the 'card' branch so we
  // read CardNodeData directly. The Extract<> above keeps `data` strictly typed.
  const { data, selected } = props as NodeProps<Node<CardNodeData, "card">>

  const muted = data.confidence === "unknown" // confidence outranks kind (§3)
  const dimmed = data.dimmed === true
  const pinned = data.pinned === true

  // Derived, never-empty text slots (pure helpers; tested in nodeCardText.test).
  const tech = techTag(data.technology)
  const crumb = data.summary && data.summary.trim() ? null : parentDirCrumb(data.metadataPath)
  const summary = data.summary && data.summary.trim() ? data.summary.trim() : null
  const sourceLink = data.links?.find((l) => l.url)?.url ? data.links.find((l) => l.url) : undefined

  const ariaLabel = nodeAriaLabel({
    label: data.label,
    kind: muted ? "unknown confidence" : data.kind,
    zone: zoneLabel(data.zone),
    importsCount: data.importsCount,
    importedByCount: data.importedByCount,
  })

  // Muted overrides kind colouring: drop data-kind so the card falls back to
  // the neutral hairline/n-300 styling defined in the css block below.
  const rootProps = muted ? {} : { "data-kind": data.kind }

  return (
    <div
      {...rootProps}
      data-selected={selected ? "true" : undefined}
      data-muted={muted ? "true" : undefined}
      data-dimmed={dimmed ? "true" : undefined}
      data-pinned={pinned ? "true" : undefined}
      className="carto-card"
      role="button"
      aria-label={ariaLabel}
      aria-selected={selected ?? false}
      title={data.label}
    >
      {/* (1) kind stripe — 6px, widens to 8px when selected (§3) */}
      <span className="carto-card__stripe" aria-hidden="true" />

      {/* Top-target handle (DOWN layout): dependencies enter from the top. */}
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={false}
        className="carto-card__handle"
      />

      <div className="carto-card__inner">
        {/* (3) role glyph — 22px, kind-bg tint, kind-fg icon (brand on exact
            tech match, else neutral type glyph; never a wrong brand). */}
        <span className="carto-card__glyph" aria-hidden="true">
          <NodeIcon
            node={{ type: data.nodeType, data: { technology: data.technology } }}
            size={14}
          />
        </span>

        <div className="carto-card__text">
          {/* (4) label — 14px semibold, single line ellipsis */}
          <span className="carto-card__label">{data.label}</span>

          {/* (5) meta row — mono tech tag + (summary | parent-dir crumb). Never
              empty: fixture has no summary, so the crumb differentiates cards. */}
          <span className="carto-card__meta">
            {tech ? (
              <span className="carto-card__tech" title={data.technology}>
                {tech}
              </span>
            ) : null}
            {summary ? (
              <span className="carto-card__sub" title={summary}>
                <span className="carto-card__dot" aria-hidden="true">
                  ·
                </span>
                {summary}
              </span>
            ) : crumb ? (
              <span className="carto-card__sub" title={data.metadataPath}>
                <span className="carto-card__dot" aria-hidden="true">
                  ·
                </span>
                {crumb}
              </span>
            ) : null}
          </span>
        </div>

        {/* muted '?' chip — confidence unknown (wired; none in fixture). */}
        {muted ? (
          <span className="carto-card__muted-chip" aria-hidden="true">
            <HelpCircle size={12} strokeWidth={2} />
          </span>
        ) : null}

        {/* (6) Source affordance — top-right, hidden at rest, revealed on hover
            AND :focus-visible (keyboard users see it). Exempt from dim sweep. */}
        {sourceLink ? (
          <a
            className="carto-card__source"
            href={sourceLink.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${sourceLink.label ?? "Source"}: open ${data.label} on GitHub`}
            title={sourceLink.label ?? "Source"}
            // Don't let the link click bubble into node selection.
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <ExternalLink size={12} strokeWidth={2} aria-hidden="true" />
          </a>
        ) : null}

        {/* Pinned marker — amber pin top-right, exempt from dim (wired). */}
        {pinned ? (
          <span className="carto-card__pin" aria-hidden="true" title="Pinned">
            <Pin size={12} strokeWidth={2} fill="currentColor" />
          </span>
        ) : null}
      </div>

      {/* Bottom-source handle (DOWN layout): imports leave from the bottom. */}
      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={false}
        className="carto-card__handle"
      />
    </div>
  )
}

/** Human-readable lane name for the ARIA label (zone key -> territory name). */
function zoneLabel(zone?: string): string | undefined {
  if (zone === "a") return "Root"
  if (zone === "b") return "lib"
  return undefined
}
