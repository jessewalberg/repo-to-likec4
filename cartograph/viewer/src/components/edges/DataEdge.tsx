import { BaseEdge, getBezierPath } from '@xyflow/react'
import type { EdgeProps } from '@xyflow/react'
import type { CartoEdge } from '../../lib/types'

/**
 * Variant 2 — data-flow edge (CONTRACT §6.2). Dormant in the fixture (all edges
 * are `imports`/sync) but correct: a SOLID bezier whose stroke is the TARGET's
 * kind hue (`data.targetHue`, precomputed by manifestToFlow), so the colour
 * answers "where does this data land". 1.75px at rest.
 *
 * Honors the Canvas-driven highlight flags exactly like the other variants:
 *   - selected            → focus-ring colour, 2px
 *   - data.incident       → stays full opacity, widens to 2px (escapes the fan)
 *   - data.dimmed (& not incident) → fades to 0.25 (non-incident de-emphasis)
 * Hover affordance (brighten + 4px halo) is CSS-only (`.carto-edge-data`) so it
 * needs no JS and is reduced-motion-safe by construction.
 *
 * a11y: an SVG <title> names the flow (source → target) on the edge group, and
 * mirrors it to aria-label, so the edge is not a colour-only graphical object.
 */
export function DataEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  data,
  selected,
  style,
}: EdgeProps<CartoEdge>) {
  const [path] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  })

  // Pure style decision (proven by /tmp test; see notes). Never NaN, never blank.
  const isSelected = selected === true
  const isIncident = data?.incident === true
  const isDimmed = data?.dimmed === true && !isIncident
  const emphasized = isSelected || isIncident

  const stroke = isSelected
    ? 'var(--focus-ring-color)'
    : data?.targetHue ?? 'var(--carto-edge-data)'

  const sourceLabel = data?.sourceLabel ?? 'source'
  const targetLabel = data?.targetLabel ?? 'target'
  const description = `${sourceLabel} flows data to ${targetLabel}`

  return (
    <g className="carto-edge-data" aria-label={description} data-incident={isIncident || undefined}>
      <title>{description}</title>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        interactionWidth={20}
        style={{
          stroke,
          strokeWidth: emphasized ? 2 : 1.75,
          opacity: isDimmed ? 0.25 : 1,
          fill: 'none',
          ...style,
        }}
      />
    </g>
  )
}
