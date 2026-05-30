import type { NodeProps } from '@xyflow/react'

import { useReducedMotion } from '../lib/useReducedMotion'
import type { CartoNode, LaneNodeData } from '../lib/types'

/**
 * Lane group custom node (RF nodeType 'lane') — CONTRACT §4/§5.
 *
 * A *field, not a card*: a soft zone wash (`--zone-wash`) over which the canvas
 * dot grid shows through, a 1px `--divider` hairline, `--r-lg`, and NO shadow so
 * it reads as territory sitting *behind* the cards (zIndex is owned by the flow
 * graph). The only chrome is a floating top-left eyebrow header (no fill): a
 * 3px×16px territory tick in `var(--zone)`, the disambiguated label
 * (`ROOT · entry-point runners`), and a derived count badge (`· 6`). The header
 * is a real <button aria-expanded> that toggles collapse via `data.onToggle`.
 *
 * Presentation only: the collapsed flag + onToggle arrive from Canvas. Collapse
 * is information-bearing, so it applies instantly; only the height *transition*
 * is motion and is gated by `prefers-reduced-motion`.
 */
export function LaneNode({ data }: NodeProps<CartoNode>) {
  // This component is only registered for nodeType 'lane', so data is LaneNodeData.
  const lane = data as LaneNodeData
  const { label, zone, count, collapsed, descriptor, onToggle } = lane

  const reducedMotion = useReducedMotion()

  const safeCount = Number.isFinite(count) ? count : 0
  const hasDescriptor = typeof descriptor === 'string' && descriptor.trim().length > 0

  return (
    <div
      data-zone={zone}
      data-collapsed={collapsed ? 'true' : undefined}
      role="group"
      aria-label={`${label} lane, ${safeCount} components`}
      className="carto-lane"
      style={{
        width: '100%',
        height: '100%',
        background: 'var(--zone-wash)',
        border: '1px solid var(--divider)',
        borderRadius: 'var(--r-lg)',
        // No shadow — the lane is a field behind the cards, not a floating object.
        transition: reducedMotion ? 'none' : 'height 140ms ease',
      }}
    >
      <button
        type="button"
        className="carto-lane__header nodrag nopan"
        aria-expanded={!collapsed}
        aria-label={
          collapsed
            ? `Expand ${label} lane, ${safeCount} components`
            : `Collapse ${label} lane, ${safeCount} components`
        }
        title={hasDescriptor ? `${label} — ${descriptor}` : label}
        onClick={(event) => {
          // Don't let the click bubble into RF selection / pan handling.
          event.stopPropagation()
          onToggle?.()
        }}
      >
        <span aria-hidden="true" className="carto-lane__tick" />
        <span className="carto-lane__eyebrow">
          <span className="carto-lane__label">{label}</span>
          {hasDescriptor && (
            <>
              <span aria-hidden="true" className="carto-lane__sep">
                ·
              </span>
              <span className="carto-lane__descriptor">{descriptor}</span>
            </>
          )}
          <span aria-hidden="true" className="carto-lane__sep">
            ·
          </span>
          <span className="carto-lane__count">{safeCount}</span>
        </span>
      </button>
    </div>
  )
}
