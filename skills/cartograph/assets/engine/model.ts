import type { Group, Manifest, ManifestNode, View } from './schema.ts'

export interface ModelOptions {
  repo: string // 'org/name'
  blobBase: string // 'https://github.com/org/name/blob/<ref>'
  idPrefix: string // 'tools/factory'
}

const TECH_BY_EXT: Record<string, string> = {
  '.ts': 'TypeScript',
  '.tsx': 'TypeScript / React',
  '.mjs': 'JavaScript',
  '.cjs': 'JavaScript',
  '.js': 'JavaScript',
  '.jsx': 'JavaScript / React',
}

function extOf(path: string): string {
  const m = path.match(/\.[^./]+$/)
  return m ? m[0] : ''
}

function relTo(path: string, idPrefix: string): string {
  return path.startsWith(`${idPrefix}/`) ? path.slice(idPrefix.length + 1) : path
}

/**
 * Enrich a raw recon Manifest into a viewer-ready model: source links, per-node doc
 * refs, technology, directory-derived group lanes, and a Components view. Positions
 * are left empty (the layout stage fills them). Pure/deterministic.
 */
export function buildModel(recon: Manifest, opts: ModelOptions): Manifest {
  const groups: Record<string, Group> = {}
  const nodes: Record<string, ManifestNode> = {}
  const viewNodeIds: string[] = []

  for (const [id, n] of Object.entries(recon.nodes)) {
    const path = String(n.data.metadata?.path ?? n.id)
    const rel = relTo(path, opts.idPrefix)
    const segs = rel.split('/')
    const dir = segs.length > 1 ? segs[0] : 'root'
    const groupId = `lane:${dir}`
    groups[groupId] ??= { id: groupId, label: dir === 'root' ? 'Root' : dir, laneType: 'layer' }

    nodes[id] = {
      ...n,
      parentId: groupId,
      data: {
        ...n.data,
        technology: TECH_BY_EXT[extOf(path)] ?? n.data.technology,
        links: [{ label: 'Source', url: `${opts.blobBase}/${path}` }],
        doc: `pages/modules/${path.replace(/\.[^.]+$/, '')}.md`,
        confidence: 'static',
        provenance: n.data.provenance ?? {},
      },
    }
    viewNodeIds.push(id)
  }

  const view: View = { id: 'components', title: 'Components', level: 3, nodeIds: viewNodeIds, layoutDir: 'DOWN', layout: {} }

  return {
    schemaVersion: 2,
    meta: { ...(recon.meta ?? {}), repo: opts.repo },
    nodes,
    edges: { ...recon.edges },
    suppressions: { nodes: [], edges: [] },
    idAliases: {},
    groups,
    views: [view],
  }
}
