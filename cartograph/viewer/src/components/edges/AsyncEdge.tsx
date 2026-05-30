import { BaseEdge, getSmoothStepPath, type EdgeProps } from "@xyflow/react";

import type { CartoEdge } from "../../lib/types";

/**
 * Edge variant 3 — Async / event (CONTRACT §6).
 *
 * Dormant-but-correct in the fixture (every edge is `type:'imports'`, so only
 * variant 1 renders), but fully wired so the moment an async edge appears it is
 * unmistakable by PATTERN + COLOR alone — never color-only:
 *
 *  - orthogonal route via `getSmoothStepPath` (borderRadius 6, matches node radius)
 *  - DASHED stroke (`strokeDasharray: 6`) in `--carto-edge-async` (rose --queue-stripe)
 *  - marching-dash motion via `.carto-edge--async` — the keyframe lives in
 *    tokens.css and is reduced-motion-gated there (animation drops, static dash
 *    stays), so motion is purely a CSS concern here.
 *  - a rose mid-path dot reinforces "async/event" without relying on hue.
 *  - `markerEnd` passed through (tinted arrowhead from the edge object).
 *  - SVG `<title>` + `aria-label` so the relationship is announced.
 *
 * Highlight state (CONTRACT §6 "States", set by Canvas via edge `data`):
 *  - `dimmed` + not `incident` → de-emphasised non-incident route (opacity 0.25).
 *  - `incident` → full strength + 2px so the connected route reads as load-bearing.
 *  - `selected` → focus-ring stroke + 2px, labels reveal upstream.
 *  - `confidence: 'unknown'` → dotted `2 3` low-confidence pattern.
 */
export function AsyncEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  selected,
  data,
}: EdgeProps<CartoEdge>) {
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 6,
  });

  const dimmed = data?.dimmed === true && data?.incident !== true;
  const incident = data?.incident === true;
  const lowConfidence = data?.confidence === "unknown";

  // Stroke colour: selection wins, then incident/variant rose, then rest rose.
  // (Rest stroke is still the variant colour — async edges are never neutral,
  // so the dash pattern + rose are mutually reinforcing.)
  const stroke = selected
    ? "var(--focus-ring-color)"
    : "var(--carto-edge-async)";

  // Width: load-bearing routes thicken; everything else stays at the shared 1.5.
  const strokeWidth = selected || incident ? 2 : 1.5;

  // Dash pattern: low-confidence overrides to the documented dotted `2 3`;
  // otherwise the variant's marching dash (`6`).
  const strokeDasharray = lowConfidence ? "2 3" : 6;

  // Accessible relationship text — guarded so absent labels never print
  // "undefined". Async edges describe an event flow, not an import.
  const sourceLabel = data?.sourceLabel ?? "source";
  const targetLabel = data?.targetLabel ?? "target";
  const title = `${sourceLabel} sends events to ${targetLabel}`;

  return (
    <g
      role="img"
      aria-label={title}
      data-incident={incident || undefined}
      data-dimmed={dimmed || undefined}
      style={{ opacity: dimmed ? 0.25 : 1 }}
    >
      <title>{title}</title>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        className="carto-edge--async carto-edge-async__path"
        style={{
          stroke,
          strokeWidth,
          strokeDasharray,
        }}
      />
      {/* Rose mid-path dot — a second, hue-independent "this is async" cue.
          Hidden from the a11y tree (the <title> already conveys the relation);
          dropped while dimmed so it never out-shouts the lit routes. */}
      {!dimmed ? (
        <circle
          className="carto-edge-async__dot"
          cx={labelX}
          cy={labelY}
          r={incident || selected ? 3 : 2.5}
          aria-hidden="true"
        />
      ) : null}
    </g>
  );
}
