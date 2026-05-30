import ELK from 'elkjs'
import type { Manifest, View, ViewLayoutPos } from './schema.ts'

// Layout stage: run elkjs ONCE per view at generation time and bake absolute
// positions into the manifest (the "layout-once-then-freeze" policy from ADR-0001).
// Re-uses the exact compound layered + ORTHOGONAL + INCLUDE_CHILDREN config proven
// in spike/phase0/elk. Lane (group) positions are root-relative; child positions
// are lane-relative — which is exactly what React Flow subflows want.
//
// Fresh layout (layoutAll) runs ELK over a whole view. Incremental freeze
// (placeNewNodes / layoutNew, below) pins existing positions and places only the
// nodes the merge reported as new — that's the re-run path.

const elk = new (ELK as unknown as { new (): { layout: (g: unknown) => Promise<ElkNode> } })()

const BASE: Record<string, string> = {
  'elk.algorithm': 'layered',
  'elk.edgeRouting': 'ORTHOGONAL',
  'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
  'elk.layered.spacing.nodeNodeBetweenLayers': '64',
  'elk.spacing.nodeNode': '48',
  'elk.padding': '[top=44,left=24,bottom=24,right=24]',
}

export interface ElkNode {
  id: string
  x?: number
  y?: number
  width?: number
  height?: number
  layoutOptions?: Record<string, string>
  children?: ElkNode[]
  edges?: { id: string; sources: string[]; targets: string[] }[]
}

const round = (n?: number): number => Math.round((n ?? 0) * 100) / 100

/** Walk a laid-out ELK tree into per-id positions: top level gets x/y(/w/h), nested children get lane-local x/y. */
export function extractPositions(root: ElkNode): Record<string, ViewLayoutPos> {
  const out: Record<string, ViewLayoutPos> = {}
  for (const top of root.children ?? []) {
    out[top.id] = { x: round(top.x), y: round(top.y), w: round(top.width), h: round(top.height) }
    for (const child of top.children ?? []) {
      out[child.id] = { x: round(child.x), y: round(child.y) } // local to its lane — React Flow subflow coords
    }
  }
  return out
}

function direction(layoutDir?: string): string {
  return layoutDir === 'RIGHT' || layoutDir === 'LR' ? 'RIGHT' : 'DOWN'
}

/** Build the ELK graph for one view (lanes from parentId + their children; ungrouped nodes at root). */
export function buildElkGraph(manifest: Manifest, view: View): ElkNode {
  const inView = new Set(view.nodeIds)
  const byLane = new Map<string, ElkNode[]>()
  const rootLeaves: ElkNode[] = []

  for (const id of view.nodeIds) {
    const n = manifest.nodes[id]
    if (!n) continue
    const leaf: ElkNode = { id, width: n.width ?? 220, height: n.height ?? 72 }
    if (n.parentId) {
      const kids = byLane.get(n.parentId) ?? []
      kids.push(leaf)
      byLane.set(n.parentId, kids)
    } else {
      rootLeaves.push(leaf)
    }
  }

  const children: ElkNode[] = [
    ...[...byLane.entries()].map(([laneId, kids]) => ({ id: laneId, layoutOptions: { ...BASE }, children: kids })),
    ...rootLeaves,
  ]

  const edges = Object.values(manifest.edges)
    .filter((e) => inView.has(e.source) && inView.has(e.target))
    .map((e) => ({ id: e.id, sources: [e.source], targets: [e.target] }))

  return { id: 'root', layoutOptions: { ...BASE, 'elk.direction': direction(view.layoutDir) }, children, edges }
}

/** Run ELK on one view and write positions into `view.layout`. */
export async function layoutView(manifest: Manifest, view: View): Promise<void> {
  if (view.nodeIds.length === 0) {
    view.layout = {}
    return
  }
  const laid = await elk.layout(buildElkGraph(manifest, view))
  view.layout = extractPositions(laid)
}

/** Lay out every view in the manifest (mutates view.layout in place). */
export async function layoutAll(manifest: Manifest): Promise<void> {
  for (const view of manifest.views) await layoutView(manifest, view)
}

// ---- incremental freeze (ADR-0001 Phase-2): the manifest is truth, existing
// positions are frozen, and only nodes the merge reported as new get placed.
// ELK can't pin across orthogonal routing, so placement is app-owned: drop each
// new node into the first grid slot below the existing content that an overlap
// guard accepts. Aesthetics decay slowly; truth + no-clobber is the contract.

interface Size {
  w: number
  h: number
}

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

function rectOf(id: string, pos: ViewLayoutPos, sizeOf: (id: string) => Size): Rect {
  return { x: pos.x, y: pos.y, w: pos.w ?? sizeOf(id).w, h: pos.h ?? sizeOf(id).h }
}

function overlaps(a: Rect, b: Rect, gap: number): boolean {
  return a.x < b.x + b.w + gap && a.x + a.w + gap > b.x && a.y < b.y + b.h + gap && a.y + a.h + gap > b.y
}

/**
 * Place `newIds` into `view.layout` without moving anything already positioned.
 * Existing entries are frozen; each new node takes the first non-overlapping grid
 * slot below the current content. Deterministic (newIds processed in order).
 */
export function placeNewNodes(
  view: View,
  newIds: string[],
  sizeOf: (id: string) => Size,
  opts: { gap?: number; columns?: number } = {},
): void {
  const gap = opts.gap ?? 48
  const columns = opts.columns ?? 4
  const fresh = newIds.filter((id) => !view.layout[id])
  if (fresh.length === 0) return

  const occupied: Rect[] = []
  let maxBottom = 0
  for (const [id, pos] of Object.entries(view.layout)) {
    const r = rectOf(id, pos, sizeOf)
    occupied.push(r)
    maxBottom = Math.max(maxBottom, r.y + r.h)
  }

  const cellW = Math.max(...fresh.map((id) => sizeOf(id).w)) + gap
  const cellH = Math.max(...fresh.map((id) => sizeOf(id).h)) + gap
  const startY = occupied.length ? maxBottom + gap : 0

  for (const id of fresh) {
    const { w, h } = sizeOf(id)
    let placed: Rect | undefined
    for (let row = 0; !placed; row++) {
      for (let col = 0; col < columns; col++) {
        const cand: Rect = { x: col * cellW, y: startY + row * cellH, w, h }
        if (!occupied.some((o) => overlaps(cand, o, gap))) {
          placed = cand
          break
        }
      }
    }
    occupied.push(placed)
    view.layout[id] = { x: placed.x, y: placed.y }
  }
}

/** Incrementally lay out only the nodes the merge reported as new, freezing the rest. */
export function layoutNew(manifest: Manifest, newIds: string[]): void {
  const newSet = new Set(newIds)
  const sizeOf = (id: string): Size => ({ w: manifest.nodes[id]?.width ?? 220, h: manifest.nodes[id]?.height ?? 72 })
  for (const view of manifest.views) {
    const viewNew = view.nodeIds.filter((id) => newSet.has(id))
    if (viewNew.length) placeNewNodes(view, viewNew, sizeOf)
  }
}
