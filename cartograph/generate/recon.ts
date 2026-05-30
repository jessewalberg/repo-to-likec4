import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { type Manifest, type ManifestEdge, type ManifestNode, emptyManifest } from './schema.ts'

// Tier-1 recon: a module + import graph for a directory of source files.
// Deterministic; reads only import specifiers (the "extract boundaries, not source"
// pass). Generalized from the proven spike recon to TS/JS/MJS. Returns a Manifest
// with nodes + edges filled; model.ts enriches it (links, docs, views, groups).

const DEFAULT_EXTS = ['.mjs', '.cjs', '.js', '.jsx', '.ts', '.tsx']
const IMPORT_RE = /(?:from|import|require\()\s*["'](\.[^"']+)["']/g

function toPosix(p: string): string {
  return p.split('\\').join('/')
}

function walk(root: string, exts: string[]): string[] {
  const out: string[] = []
  for (const name of readdirSync(root)) {
    if (name === 'node_modules' || name.startsWith('.')) continue
    const abs = join(root, name)
    const st = statSync(abs)
    if (st.isDirectory()) out.push(...walk(abs, exts))
    else if (exts.some((e) => name.endsWith(e))) out.push(abs)
  }
  return out
}

export interface ReconOptions {
  /** logical repo-relative prefix for ids, e.g. 'tools/factory' */
  idPrefix: string
  exts?: string[]
}

export function reconModuleGraph(scanRoot: string, opts: ReconOptions): Manifest {
  const exts = opts.exts ?? DEFAULT_EXTS
  const absFiles = walk(scanRoot, exts)
  const relFiles = absFiles.map((f) => toPosix(relative(scanRoot, f)))
  const fileSet = new Set(relFiles)
  const idOf = (rel: string) => `module:${opts.idPrefix}/${toPosix(rel)}`

  const manifest = emptyManifest()

  for (const rel of relFiles) {
    const id = idOf(rel)
    const node: ManifestNode = {
      id,
      type: 'component',
      origin: 'machine',
      data: {
        label: rel.split('/').pop()!,
        metadata: { path: `${opts.idPrefix}/${rel}` },
        provenance: {},
        confidence: 'static',
      },
      width: 220,
      height: 72,
    }
    manifest.nodes[id] = node
  }

  for (const rel of relFiles) {
    const fromId = idOf(rel)
    const content = readFileSync(join(scanRoot, rel), 'utf8')
    const fromDirAbs = dirname(resolve(scanRoot, rel))
    IMPORT_RE.lastIndex = 0
    let mm: RegExpExecArray | null
    while ((mm = IMPORT_RE.exec(content)) !== null) {
      const spec = mm[1]
      const candidates = exts.some((e) => spec.endsWith(e))
        ? [spec]
        : [...exts.map((e) => `${spec}${e}`), ...exts.map((e) => `${spec}/index${e}`)]
      for (const cand of candidates) {
        const targetRel = toPosix(relative(scanRoot, resolve(fromDirAbs, cand)))
        if (fileSet.has(targetRel)) {
          const toId = idOf(targetRel)
          const eid = `imports:${fromId}->${toId}`
          const edge: ManifestEdge = { id: eid, source: fromId, target: toId, type: 'imports', origin: 'machine', confidence: 'static' }
          manifest.edges[eid] = edge
          break
        }
      }
    }
  }

  return manifest
}
