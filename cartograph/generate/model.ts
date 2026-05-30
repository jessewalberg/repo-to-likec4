import type { Group, Manifest, ManifestEdge, ManifestNode, View } from './schema.ts'

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
  '.py': 'Python',
  '.go': 'Go',
  '.rb': 'Ruby',
}

function extOf(path: string): string {
  const m = path.match(/\.[^./]+$/)
  return m ? m[0] : ''
}

function relTo(path: string, idPrefix: string): string {
  return path.startsWith(`${idPrefix}/`) ? path.slice(idPrefix.length + 1) : path
}

/** Top-level directory of a module's repo-relative path; files at the scan root → 'root'. */
function dirOfRel(rel: string): string {
  const segs = rel.split('/')
  return segs.length > 1 ? segs[0] : 'root'
}

const labelForDir = (dir: string) => (dir === 'root' ? 'Root' : dir)

/**
 * Enrich a raw recon Manifest into a viewer-ready model: source links, per-node doc
 * refs, technology, directory-derived group lanes, and a C4-style altitude ladder of
 * views. Positions are left empty (the layout stage fills them). Pure/deterministic.
 *
 * Views:
 *  - **Containers** (level 2) — one synthetic node per top-level directory, with
 *    cross-directory imports aggregated into container→container edges. The C4
 *    overview. (Only when the repo has ≥2 directories.)
 *  - **Components** (level 3) — every module, lanes by directory.
 *  - **Components by area** (level 3) — one drill-down view per directory.
 */
export function buildModel(recon: Manifest, opts: ModelOptions): Manifest {
  const groups: Record<string, Group> = {}
  const nodes: Record<string, ManifestNode> = {}
  const moduleIds: string[] = []
  const dirOf: Record<string, string> = {}

  for (const [id, n] of Object.entries(recon.nodes)) {
    const path = String(n.data.metadata?.path ?? n.id)
    const rel = relTo(path, opts.idPrefix)
    const dir = dirOfRel(rel)
    dirOf[id] = dir
    const groupId = `lane:${dir}`
    groups[groupId] ??= { id: groupId, label: labelForDir(dir), laneType: 'layer' }

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
    moduleIds.push(id)
  }

  const dirs = [...new Set(Object.values(dirOf))].sort()
  const hasLadder = dirs.length >= 2

  const edges: Record<string, ManifestEdge> = { ...recon.edges }
  const views: View[] = []

  if (hasLadder) {
    // --- synthetic container nodes (one per directory) ---
    const containerIds: string[] = []
    for (const dir of dirs) {
      const cid = `container:${dir}`
      // Repo-relative directory path; empty idPrefix (whole-repo) keeps it clean.
      const base = opts.idPrefix
      const dpath = dir === 'root' ? base : base ? `${base}/${dir}` : dir
      const moduleCount = moduleIds.filter((id) => dirOf[id] === dir).length
      nodes[cid] = {
        id: cid,
        type: 'container',
        origin: 'machine',
        data: {
          label: labelForDir(dir),
          summary: `${moduleCount} module${moduleCount === 1 ? '' : 's'}`,
          metadata: { path: dpath, modules: moduleCount },
          links: [{ label: 'Source', url: `${opts.blobBase}/${dpath}` }],
          doc: `pages/containers/${dir}.md`,
          confidence: 'static',
          provenance: {},
        },
        width: 240,
        height: 84,
      }
      containerIds.push(cid)
    }

    // --- aggregate cross-directory module imports into container edges ---
    const seen = new Set<string>()
    for (const e of Object.values(recon.edges)) {
      const ds = dirOf[e.source]
      const dt = dirOf[e.target]
      if (!ds || !dt || ds === dt) continue
      const eid = `imports:container:${ds}->container:${dt}`
      if (seen.has(eid)) continue
      seen.add(eid)
      edges[eid] = { id: eid, source: `container:${ds}`, target: `container:${dt}`, type: 'imports', origin: 'machine', confidence: 'static' }
    }

    views.push({ id: 'containers', title: 'Containers', level: 2, nodeIds: containerIds, layoutDir: 'DOWN', layout: {} })
  }

  // Components: every module, lanes by directory (the always-present view).
  views.push({ id: 'components', title: 'Components', level: 3, nodeIds: moduleIds, layoutDir: 'DOWN', layout: {} })

  // Per-directory drill-down views.
  if (hasLadder) {
    for (const dir of dirs) {
      const ids = moduleIds.filter((id) => dirOf[id] === dir)
      if (ids.length === 0) continue
      views.push({ id: `components:${dir}`, title: labelForDir(dir), level: 3, nodeIds: ids, layoutDir: 'DOWN', layout: {} })
    }
  }

  return {
    schemaVersion: 2,
    meta: { ...(recon.meta ?? {}), repo: opts.repo },
    nodes,
    edges,
    suppressions: { nodes: [], edges: [] },
    idAliases: {},
    groups,
    views,
  }
}
