// Cartograph canonical schema — the contract between the generator, the merge
// engine (proven in spike/phase0), and the viewer. Two committed documents:
//   architecture.json  — the graph (nodes/edges/groups/views + merge bookkeeping)
//   site.json          — the sidebar nav tree (Documentation/Architecture/Modules/Learning)
// Production validates these with Zod; the TS types are the source of truth here.

export type Provenance = 'machine' | 'human'
export type Confidence = 'static' | 'inferred' | 'unknown'

export interface SourceLink {
  label: string
  url: string
}

export interface NodeData {
  label: string
  summary?: string // node face; LLM-owned, human-editable
  description?: string // click panel (markdown); LLM-owned, human-editable
  technology?: string
  icon?: string
  links?: SourceLink[]
  metadata?: Record<string, string | number>
  annotation?: string // human-added note
  doc?: string // this node's own doc page (pages/**.md) — feeds the Modules tree + canvas affordance
  lesson?: string // this node's own lesson/tour id — feeds the Learning tree
  provenance?: Record<string, Provenance> // per-field ownership; 'human' is never overwritten by recon
  pinned?: boolean
  confidence?: Confidence
}

export interface ManifestNode {
  id: string // stable: `<kind>:<canonical-path>`
  type: string
  parentId?: string | null
  data: NodeData
  width?: number
  height?: number
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
  nodeIds: string[]
  layoutDir?: string
  layout: Record<string, ViewLayoutPos> // per-view positions (filled by the layout stage)
}

export interface Group {
  id: string
  label: string
  laneType?: 'layer' | 'column' | 'radial-hub'
  color?: string
}

export interface Manifest {
  schemaVersion: number
  meta?: Record<string, unknown>
  nodes: Record<string, ManifestNode>
  edges: Record<string, ManifestEdge>
  suppressions: { nodes: string[]; edges: string[] }
  idAliases: Record<string, string>
  groups: Record<string, Group>
  views: View[]
}

// ---- site.json (sidebar nav) ----

export type NavKind = 'section' | 'tree' | 'group' | 'page' | 'view' | 'tour' | 'changelog'

export interface NavEntry {
  id: string
  kind: NavKind
  label: string
  icon?: string
  page?: string // kind 'page'
  viewId?: string // kind 'view'
  tourId?: string // kind 'tour'
  feed?: string // kind 'changelog'
  node?: string // cross-link to an architecture node id
  source?: 'auto:node-docs' | 'auto:node-lessons' // auto-generated subtree
  provenance?: Provenance
  children?: NavEntry[]
}

export interface Site {
  schemaVersion: number
  home: string // e.g. 'view:components' or 'page:overview'
  search: { enabled: boolean; index: string[] }
  sidebar: NavEntry[]
}

export function emptyManifest(): Manifest {
  return { schemaVersion: 2, nodes: {}, edges: {}, suppressions: { nodes: [], edges: [] }, idAliases: {}, groups: {}, views: [] }
}
