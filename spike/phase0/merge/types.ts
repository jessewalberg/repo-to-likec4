// architecture.json schema v1 — Phase-0 subset, focused on the merge contract.
// (Production will validate this with Zod; the spike only needs the shapes the
// three-way merge operates on.)

export type Provenance = 'machine' | 'human'
export type Confidence = 'static' | 'inferred' | 'unknown'

export interface SourceLink {
  label: string
  url: string
}

export interface NodeData {
  label: string
  summary?: string
  description?: string
  technology?: string
  icon?: string
  links?: SourceLink[]
  metadata?: Record<string, string | number>
  annotation?: string // human-added free note
  /** Per-field ownership. A field marked 'human' is NEVER overwritten by recon. */
  provenance?: Record<string, Provenance>
  /** Human dragged it → the layout pass must never move it. */
  pinned?: boolean
  /** static = recon sees it now; unknown = recon no longer sees it (muted, not deleted). */
  confidence?: Confidence
}

export interface ManifestNode {
  id: string
  type: string
  parentId?: string | null
  data: NodeData
  width?: number
  height?: number
  /** Who created this node: 'machine' (recon) or 'human' (manual annotation node). */
  origin?: Provenance
}

export interface ManifestEdge {
  id: string
  source: string
  target: string
  type: string
  label?: string
  animated?: boolean
  confidence?: Confidence
  origin?: Provenance
}

export interface ViewLayoutPos {
  x: number
  y: number
}

export interface View {
  id: string
  title: string
  level?: number
  /** Recon-owned: which nodes appear in this view. */
  nodeIds: string[]
  layoutDir?: string
  /** Human/layout-owned: per-view positions, keyed by node id. */
  layout: Record<string, ViewLayoutPos>
}

export interface Suppressions {
  nodes: string[]
  edges: string[]
}

export interface Manifest {
  schemaVersion: number
  meta?: Record<string, unknown>
  /** Map keyed by stable id so independent edits never positionally collide on merge. */
  nodes: Record<string, ManifestNode>
  edges: Record<string, ManifestEdge>
  suppressions: Suppressions
  /** oldId -> newId. Recorded by rename detection so layout/edits migrate across a move. */
  idAliases: Record<string, string>
  groups?: Record<string, unknown>
  views: View[]
}

export interface MergeReport {
  /** New recon nodes added this run. */
  added: string[]
  /** Nodes recon no longer sees — kept but muted (confidence 'unknown'), not deleted. */
  mutedRemoved: string[]
  /** Human edits/layout migrated from an old id to a new id via idAliases. */
  migrated: { from: string; to: string }[]
  /** Recon re-discovered these but the human suppressed them — skipped. */
  suppressedSkipped: string[]
  /** Per-node list of fields whose human value was preserved over recon. */
  humanFieldsPreserved: { id: string; fields: string[] }[]
}

export interface MergeResult {
  manifest: Manifest
  report: MergeReport
  /** New nodes that still need a position from the (frozen) layout pass; excludes pinned. */
  nodesNeedingLayout: string[]
}
