import type { MarkerType } from '@xyflow/react'
import type { CartoEdge, CartoNode, EdgeVariant, KindKey, Manifest, View, ZoneKey } from './types'

// 'arrowclosed' is MarkerType.ArrowClosed's value; using the literal (type-only
// import + cast) keeps this module free of any @xyflow/react RUNTIME import, so
// the pure transform stays node --test friendly (no DOM needed).
const ARROW_CLOSED = 'arrowclosed' as MarkerType

// Pure transform: (view, manifest) -> { nodes, edges } for React Flow.
// THE coords trap (ADR-0001 / layout.ts): a card whose parentId is a lane uses
// view.layout[nodeId] as LANE-LOCAL position; the lane node carries the absolute
// {x,y}. Lanes are emitted FIRST so every parent precedes its children (RF rule).
// Sizes fall back to 220x72; nothing is ever NaN.

const DEFAULT_W = 220
const DEFAULT_H = 72
const LANE_PAD = 24

const KIND_BY_TYPE: Record<string, KindKey> = {
  service: 'service', gateway: 'service', worker: 'service', function: 'service', api: 'service',
  webapp: 'frontend', frontend: 'frontend', ui: 'frontend', web: 'frontend',
  datastore: 'datastore', database: 'datastore', db: 'datastore', cache: 'datastore', storage: 'datastore',
  queue: 'queue', event: 'queue', topic: 'queue', stream: 'queue', state: 'queue',
  external: 'external', person: 'external', component: 'external', module: 'external', decision: 'external', entity: 'external',
}

export function kindForType(type: string): KindKey {
  return KIND_BY_TYPE[type] ?? 'external'
}

/** Zone accent assigned by lane order: even→a, odd→b (only two zone accents exist). */
export function zoneForLane(laneId: string, laneOrder: string[]): ZoneKey {
  const i = laneOrder.indexOf(laneId)
  return (i < 0 ? 0 : i) % 2 === 0 ? 'a' : 'b'
}

const LANE_DESCRIPTOR: Record<string, string> = {
  root: 'entry-point runners',
  lib: 'shared modules',
}

const VARIANT_BY_TYPE: Record<string, EdgeVariant> = {
  imports: 'sync', calls: 'sync', depends: 'sync', uses: 'sync', sync: 'sync',
  reads: 'data', writes: 'data', data: 'data', 'data-flow': 'data', queries: 'data',
  publishes: 'async', subscribes: 'async', emits: 'async', async: 'async', event: 'async',
}

export function variantForEdge(type: string): EdgeVariant {
  return VARIANT_BY_TYPE[type] ?? 'sync'
}

const EDGE_STROKE: Record<EdgeVariant, string> = {
  sync: 'var(--carto-edge-sync)',
  data: 'var(--carto-edge-data)',
  async: 'var(--carto-edge-async)',
}

export interface FlowGraph {
  nodes: CartoNode[]
  edges: CartoEdge[]
}

export function manifestToFlow(view: View, manifest: Manifest): FlowGraph {
  const inView = new Set(view.nodeIds)

  // Degree counts (only edges fully inside the view).
  const outCount = new Map<string, number>()
  const inCount = new Map<string, number>()
  for (const e of Object.values(manifest.edges)) {
    if (!inView.has(e.source) || !inView.has(e.target)) continue
    outCount.set(e.source, (outCount.get(e.source) ?? 0) + 1)
    inCount.set(e.target, (inCount.get(e.target) ?? 0) + 1)
  }

  // Lane order: distinct lane parentIds in first-appearance order across the view.
  const laneOrder: string[] = []
  for (const id of view.nodeIds) {
    const p = manifest.nodes[id]?.parentId
    if (p && manifest.groups[p] && !laneOrder.includes(p)) laneOrder.push(p)
  }

  const laneNodes: CartoNode[] = []
  const cardNodes: CartoNode[] = []

  // --- lanes first (parents) ---
  for (const laneId of laneOrder) {
    const group = manifest.groups[laneId]
    const pos = view.layout[laneId]
    const children = view.nodeIds.filter((id) => manifest.nodes[id]?.parentId === laneId)
    const { w, h } = laneSize(pos, children, view)
    const zone = zoneForLane(laneId, laneOrder)
    laneNodes.push({
      id: laneId,
      type: 'lane',
      position: { x: num(pos?.x), y: num(pos?.y) },
      width: w,
      height: h,
      style: { width: w, height: h },
      selectable: false,
      draggable: false,
      zIndex: 0,
      data: {
        label: group.label,
        zone,
        count: children.length,
        descriptor: LANE_DESCRIPTOR[group.label.toLowerCase()] ?? '',
      },
    })
  }

  // --- cards after (children; lane-LOCAL positions) ---
  for (const id of view.nodeIds) {
    const n = manifest.nodes[id]
    if (!n) continue
    const pos = view.layout[id]
    const parentId = n.parentId && manifest.groups[n.parentId] ? n.parentId : undefined
    const kind = kindForType(n.type)
    const zone = parentId ? zoneForLane(parentId, laneOrder) : undefined
    cardNodes.push({
      id,
      type: 'card',
      parentId,
      extent: parentId ? 'parent' : undefined,
      position: { x: num(pos?.x), y: num(pos?.y) },
      width: n.width ?? DEFAULT_W,
      height: n.height ?? DEFAULT_H,
      selectable: true,
      draggable: false,
      connectable: false,
      zIndex: 1,
      data: {
        label: n.data.label,
        kind,
        zone,
        nodeType: n.type,
        technology: n.data.technology,
        metadataPath: typeof n.data.metadata?.path === 'string' ? n.data.metadata.path : undefined,
        summary: n.data.summary,
        links: n.data.links,
        doc: n.data.doc,
        confidence: n.data.confidence,
        pinned: n.data.pinned,
        dimmed: false,
        importsCount: outCount.get(id) ?? 0,
        importedByCount: inCount.get(id) ?? 0,
      },
    })
  }

  // --- edges (only those fully inside the view) ---
  const edges: CartoEdge[] = []
  for (const e of Object.values(manifest.edges)) {
    if (!inView.has(e.source) || !inView.has(e.target)) continue
    const variant = variantForEdge(e.type)
    const targetKind = kindForType(manifest.nodes[e.target]?.type ?? 'external')
    const targetHue = variant === 'data' ? `var(--${targetKind}-stripe)` : undefined
    const stroke = variant === 'data' ? (targetHue as string) : EDGE_STROKE[variant]
    edges.push({
      id: e.id,
      source: e.source,
      target: e.target,
      type: variant,
      markerEnd: { type: ARROW_CLOSED, width: 14, height: 14, color: stroke },
      data: {
        variant,
        targetHue,
        sourceLabel: manifest.nodes[e.source]?.data.label ?? e.source,
        targetLabel: manifest.nodes[e.target]?.data.label ?? e.target,
        confidence: e.confidence,
        dimmed: false,
        incident: false,
      },
    })
  }

  return { nodes: [...laneNodes, ...cardNodes], edges }
}

function num(v: number | undefined): number {
  return Number.isFinite(v) ? (v as number) : 0
}

/** Lane box: use stored w/h, else the bbox of (lane-local) children + padding. */
function laneSize(
  pos: { w?: number; h?: number } | undefined,
  children: string[],
  view: View,
): { w: number; h: number } {
  if (pos?.w && pos?.h) return { w: pos.w, h: pos.h }
  let maxX = DEFAULT_W
  let maxY = DEFAULT_H
  for (const id of children) {
    const c = view.layout[id]
    if (!c) continue
    maxX = Math.max(maxX, num(c.x) + (c.w ?? DEFAULT_W))
    maxY = Math.max(maxY, num(c.y) + (c.h ?? DEFAULT_H))
  }
  return { w: (pos?.w ?? maxX) + LANE_PAD, h: (pos?.h ?? maxY) + LANE_PAD }
}
