import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { type Manifest, type ManifestEdge, type ManifestNode, emptyManifest } from './schema.ts'

// Tier-1 recon: a module + import graph for a directory of source files.
// Deterministic; reads only import specifiers (the "extract boundaries, not source"
// pass). Language-pluggable: each extension maps to a resolver that turns one file's
// import statements into edges to other in-scan files. JS/TS resolves precisely
// (confidence 'static'); Python/Ruby/Go are pattern-matched (confidence 'inferred').

const JS_EXTS = ['.mjs', '.cjs', '.js', '.jsx', '.ts', '.tsx']
const DEFAULT_EXTS = [...JS_EXTS, '.py', '.rb', '.go']

function toPosix(p: string): string {
  return p.split('\\').join('/')
}

function walk(root: string, exts: string[]): string[] {
  const out: string[] = []
  for (const name of readdirSync(root)) {
    if (name === 'node_modules' || name === 'vendor' || name.startsWith('.')) continue
    const abs = join(root, name)
    const st = statSync(abs)
    if (st.isDirectory()) out.push(...walk(abs, exts))
    else if (exts.some((e) => name.endsWith(e))) out.push(abs)
  }
  return out
}

interface ResolveCtx {
  scanRoot: string
  fileSet: Set<string>
  goModule: string | null
}

/** An edge target: a repo-relative file path + the confidence of the resolution. */
interface ResolvedEdge {
  targetRel: string
  confidence: 'static' | 'inferred'
}

function extOf(name: string): string {
  const m = name.match(/\.[^./]+$/)
  return m ? m[0] : ''
}

// ---- JS/TS: relative import specifiers, resolved to a file (precise). ----
const JS_RE = /(?:from|import|require\()\s*["'](\.[^"']+)["']/g
function resolveJs(content: string, fromRel: string, ctx: ResolveCtx): ResolvedEdge[] {
  const out: ResolvedEdge[] = []
  const fromDirAbs = dirname(resolve(ctx.scanRoot, fromRel))
  JS_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = JS_RE.exec(content)) !== null) {
    const spec = m[1]
    const cands = JS_EXTS.some((e) => spec.endsWith(e))
      ? [spec]
      : [...JS_EXTS.map((e) => `${spec}${e}`), ...JS_EXTS.map((e) => `${spec}/index${e}`)]
    for (const cand of cands) {
      const targetRel = toPosix(relative(ctx.scanRoot, resolve(fromDirAbs, cand)))
      if (ctx.fileSet.has(targetRel)) {
        out.push({ targetRel, confidence: 'static' })
        break
      }
    }
  }
  return out
}

// ---- Python: `import a.b` / `from a.b import x` / relative `from .x import`. ----
const PY_RE = /^[ \t]*(?:from[ \t]+(\.*)([\w.]*)[ \t]+import\b|import[ \t]+([\w.]+))/gm
function resolvePy(content: string, fromRel: string, ctx: ResolveCtx): ResolvedEdge[] {
  const out: ResolvedEdge[] = []
  const fromDir = dirname(fromRel) // posix, scan-relative
  PY_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = PY_RE.exec(content)) !== null) {
    const dots = m[1] ?? '' // leading dots for `from . import`
    const fromPath = m[2] ?? '' // module path in a `from` (may be empty for `from . import x`)
    const importPath = m[3] // module path in a bare `import a.b`
    const dotted = importPath ?? fromPath
    let baseDir = ''
    if (dots) {
      // relative: each dot beyond the first climbs a directory.
      let dir = fromDir === '.' ? '' : fromDir
      for (let i = 1; i < dots.length; i++) dir = dirname(dir === '' ? '.' : dir)
      baseDir = dir === '.' ? '' : dir
    }
    const segs = dotted ? dotted.split('.').filter(Boolean) : []
    const relNoExt = [baseDir, ...segs].filter(Boolean).join('/')
    if (!relNoExt) continue
    for (const cand of [`${relNoExt}.py`, `${relNoExt}/__init__.py`]) {
      if (ctx.fileSet.has(toPosix(cand))) {
        out.push({ targetRel: toPosix(cand), confidence: 'inferred' })
        break
      }
    }
  }
  return out
}

// ---- Ruby: require_relative './x' (file-path based, like JS). ----
const RB_RE = /require_relative\s+["']([^"']+)["']/g
function resolveRb(content: string, fromRel: string, ctx: ResolveCtx): ResolvedEdge[] {
  const out: ResolvedEdge[] = []
  const fromDirAbs = dirname(resolve(ctx.scanRoot, fromRel))
  RB_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = RB_RE.exec(content)) !== null) {
    const spec = m[1].endsWith('.rb') ? m[1] : `${m[1]}.rb`
    const targetRel = toPosix(relative(ctx.scanRoot, resolve(fromDirAbs, spec)))
    if (ctx.fileSet.has(targetRel)) out.push({ targetRel, confidence: 'inferred' })
  }
  return out
}

// ---- Go: imports are package (directory) paths under the go.mod module. ----
const GO_BLOCK_RE = /import\s*\(([\s\S]*?)\)/g
const GO_SINGLE_RE = /import\s+(?:[\w.]+\s+)?"([^"]+)"/g
const GO_PATH_RE = /"([^"]+)"/g
function resolveGo(content: string, _fromRel: string, ctx: ResolveCtx): ResolvedEdge[] {
  if (!ctx.goModule) return []
  const out: ResolvedEdge[] = []
  const paths: string[] = []
  GO_BLOCK_RE.lastIndex = 0
  let block: RegExpExecArray | null
  while ((block = GO_BLOCK_RE.exec(content)) !== null) {
    GO_PATH_RE.lastIndex = 0
    let p: RegExpExecArray | null
    while ((p = GO_PATH_RE.exec(block[1])) !== null) paths.push(p[1])
  }
  GO_SINGLE_RE.lastIndex = 0
  let s: RegExpExecArray | null
  while ((s = GO_SINGLE_RE.exec(content)) !== null) paths.push(s[1])

  for (const imp of paths) {
    if (imp !== ctx.goModule && !imp.startsWith(`${ctx.goModule}/`)) continue // external package
    const dir = imp === ctx.goModule ? '' : imp.slice(ctx.goModule.length + 1)
    // Go's unit is the package (dir); link to each .go file in the target dir.
    for (const rel of ctx.fileSet) {
      if (!rel.endsWith('.go')) continue
      if (toPosix(dirname(rel)) === (dir === '' ? '.' : dir)) out.push({ targetRel: rel, confidence: 'inferred' })
    }
  }
  return out
}

const RESOLVERS: Record<string, (c: string, f: string, ctx: ResolveCtx) => ResolvedEdge[]> = {
  '.mjs': resolveJs, '.cjs': resolveJs, '.js': resolveJs, '.jsx': resolveJs, '.ts': resolveJs, '.tsx': resolveJs,
  '.py': resolvePy,
  '.rb': resolveRb,
  '.go': resolveGo,
}

function readGoModule(scanRoot: string): string | null {
  // Look for go.mod at the scan root or a few levels up.
  let dir = scanRoot
  for (let i = 0; i < 5; i++) {
    const gomod = join(dir, 'go.mod')
    if (existsSync(gomod)) {
      const m = readFileSync(gomod, 'utf8').match(/^module\s+(\S+)/m)
      if (m) return m[1]
    }
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return null
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
  const ctx: ResolveCtx = { scanRoot, fileSet, goModule: relFiles.some((f) => f.endsWith('.go')) ? readGoModule(scanRoot) : null }

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
    const resolver = RESOLVERS[extOf(rel)]
    if (!resolver) continue
    const fromId = idOf(rel)
    const content = readFileSync(join(scanRoot, rel), 'utf8')
    for (const { targetRel, confidence } of resolver(content, rel, ctx)) {
      if (targetRel === rel) continue // a package self-reference (Go) — skip self-edges
      const toId = idOf(targetRel)
      const eid = `imports:${fromId}->${toId}`
      if (manifest.edges[eid]) continue
      const edge: ManifestEdge = { id: eid, source: fromId, target: toId, type: 'imports', origin: 'machine', confidence }
      manifest.edges[eid] = edge
    }
  }

  return manifest
}
