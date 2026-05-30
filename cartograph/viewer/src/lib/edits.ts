import type { Manifest, ViewLayoutPos } from './types'

// Pure manifest edit operations for in-viewer editing parity (ADR-0001 Phase-2):
// every action a user can take on the canvas/panel produces a NEW manifest with
// the right field set AND its provenance flipped to 'human', so the three-way
// merge protects the edit on the next agent re-run. Pure + immutable so the zundo
// store (editStore.ts) gets clean undo/redo and these are unit-testable.

const clone = (m: Manifest): Manifest => structuredClone(m)

function markHuman(m: Manifest, id: string, field: string): void {
  const n = m.nodes[id]
  if (!n) return
  n.data.provenance = { ...(n.data.provenance ?? {}), [field]: 'human' }
}

/** Drag-to-reposition: freeze the node where the human dropped it (and pin it). */
export function moveNode(m: Manifest, viewId: string, nodeId: string, pos: { x: number; y: number }): Manifest {
  const next = clone(m)
  const view = next.views.find((v) => v.id === viewId)
  if (view) {
    const prev: ViewLayoutPos | undefined = view.layout[nodeId]
    view.layout[nodeId] = { ...prev, x: pos.x, y: pos.y }
  }
  const n = next.nodes[nodeId]
  if (n) n.data.pinned = true // a human-placed node is pinned so re-layout won't move it
  return next
}

export function setPinned(m: Manifest, nodeId: string, pinned: boolean): Manifest {
  const next = clone(m)
  const n = next.nodes[nodeId]
  if (n) n.data.pinned = pinned
  return next
}

export function renameNode(m: Manifest, nodeId: string, label: string): Manifest {
  const next = clone(m)
  const n = next.nodes[nodeId]
  if (n) {
    n.data.label = label
    markHuman(next, nodeId, 'label')
  }
  return next
}

export function annotateNode(m: Manifest, nodeId: string, text: string): Manifest {
  const next = clone(m)
  const n = next.nodes[nodeId]
  if (n) {
    const t = text.trim()
    if (t) n.data.annotation = t
    else delete n.data.annotation
    markHuman(next, nodeId, 'annotation')
  }
  return next
}

function toggle(list: string[], id: string, on: boolean): string[] {
  const set = new Set(list)
  if (on) set.add(id)
  else set.delete(id)
  return [...set]
}

/** Hide/unhide a node — recorded in suppressions so recon never re-adds it. */
export function setSuppressedNode(m: Manifest, nodeId: string, hidden: boolean): Manifest {
  const next = clone(m)
  next.suppressions = { ...next.suppressions, nodes: toggle(next.suppressions.nodes, nodeId, hidden) }
  return next
}

export function setSuppressedEdge(m: Manifest, edgeId: string, hidden: boolean): Manifest {
  const next = clone(m)
  next.suppressions = { ...next.suppressions, edges: toggle(next.suppressions.edges, edgeId, hidden) }
  return next
}
