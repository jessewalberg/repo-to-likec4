import { existsSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'

// When a repo was previously mapped by the old repo-to-likec4 (LikeC4) skill it
// carries dead artifacts that Cartograph replaces. We detect them so a re-mapped
// repo never silently ends up with two architecture systems side by side, and
// remove the wholly-owned ones on --migrate. Shared files (a .gitlab-ci.yml that
// merely references likec4) are reported but never auto-deleted — the user edits
// those by hand. See skills/repo-to-likec4/SKILL.md "What you deliver".

/** The slice of the filesystem this module needs, injectable so detection is testable without disk. */
export interface RepoFs {
  exists(path: string): boolean
  read(path: string): string
  remove(path: string): void
}

const nodeFs: RepoFs = {
  exists: (p) => existsSync(p),
  read: (p) => readFileSync(p, 'utf8'),
  remove: (p) => rmSync(p, { recursive: true, force: true }),
}

/** Paths (relative to repo root) the LikeC4 skill owns entirely — safe to delete wholesale. */
const REMOVABLE = ['likec4', '.github/workflows/likec4-pages.yml']

/** Shared files that are only a LikeC4 artifact when they reference it — warn, never auto-delete. */
const CONDITIONAL = [{ path: '.gitlab-ci.yml', mustContain: 'likec4' }]

export interface LikeC4Artifacts {
  /** Wholly LikeC4-owned paths, safe for --migrate to delete. */
  removable: string[]
  /** Shared files referencing LikeC4 that the user must edit by hand. */
  manual: string[]
}

export function detectLikeC4Artifacts(repoRoot: string, fs: RepoFs = nodeFs): LikeC4Artifacts {
  const removable = REMOVABLE.filter((rel) => fs.exists(join(repoRoot, rel)))
  const manual = CONDITIONAL.filter(({ path, mustContain }) => {
    const abs = join(repoRoot, path)
    return fs.exists(abs) && fs.read(abs).includes(mustContain)
  }).map(({ path }) => path)
  return { removable, manual }
}

export function formatMigrationNotice(found: LikeC4Artifacts): string {
  const all = [...found.removable, ...found.manual]
  if (all.length === 0) return ''
  const lines = [
    'migrate: this repo still carries LikeC4 artifacts from the old repo-to-likec4 skill:',
    ...found.removable.map((f) => `    - ${f} (removable)`),
    ...found.manual.map((f) => `    - ${f} (shared — edit by hand)`),
    '    Cartograph replaces these. Re-run with --migrate to delete the removable ones.',
  ]
  return lines.join('\n')
}

/** Delete only the wholly-owned (removable) artifacts; never touches shared/manual files. */
export function removeLikeC4Artifacts(repoRoot: string, found: LikeC4Artifacts, fs: RepoFs = nodeFs): void {
  for (const rel of found.removable) fs.remove(join(repoRoot, rel))
}
