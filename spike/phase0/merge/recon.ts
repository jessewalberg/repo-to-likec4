import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import type { Manifest, ManifestEdge, ManifestNode } from './types.ts'

// Minimal Tier-1 recon: an ESM module + import graph for a directory of .mjs files.
// Deterministic, reads only import specifiers (not implementation). Stable ids of
// the form `module:<idPrefix>/<path>`. This is the real "extract boundaries, not
// source" pass, scoped to what the Phase-0 proof needs.

const IMPORT_RE = /(?:from|import)\s*["'](\.[^"']+)["']/g

function toPosix(p: string): string {
  return p.split('\\').join('/')
}

export function reconDir(scanRoot: string, idPrefix: string): Manifest {
  const files = (readdirSync(scanRoot, { recursive: true, encoding: 'utf8' }) as string[])
    .map(toPosix)
    .filter((f) => f.endsWith('.mjs'))
  const fileSet = new Set(files)
  const idOf = (rel: string) => `module:${idPrefix}/${toPosix(rel)}`

  const nodes: Record<string, ManifestNode> = {}
  for (const rel of files) {
    const id = idOf(rel)
    nodes[id] = {
      id,
      type: 'component',
      origin: 'machine',
      data: {
        label: rel.split('/').pop()!,
        metadata: { path: `${idPrefix}/${rel}` },
        provenance: {},
        confidence: 'static',
      },
      width: 200,
      height: 64,
    }
  }

  const edges: Record<string, ManifestEdge> = {}
  for (const rel of files) {
    const fromId = idOf(rel)
    const content = readFileSync(join(scanRoot, rel), 'utf8')
    const fromDirAbs = dirname(resolve(scanRoot, rel))
    IMPORT_RE.lastIndex = 0
    let mm: RegExpExecArray | null
    while ((mm = IMPORT_RE.exec(content)) !== null) {
      const spec = mm[1]
      const candidates = spec.endsWith('.mjs') ? [spec] : [`${spec}.mjs`, `${spec}/index.mjs`]
      for (const cand of candidates) {
        const targetRel = toPosix(relative(scanRoot, resolve(fromDirAbs, cand)))
        if (fileSet.has(targetRel)) {
          const toId = idOf(targetRel)
          const eid = `imports:${fromId}->${toId}`
          edges[eid] = { id: eid, source: fromId, target: toId, type: 'imports', origin: 'machine', confidence: 'static' }
          break
        }
      }
    }
  }

  const view = { id: 'modules', title: 'Modules', nodeIds: Object.keys(nodes), layout: {} as Record<string, { x: number; y: number }> }
  return { schemaVersion: 2, nodes, edges, suppressions: { nodes: [], edges: [] }, idAliases: {}, views: [view] }
}
