import { ArrowDown } from "lucide-react"

import { laneCounts, presentEdgeVariants, presentKinds } from "../lib/graph"
import type { EdgeVariant, KindKey, Manifest, View, ZoneKey } from "../lib/types"
import { NodeIcon } from "./NodeIcon"

// CONTRACT §7 — the Atlas key. Rendered in the right rail by DetailPanel whenever
// nothing is selected, so the rail is never empty. It is a pure read-out of the
// CURRENT view and advertises ONLY present affordances. Three sections — Territories
// (the lanes you can see, with disambiguating descriptors so "Root" is never misread
// as the repo root), Roles (the role glyphs in play, each labelled so kind is always
// recoverable as text — 1.4.1), Routes (the 3 edge variants; present ones at full
// strength, dormant ones dimmed + "not in this view") — plus a flows-direction note
// derived from view.layoutDir. Every derivation comes from the already-tested pure
// helpers in ../lib/graph; this file is presentation only and carries no motion
// (it is information, applied instantly), so it needs no reduced-motion gate.

interface LegendProps {
  view: View
  manifest: Manifest
}

// Territory descriptor by lane label (CONTRACT §4/§5). "Root" is the *entrypoints*
// territory, NOT the repo root — the descriptor disambiguates. Mirrors the
// LANE_DESCRIPTOR table in manifestToFlow so canvas + legend tell the same story.
const LANE_DESCRIPTOR: Record<string, string> = {
  root: "entry-point runners",
  lib: "shared modules",
}

// Human label for each kind glyph (CONTRACT §3: the legend prints glyph labels so
// kind is always recoverable as text — colour is never the only signal).
const KIND_LABEL: Record<KindKey, string> = {
  service: "Service",
  frontend: "Frontend",
  datastore: "Datastore",
  infra: "Infrastructure",
  external: "Component",
  queue: "Queue / event",
}

// A representative node type per kind so NodeIcon picks the right neutral glyph.
// external→component keeps the fixture's calm package glyph, not a generic box.
const KIND_SAMPLE_TYPE: Record<KindKey, string> = {
  service: "service",
  frontend: "frontend",
  datastore: "datastore",
  infra: "infra",
  external: "component",
  queue: "queue",
}

interface RouteSpec {
  variant: EdgeVariant
  label: string
  meaning: string
  /** swatch colour token (mirrors the edge stroke tokens in tokens.css). */
  stroke: string
  /** dashed swatch for async — distinguishable by pattern, not colour alone. */
  dashed?: boolean
}

// The 3 edge variants in their canonical order (CONTRACT §6). We always print all
// three so the vocabulary is complete; present-ness is conveyed per row below.
const ROUTES: RouteSpec[] = [
  {
    variant: "sync",
    label: "Imports",
    meaning: "depends on / calls",
    stroke: "var(--carto-edge-sync)",
  },
  {
    variant: "data",
    label: "Data flow",
    meaning: "reads / writes",
    stroke: "var(--carto-edge-data)",
  },
  {
    variant: "async",
    label: "Async event",
    meaning: "publishes / subscribes",
    stroke: "var(--carto-edge-async)",
    dashed: true,
  },
]

export function Legend({ view, manifest }: LegendProps): React.ReactElement {
  // All three derivations are pure and already unit-tested in graph.test.ts.
  const counts = laneCounts(manifest, view)
  const kinds = presentKinds(manifest, view)
  const presentVariants = new Set<EdgeVariant>(presentEdgeVariants(manifest, view))

  // Lanes present, in the order manifestToFlow emits them (first-appearance across
  // view.nodeIds) so the zone assignment here matches the canvas exactly (even→a,
  // odd→b). Counts come from laneCounts; never NaN/undefined.
  const lanes: {
    id: string
    label: string
    zone: ZoneKey
    count: number
    descriptor: string
  }[] = []
  const seenLane = new Set<string>()
  for (const id of view.nodeIds) {
    const parentId = manifest.nodes[id]?.parentId
    if (!parentId || !manifest.groups[parentId] || seenLane.has(parentId)) continue
    seenLane.add(parentId)
    const group = manifest.groups[parentId]
    const zone: ZoneKey = lanes.length % 2 === 0 ? "a" : "b"
    lanes.push({
      id: parentId,
      label: group.label,
      zone,
      count: counts[parentId] ?? 0,
      descriptor: LANE_DESCRIPTOR[group.label.toLowerCase()] ?? "",
    })
  }

  // Flows-direction note from the view's layout direction (CONTRACT: "↓ top-down").
  const flow = flowDirection(view.layoutDir)

  return (
    <section className="carto-legend" aria-label="Map key">
      <header className="carto-legend__head">
        <h2 className="carto-legend__title">Map key</h2>
        <p className="carto-legend__lede">
          Reading <span className="carto-legend__view">{view.title}</span>.
        </p>
      </header>

      {/* ---- Territories — only lanes present in this view --------------- */}
      {lanes.length > 0 ? (
        <div className="carto-legend__group">
          <h3 className="carto-legend__eyebrow">Territories</h3>
          <ul className="carto-legend__list">
            {lanes.map((lane) => (
              <li key={lane.id} className="carto-legend__row" data-zone={lane.zone}>
                <span className="carto-legend__swatch" aria-hidden="true" />
                <span className="carto-legend__row-text">
                  <span className="carto-legend__row-name">
                    {lane.label}
                    <span className="carto-legend__count">{lane.count}</span>
                  </span>
                  {lane.descriptor ? (
                    <span className="carto-legend__row-desc">{lane.descriptor}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* ---- Roles — only the role glyphs present in this view ----------- */}
      {kinds.length > 0 ? (
        <div className="carto-legend__group">
          <h3 className="carto-legend__eyebrow">Roles</h3>
          <ul className="carto-legend__list">
            {kinds.map((kind) => (
              <li key={kind} className="carto-legend__row" data-kind={kind}>
                <span className="carto-legend__glyph" aria-hidden="true">
                  <NodeIcon node={{ type: KIND_SAMPLE_TYPE[kind] }} size={13} />
                </span>
                <span className="carto-legend__row-text">
                  <span className="carto-legend__row-name">{KIND_LABEL[kind]}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* ---- Routes — all 3 variants; dormant ones dimmed + labelled ----- */}
      <div className="carto-legend__group">
        <h3 className="carto-legend__eyebrow">Routes</h3>
        <ul className="carto-legend__list">
          {ROUTES.map((route) => {
            const present = presentVariants.has(route.variant)
            return (
              <li
                key={route.variant}
                className="carto-legend__row carto-legend__row--route"
                data-dormant={present ? undefined : "true"}
              >
                <span
                  className="carto-legend__route-swatch"
                  aria-hidden="true"
                  data-dashed={route.dashed ? "true" : undefined}
                  style={{ color: route.stroke }}
                />
                <span className="carto-legend__row-text">
                  <span className="carto-legend__row-name">{route.label}</span>
                  <span className="carto-legend__row-desc">
                    {present ? route.meaning : "not in this view"}
                  </span>
                </span>
              </li>
            )
          })}
        </ul>
      </div>

      {/* ---- Flow direction note ----------------------------------------- */}
      {flow ? (
        <p className="carto-legend__flow">
          <ArrowDown
            size={13}
            strokeWidth={2}
            aria-hidden="true"
            className="carto-legend__flow-icon"
            style={{ transform: `rotate(${flow.rotate}deg)` }}
          />
          <span>
            flows <span className="carto-legend__flow-dir">{flow.label}</span>
          </span>
        </p>
      ) : null}
    </section>
  )
}

/** Map a layout direction to a human note + the rotation of the down-arrow glyph. */
function flowDirection(dir?: string): { label: string; rotate: number } | null {
  switch ((dir ?? "").toUpperCase()) {
    case "DOWN":
      return { label: "top-down", rotate: 0 }
    case "UP":
      return { label: "bottom-up", rotate: 180 }
    case "RIGHT":
      return { label: "left-to-right", rotate: -90 }
    case "LEFT":
      return { label: "right-to-left", rotate: 90 }
    default:
      return null
  }
}
