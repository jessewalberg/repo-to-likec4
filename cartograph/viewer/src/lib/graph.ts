import { kindForType, variantForEdge } from './manifestToFlow.ts'
import type { EdgeVariant, Group, KindKey, Manifest, ManifestEdge, ManifestNode, View } from './types'

// Pure derived-graph queries used by the detail panel, canvas highlight, and ARIA
// labels. "imports" = outgoing edges (source === node); "imported by" = incoming.

export function importsOf(manifest: Manifest, nodeId: string): ManifestNode[] {
  return resolve(manifest, outgoing(manifest, nodeId).map((e) => e.target))
}

export function importedBy(manifest: Manifest, nodeId: string): ManifestNode[] {
  return resolve(manifest, incoming(manifest, nodeId).map((e) => e.source))
}

export function neighborsOf(manifest: Manifest, nodeId: string): Set<string> {
  const ids = new Set<string>()
  for (const e of outgoing(manifest, nodeId)) ids.add(e.target)
  for (const e of incoming(manifest, nodeId)) ids.add(e.source)
  return ids
}

export function laneOf(manifest: Manifest, nodeId: string): Group | undefined {
  const parentId = manifest.nodes[nodeId]?.parentId
  return parentId ? manifest.groups[parentId] : undefined
}

export function laneCounts(manifest: Manifest, view: View): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const id of view.nodeIds) {
    const p = manifest.nodes[id]?.parentId
    if (p && manifest.groups[p]) counts[p] = (counts[p] ?? 0) + 1
  }
  return counts
}

export function presentKinds(manifest: Manifest, view: View): KindKey[] {
  const seen = new Set<KindKey>()
  const out: KindKey[] = []
  for (const id of view.nodeIds) {
    const n = manifest.nodes[id]
    if (!n) continue
    const k = kindForType(n.type)
    if (!seen.has(k)) {
      seen.add(k)
      out.push(k)
    }
  }
  return out
}

export function presentEdgeVariants(manifest: Manifest, view: View): EdgeVariant[] {
  const inView = new Set(view.nodeIds)
  const seen = new Set<EdgeVariant>()
  const out: EdgeVariant[] = []
  for (const e of Object.values(manifest.edges)) {
    if (!inView.has(e.source) || !inView.has(e.target)) continue
    const v = variantForEdge(e.type)
    if (!seen.has(v)) {
      seen.add(v)
      out.push(v)
    }
  }
  return out
}

// --- internals ---

function outgoing(manifest: Manifest, nodeId: string): ManifestEdge[] {
  return Object.values(manifest.edges).filter((e) => e.source === nodeId)
}

function incoming(manifest: Manifest, nodeId: string): ManifestEdge[] {
  return Object.values(manifest.edges).filter((e) => e.target === nodeId)
}

function resolve(manifest: Manifest, ids: string[]): ManifestNode[] {
  const seen = new Set<string>()
  const out: ManifestNode[] = []
  for (const id of ids) {
    if (seen.has(id)) continue
    seen.add(id)
    const n = manifest.nodes[id]
    if (n) out.push(n)
  }
  return out
}
