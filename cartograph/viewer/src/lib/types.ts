import type { Edge, Node } from '@xyflow/react'

// ============================================================================
// Manifest types — mirror cartograph/generate/schema.ts (the generator's truth).
// ============================================================================

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
  annotation?: string
  doc?: string
  lesson?: string
  provenance?: Record<string, Provenance>
  pinned?: boolean
  confidence?: Confidence
}

export interface ManifestNode {
  id: string
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
  w?: number
  h?: number
}

export interface View {
  id: string
  title: string
  level?: number
  nodeIds: string[]
  layoutDir?: string
  layout: Record<string, ViewLayoutPos>
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

// ============================================================================
// site.json (sidebar nav)
// ============================================================================

export type NavKind = 'section' | 'tree' | 'group' | 'page' | 'view' | 'tour' | 'changelog'

export interface NavEntry {
  id: string
  kind: NavKind
  label: string
  icon?: string
  page?: string
  viewId?: string
  tourId?: string
  feed?: string
  node?: string
  source?: 'auto:node-docs' | 'auto:node-lessons'
  provenance?: Provenance
  children?: NavEntry[]
}

export interface Site {
  schemaVersion: number
  home: string
  search: { enabled: boolean; index: string[] }
  sidebar: NavEntry[]
}

// ============================================================================
// changelog.json
// ============================================================================

export interface ChangelogEntry {
  ref?: string
  timestamp: string
  added: string[]
  removed: string[]
  migrated: { from: string; to: string }[]
  suppressedSkipped: string[]
}

export interface Changelog {
  schemaVersion: number
  entries: ChangelogEntry[]
}

// ============================================================================
// Viewer-only types
// ============================================================================

/** A doc page after frontmatter parsing. The island may also ship raw markdown strings. */
export interface DocPage {
  frontmatter?: Record<string, unknown>
  body: string
}

export interface TourStep {
  nodeId?: string
  title: string
  body: string
}

export interface Tour {
  id: string
  title: string
  steps: TourStep[]
}

export interface Tours {
  schemaVersion: number
  tours: Tour[]
}

export interface CartographData {
  architecture: Manifest
  site: Site
  changelog: Changelog
  tours: Tours
  /** docRef -> raw markdown OR a parsed DocPage. `{}` when no pages exist yet. */
  pages: Record<string, string | DocPage>
}

export type KindKey = 'service' | 'frontend' | 'datastore' | 'infra' | 'external' | 'queue'
export type ZoneKey = 'a' | 'b'

/** Where the Main pane is pointed. */
export type AppRoute =
  | { kind: 'view'; viewId: string }
  | { kind: 'page'; page: string; node?: string }
  | { kind: 'changelog' }
  | { kind: 'tour'; tourId: string }

/** A flat search row for the ⌘K palette. `go()` performs the navigation/selection. */
export interface SearchDoc {
  id: string
  group: 'Nodes' | 'Edges' | 'Pages' | 'Tours'
  label: string
  sublabel?: string
  keywords: string[]
  go: () => void
}

// ---- React Flow node/edge data unions ----

export interface CardNodeData {
  label: string
  kind: KindKey
  zone?: ZoneKey
  /** original manifest node.type (e.g. 'component'). */
  nodeType: string
  technology?: string
  metadataPath?: string
  summary?: string
  links?: SourceLink[]
  doc?: string
  confidence?: Confidence
  pinned?: boolean
  /** neighbor-fan de-emphasis flag (set by Canvas). */
  dimmed?: boolean
  importsCount: number
  importedByCount: number
  [key: string]: unknown
}

export interface LaneNodeData {
  label: string
  zone: ZoneKey
  count: number
  collapsed?: boolean
  descriptor?: string
  onToggle?: () => void
  [key: string]: unknown
}

export type CartoNode = Node<CardNodeData, 'card'> | Node<LaneNodeData, 'lane'>

export type EdgeVariant = 'sync' | 'data' | 'async'

export interface CartoEdgeData {
  variant: EdgeVariant
  targetHue?: string
  sourceLabel?: string
  targetLabel?: string
  confidence?: Confidence
  /** highlight-state flags set by Canvas. */
  dimmed?: boolean
  incident?: boolean
  [key: string]: unknown
}

export type CartoEdge = Edge<CartoEdgeData>
