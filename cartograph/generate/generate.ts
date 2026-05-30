import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildModel } from './model.ts'
import { layoutAll } from './layout.ts'
import { reconModuleGraph } from './recon.ts'
import { buildSite } from './site.ts'
import { validate } from './validate.ts'

// CLI: recon a repo (or a subdir) -> architecture.json + site.json.
//   node generate.ts --repo <path> [--scan tools/factory] --out <dir> [--name org/name] [--ref main]

function arg(name: string, def?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : def
}

const repo = arg('repo')
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
const model = buildModel(recon, { repo: name, blobBase, idPrefix })
await layoutAll(model) // elkjs once -> bake positions into each view
const site = buildSite(model)
const result = validate(model)

mkdirSync(out, { recursive: true })
writeFileSync(join(out, 'architecture.json'), `${JSON.stringify(model, null, 2)}\n`)
writeFileSync(join(out, 'site.json'), `${JSON.stringify(site, null, 2)}\n`)

console.log(
  `recon: ${Object.keys(model.nodes).length} nodes, ${Object.keys(model.edges).length} edges, ${Object.keys(model.groups).length} lanes, ${model.views.length} view(s)`,
)
console.log(`validate: ${result.ok ? 'OK' : 'FAILED'}`)
if (!result.ok) {
  for (const e of result.errors) console.error(`  - ${e}`)
  process.exit(2)
}
console.log(`wrote ${join(out, 'architecture.json')} + site.json`)
