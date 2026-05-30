import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { type Changelog, appendChangelog, emptyChangelog } from './changelog.ts'
import { buildModel } from './model.ts'
import { layoutAll, layoutNew } from './layout.ts'
import { mergeManifest } from './merge.ts'
import { detectLikeC4Artifacts, formatMigrationNotice, removeLikeC4Artifacts } from './migrate.ts'
import { reconModuleGraph } from './recon.ts'
import type { Manifest, MergeReport } from './schema.ts'
import { buildSite } from './site.ts'
import { validate } from './validate.ts'

// CLI: recon a repo (or a subdir) -> architecture.json + site.json.
//   node generate.ts --repo <path> [--scan tools/factory] --out <dir> [--name org/name] [--ref main]

function arg(name: string, def?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : def
}

const repo = arg('repo')
const migrate = process.argv.includes('--migrate')
const scan = arg('scan', '')!
const out = arg('out', 'out')!
const ref = arg('ref', 'main')!
let name = arg('name')
let blobBase = arg('blob-base')

if (!repo) {
  console.error('usage: node generate.ts --repo <path> [--scan <subdir>] --out <dir> [--name org/name] [--ref main]')
  process.exit(1)
}

if (!name) {
  try {
    const remote = execFileSync('git', ['-C', repo, 'remote', 'get-url', 'origin'], { encoding: 'utf8' }).trim()
    const mm = remote.match(/github\.com[:/]([^/]+\/[^/.]+)/)
    if (mm) name = mm[1]
  } catch {
    /* no remote; fall through */
  }
}
name = name ?? 'local/repo'
blobBase = blobBase ?? `https://github.com/${name}/blob/${ref}`

const scanRoot = scan ? join(repo, scan) : repo
const idPrefix = scan || (name.split('/').pop() ?? 'repo')

const recon = reconModuleGraph(scanRoot, { idPrefix })
const fresh = buildModel(recon, { repo: name, blobBase, idPrefix })

// First run: lay out the whole thing. Re-run over an existing manifest: three-way
// merge so human edits survive, then place only the new nodes (positions frozen).
const archPath = join(out, 'architecture.json')
const changelogPath = join(out, 'changelog.json')
let model: Manifest
let report: MergeReport | undefined
if (existsSync(archPath)) {
  const current = JSON.parse(readFileSync(archPath, 'utf8')) as Manifest
  const merged = mergeManifest(current, fresh, current)
  model = merged.manifest
  report = merged.report
  layoutNew(model, merged.nodesNeedingLayout)
} else {
  model = fresh
  await layoutAll(model) // elkjs once -> bake positions into each view
}

const prevLog: Changelog = existsSync(changelogPath)
  ? (JSON.parse(readFileSync(changelogPath, 'utf8')) as Changelog)
  : emptyChangelog()
const changelog = report ? appendChangelog(prevLog, report, { ref, timestamp: new Date().toISOString() }) : prevLog

const site = buildSite(model)
const result = validate(model)

mkdirSync(out, { recursive: true })
writeFileSync(archPath, `${JSON.stringify(model, null, 2)}\n`)
writeFileSync(join(out, 'site.json'), `${JSON.stringify(site, null, 2)}\n`)
writeFileSync(changelogPath, `${JSON.stringify(changelog, null, 2)}\n`)

console.log(
  `recon: ${Object.keys(model.nodes).length} nodes, ${Object.keys(model.edges).length} edges, ${Object.keys(model.groups).length} lanes, ${model.views.length} view(s)`,
)
if (report) {
  console.log(
    `merge: +${report.added.length} added, ${report.mutedRemoved.length} muted, ${report.migrated.length} migrated, ${report.suppressedSkipped.length} suppressed`,
  )
}
console.log(`validate: ${result.ok ? 'OK' : 'FAILED'}`)
if (!result.ok) {
  for (const e of result.errors) console.error(`  - ${e}`)
  process.exit(2)
}
console.log(`wrote ${archPath} + site.json + changelog.json`)

// Surface (and on --migrate, remove) dead artifacts from a prior LikeC4 mapping
// so a re-mapped repo never carries two architecture systems side by side.
const stale = detectLikeC4Artifacts(repo)
if (stale.removable.length || stale.manual.length) {
  if (migrate) {
    removeLikeC4Artifacts(repo, stale)
    console.log(`migrate: removed ${stale.removable.join(', ') || 'nothing'}`)
    if (stale.manual.length) console.log(`migrate: left shared file(s) for you to edit: ${stale.manual.join(', ')}`)
  } else {
    console.log(formatMigrationNotice(stale))
  }
}
