import type { NodeProps } from '@xyflow/react'

import type { CartoNode, LaneNodeData } from '../lib/types'

/**
 * Lane group custom node (RF nodeType 'lane') — CONTRACT §4/§5.
 *
 * A *field, not a card*: a soft zone wash (`--zone-wash`) over which the canvas
 * dot grid shows through, a 1px `--divider` hairline, `--r-lg`, and NO shadow so
 * it reads as territory sitting *behind* the cards (zIndex is owned by the flow
 * graph). The chrome is a floating top-left eyebrow header (no fill): a
 * 3px×16px territory tick in `var(--zone)`, the disambiguated label
 * (`ROOT · entry-point runners`), and a derived count badge (`· 6`).
 *
 * The header is a non-interactive label this phase: interactive lane collapse
 * (hiding children + resizing the lane) is a Phase-2/3 item, so we don't ship a
 * dead <button>/aria-expanded that does nothing. The `collapsed`/`onToggle`
 * fields stay on LaneNodeData for when that lands.
 */
export function LaneNode({ data }: NodeProps<CartoNode>) {
  // This component is only registered for nodeType 'lane', so data is LaneNodeData.
  const { label, zone, count, descriptor } = data as LaneNodeData

  const safeCount = Number.isFinite(count) ? count : 0
  const hasDescriptor = typeof descriptor === 'string' && descriptor.trim().length > 0

  return (
    <div
      data-zone={zone}
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
      }}
    >
      <div
        className="carto-lane__header"
        title={hasDescriptor ? `${label} — ${descriptor}` : label}
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
      </div>
    </div>
  )
}
