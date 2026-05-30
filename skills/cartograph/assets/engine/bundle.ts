import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'

// bundle: take the prebuilt viewer TEMPLATE (a self-contained viewer.html whose
// data island is the placeholder below) and a repo's generated JSON, and emit a
// final self-contained viewer.html — NO npm/vite/node_modules needed by the end
// user. This is the connective tissue that makes Cartograph an installable skill:
// generate.ts builds the manifest for any repo; bundle.ts drops it into the
// shipped template.

export const PLACEHOLDER = '__CARTOGRAPH_DATA__'

export interface CartographPayload {
  architecture: unknown
  site: unknown
  changelog: unknown
  tours: unknown
  pages: Record<string, string>
}

/** Replace the template's data-island placeholder with the JSON payload. */
export function injectData(template: string, payload: CartographPayload): string {
  if (!template.includes(PLACEHOLDER)) {
    throw new Error(`bundle: template is missing the ${PLACEHOLDER} placeholder (was it built with CARTO_TEMPLATE=1?)`)
  }
  // Escape </ so embedded markup can't close the <script> early; use a replacer
  // FUNCTION so '$' sequences in the JSON aren't treated as replacement patterns.
  const json = JSON.stringify(payload).replace(/<\//g, '<\\/')
  return template.replace(PLACEHOLDER, () => json)
}

/** Read all *.md under `dir` into a map keyed by repo-relative path (e.g. pages/x.md). */
export function readPages(dir: string, root: string): Record<string, string> {
  const out: Record<string, string> = {}
  if (!existsSync(dir)) return out
  const walk = (d: string) => {
    for (const name of readdirSync(d)) {
      const abs = join(d, name)
      if (statSync(abs).isDirectory()) walk(abs)
      else if (name.endsWith('.md') || name.endsWith('.mdx')) out[relative(root, abs)] = readFileSync(abs, 'utf8')
    }
  }
  walk(dir)
  return out
}

// ---- CLI ----------------------------------------------------------------

function arg(name: string, def?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : def
}

function readJson(path: string, fallback?: unknown): unknown {
  if (!existsSync(path)) {
    if (fallback !== undefined) return fallback
    throw new Error(`bundle: required file not found: ${path}`)
  }
  return JSON.parse(readFileSync(path, 'utf8'))
}

function main(): void {
  const template = arg('template')
  const dataDir = arg('data', 'out')!
  const out = arg('out', join(dataDir, 'viewer.html'))!
  if (!template) {
    console.error('usage: node bundle.ts --template <viewer-template.html> --data <dir with architecture.json,site.json,changelog.json[,pages/]> [--out viewer.html]')
    process.exit(1)
  }

  const payload: CartographPayload = {
    architecture: readJson(join(dataDir, 'architecture.json')),
    site: readJson(join(dataDir, 'site.json')),
    changelog: readJson(join(dataDir, 'changelog.json'), { schemaVersion: 1, entries: [] }),
    tours: readJson(join(dataDir, 'tours.json'), { schemaVersion: 1, tours: [] }),
    pages: readPages(join(dataDir, 'pages'), dataDir),
  }

  const html = injectData(readFileSync(template, 'utf8'), payload)
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, html)
  const kb = Math.round(Buffer.byteLength(html) / 1024)
  console.log(`bundle: wrote ${out} (${kb} kB, ${Object.keys(payload.pages).length} page(s))`)
}

// Run as a CLI only when invoked directly (so the test can import the pure fns).
if (process.argv[1] && process.argv[1].endsWith('bundle.ts')) {
  try {
    main()
  } catch (err) {
    console.error(String(err instanceof Error ? err.message : err))
    process.exit(2)
  }
}
