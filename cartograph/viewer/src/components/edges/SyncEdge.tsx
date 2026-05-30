import type { CSSProperties } from 'react'
import { BaseEdge, getSmoothStepPath, type EdgeProps } from '@xyflow/react'
import type { CartoEdge, CartoEdgeData } from '../../lib/types'

/**
 * Pure derivation of the rest/incident/dimmed stroke style (CONTRACT §6 state
 * rules). Kept module-scoped + pure so the load-bearing logic stays
 * unit-testable without a DOM (this repo tests pure `.ts` units; presentation
 * lives in `.tsx`):
 *  - rest      → `var(--carto-edge-sync)` (= `--n-500`, WCAG 1.4.11 ≥3:1 on near-white).
 *  - incident  → `var(--focus-ring-color)`, width 2, always fully opaque.
 *  - dimmed    → opacity 0.25 (non-incident only; incident outranks dim).
 */
export function syncEdgeStyle(data: CartoEdgeData | undefined): CSSProperties {
  const incident = data?.incident === true
  const dimmed = data?.dimmed === true
  return {
    stroke: incident ? 'var(--focus-ring-color)' : 'var(--carto-edge-sync)',
    strokeWidth: incident ? 2 : undefined,
    // incident edges are always opaque; only non-incident edges fade in the fan.
    opacity: !incident && dimmed ? 0.25 : undefined,
  }
}

/** "{source} imports {target}" — guards undefined labels (graceful degrade). */
export function syncEdgeTitle(data: CartoEdgeData | undefined): string {
  const source = data?.sourceLabel?.trim() || 'source'
  const target = data?.targetLabel?.trim() || 'target'
  return `${source} imports ${target}`
}

/**
 * Variant 1 — orthogonal solid "imports" edge (CONTRACT §6.1); the only edge
 * variant the fixture renders (all 14 edges are `type:'imports'`).
 *
 * `getSmoothStepPath` with `borderRadius: 6` (matches the node `--r-md`) draws a
 * crisp right-angled route from the source's bottom handle (DOWN layout) into the
 * dependency's top handle. The arrowhead arrives via `markerEnd` set on the edge
 * object and is passed through to `BaseEdge` unchanged so it tints with the edge.
 *
 * State flags arrive from the Canvas via `data` (`incident` / `dimmed`) — see
 * `syncEdgeStyle`. These are information-bearing, so they apply instantly (no
 * transition here; the only motion-bearing edge CSS is the async variant's dash,
 * which is gated for reduced-motion in tokens.css and does not apply to sync).
 *
 * Accessibility (CONTRACT §6 a11y / §9 / §10): an SVG `<title>` and `aria-label`
 * ("{source} imports {target}") name the edge for assistive tech, with graceful
 * fallbacks when labels are absent. `BaseEdge` renders a single `<path>` (its
 * props extend `SVGAttributes<SVGPathElement>` and take no children), so the
 * `<title>` is a sibling inside React Flow's per-edge `<g>` wrapper.
 */
export function SyncEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  data,
}: EdgeProps<CartoEdge>) {
  const [path] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 6,
  })

  const title = syncEdgeTitle(data)

  return (
    <>
      <title>{title}</title>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        style={syncEdgeStyle(data)}
        aria-label={title}
      />
    </>
  )
}
