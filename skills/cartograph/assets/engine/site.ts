import type { Manifest, NavEntry, Site } from './schema.ts'

interface DirNode {
  label: string
  children: Record<string, DirNode | NavEntry>
}

function isLeaf(v: DirNode | NavEntry): v is NavEntry {
  return (v as NavEntry).kind === 'page'
}

/** Build the nested Modules tree from each node's repo path + `data.doc`, leaves cross-linked to node ids. */
function buildModulesTree(manifest: Manifest): NavEntry[] {
  const root: Record<string, DirNode | NavEntry> = {}

  for (const n of Object.values(manifest.nodes)) {
    if (!n.data.doc) continue
    if (n.type === 'container') continue // containers aren't files; they don't belong in the Modules tree
    const path = String(n.data.metadata?.path ?? n.id)
    const segs = path.split('/')
    let cur = root
    for (let i = 0; i < segs.length - 1; i++) {
      const seg = segs[i]
      const existing = cur[seg]
      const dir: DirNode = existing && !isLeaf(existing) ? (existing as DirNode) : { label: seg, children: {} }
      cur[seg] = dir
      cur = dir.children
    }
    const leafName = segs[segs.length - 1]
    cur[leafName] = { id: `page:${n.id}`, kind: 'page', label: leafName, page: n.data.doc, node: n.id, provenance: 'machine' }
  }

  const toEntries = (obj: Record<string, DirNode | NavEntry>, prefix: string): NavEntry[] =>
    Object.entries(obj)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, v]) =>
        isLeaf(v)
          ? v
          : { id: `dir:${prefix}${key}`, kind: 'tree' as const, label: (v as DirNode).label, children: toEntries((v as DirNode).children, `${prefix}${key}/`) },
      )

  return toEntries(root, '')
}

/**
 * Build the sidebar nav (site.json) from a model manifest: the four sections
 * (Documentation, Architecture, Modules, Learning), with the Modules tree
 * auto-generated from per-node `data.doc` and Learning seeded with the three role
 * tours. Pure/deterministic.
 */
export function buildSite(manifest: Manifest): Site {
  const documentation: NavEntry = {
    id: 'documentation',
    kind: 'section',
    label: 'Documentation',
    icon: 'book',
    provenance: 'machine',
    children: [
      { id: 'overview', kind: 'page', label: 'Overview', page: 'pages/overview.md', provenance: 'machine' },
      { id: 'getting-started', kind: 'page', label: 'Getting started', page: 'pages/getting-started.md', provenance: 'machine' },
      { id: 'changelog', kind: 'changelog', label: 'What changed', feed: 'changelog.json' },
    ],
  }

  const viewEntry = (v: { id: string; title: string }): NavEntry => ({ id: `view:${v.id}`, kind: 'view', label: v.title, viewId: v.id })
  // Primary altitudes (Containers, Components) sit flat; per-directory drill-down
  // views (ids like `components:lib`) nest under a "Components by area" group.
  const primaryViews = manifest.views.filter((v) => !v.id.includes(':'))
  const areaViews = manifest.views.filter((v) => v.id.includes(':'))
  const architecture: NavEntry = {
    id: 'architecture',
    kind: 'section',
    label: 'Architecture',
    icon: 'map',
    children: [
      ...primaryViews.map(viewEntry),
      ...(areaViews.length > 0
        ? [{ id: 'arch:by-area', kind: 'group' as const, label: 'Components by area', children: areaViews.map(viewEntry) }]
        : []),
    ],
  }

  const modules: NavEntry = {
    id: 'modules',
    kind: 'tree',
    label: 'Modules',
    icon: 'folder-tree',
    source: 'auto:node-docs',
    children: buildModulesTree(manifest),
  }

  const learning: NavEntry = {
    id: 'learning',
    kind: 'section',
    label: 'Learning',
    icon: 'graduation-cap',
    children: [
      { id: 'tour:understand', kind: 'tour', label: 'Understand the system', tourId: 'understand' },
      { id: 'tour:fix-bug', kind: 'tour', label: 'Fix a bug', tourId: 'fix-bug' },
      { id: 'tour:add-feature', kind: 'tour', label: 'Add a feature', tourId: 'add-feature' },
      { id: 'per-node-lessons', kind: 'group', label: 'Per-component lessons', source: 'auto:node-lessons', children: [] },
    ],
  }

  const home = manifest.views[0] ? `view:${manifest.views[0].id}` : 'page:overview'

  return {
    schemaVersion: 1,
    home,
    search: { enabled: true, index: ['nodes', 'edges', 'pages', 'tours'] },
    sidebar: [documentation, architecture, modules, learning],
  }
}
