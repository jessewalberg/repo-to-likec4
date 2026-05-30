import { existsSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

// When a repo was previously mapped by LikeC4 (the old repo-to-likec4 skill, or a
// hand-rolled setup) it carries dead artifacts that Cartograph replaces. We detect
// them so a re-mapped repo never ends up with two architecture systems side by
// side, and — by default — remove the wholly-owned ones (the agent-owned LikeC4
// files: the likec4/ dir, any *.c4 / *.likec4 source, likec4.config.json, the
// likec4-pages.yml workflow). A SHARED file (a .gitlab-ci.yml that merely
// references likec4) is reported but never auto-deleted — the user edits it.

/** The slice of the filesystem this module needs, injectable so detection is testable without disk. */
export interface RepoFs {
  exists(path: string): boolean
  read(path: string): string
  remove(path: string): void
  /** Repo-relative paths of all files (excluding node_modules/.git/etc.). */
  list(): string[]
}

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'dist-template', '.cartograph', 'cartograph-site'])

function listFiles(root: string): string[] {
  const out: string[] = []
  const walk = (dir: string) => {
    let entries: string[]
    try {
      entries = readdirSync(dir)
    } catch {
      return
    }
    for (const name of entries) {
      if (SKIP_DIRS.has(name)) continue
      const abs = join(dir, name)
      let st: ReturnType<typeof statSync>
      try {
        st = statSync(abs)
      } catch {
        continue // dangling symlink etc.
      }
      if (st.isDirectory()) walk(abs)
      else out.push(relative(root, abs).split('\\').join('/'))
    }
  }
  walk(root)
  return out
}

function makeNodeFs(repoRoot: string): RepoFs {
  return {
    exists: (p) => existsSync(p),
    read: (p) => readFileSync(p, 'utf8'),
    remove: (p) => rmSync(p, { recursive: true, force: true }),
    list: () => listFiles(repoRoot),
  }
}

/** Wholly-LikeC4-owned fixed paths — safe to delete wholesale. */
const REMOVABLE_FIXED = ['likec4', '.github/workflows/likec4-pages.yml']

/** A repo-relative file that is itself a LikeC4 artifact (delete the file). */
function isLikeC4File(rel: string): boolean {
  const name = rel.split('/').pop() ?? rel
  return rel.endsWith('.c4') || rel.endsWith('.likec4') || name === 'likec4.config.json'
}

/** Shared files that are only a LikeC4 artifact when they reference it — warn, never auto-delete. */
const CONDITIONAL = [{ path: '.gitlab-ci.yml', mustContain: 'likec4' }]

export interface LikeC4Artifacts {
  /** Wholly LikeC4-owned paths, safe to delete. */
  removable: string[]
  /** Shared files referencing LikeC4 that the user must edit by hand. */
  manual: string[]
}

export function detectLikeC4Artifacts(repoRoot: string, fs: RepoFs = makeNodeFs(repoRoot)): LikeC4Artifacts {
  const removable = new Set<string>()
  for (const rel of REMOVABLE_FIXED) {
    if (fs.exists(join(repoRoot, rel))) removable.add(rel)
  }
  // Any *.c4 / *.likec4 / likec4.config.json anywhere — skip those already covered
  // by the removable `likec4/` directory.
  const insideLikec4Dir = removable.has('likec4')
  for (const rel of fs.list()) {
    if (!isLikeC4File(rel)) continue
    if (insideLikec4Dir && (rel === 'likec4' || rel.startsWith('likec4/'))) continue
    removable.add(rel)
  }
  const manual = CONDITIONAL.filter(({ path, mustContain }) => {
    const abs = join(repoRoot, path)
    return fs.exists(abs) && fs.read(abs).includes(mustContain)
  }).map(({ path }) => path)
  return { removable: [...removable].sort(), manual }
}

export function formatMigrationNotice(found: LikeC4Artifacts, removed: boolean): string {
  if (found.removable.length === 0 && found.manual.length === 0) return ''
  const verb = removed ? 'removed' : 'found'
  const lines = [`migrate: ${verb} LikeC4 artifacts (Cartograph replaces them):`]
  for (const f of found.removable) lines.push(`    - ${f}${removed ? ' (deleted)' : ' (removable)'}`)
  for (const f of found.manual) lines.push(`    - ${f} (shared — edit by hand)`)
  if (!removed) lines.push('    Pass --keep-c4 to leave them, or they are deleted by default.')
  return lines.join('\n')
}

/** Delete the wholly-owned (removable) artifacts; never touches shared/manual files. */
export function removeLikeC4Artifacts(repoRoot: string, found: LikeC4Artifacts, fs: RepoFs = makeNodeFs(repoRoot)): void {
  for (const rel of found.removable) fs.remove(join(repoRoot, rel))
}
