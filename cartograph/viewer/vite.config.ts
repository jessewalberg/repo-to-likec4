import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { type Plugin, defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// The marker the skill's bundler swaps for a repo's real JSON (see
// cartograph/generate/bundle.ts). Kept on one line so a literal string replace
// is unambiguous.
const DATA_PLACEHOLDER = '__CARTOGRAPH_DATA__'

// Injects the <script type="application/json" id="cartograph-data"> island so the
// built viewer.html is self-contained and works over file:// with no fetch.
//   CARTO_TEMPLATE=1  -> inject the PLACEHOLDER (produces the reusable skill
//                        template; bundle.ts later swaps in any repo's data).
//   otherwise         -> inline public/*.json (our dev/demo build).
function readPages(pubDir: string): Record<string, string> {
  const dir = resolve(pubDir, 'pages')
  const out: Record<string, string> = {}
  if (!existsSync(dir)) return out
  const walk = (d: string) => {
    for (const name of readdirSync(d)) {
      const abs = join(d, name)
      if (statSync(abs).isDirectory()) walk(abs)
      else if (name.endsWith('.md') || name.endsWith('.mdx')) out[`pages/${relative(dir, abs).split('\\').join('/')}`] = readFileSync(abs, 'utf8')
    }
  }
  walk(dir)
  return out
}

function dataIsland(): Plugin {
  const template = process.env.CARTO_TEMPLATE === '1'
  const pubDir = resolve(import.meta.dirname, 'public')
  const read = (f: string) => JSON.parse(readFileSync(resolve(pubDir, f), 'utf8'))
  return {
    name: 'cartograph-data-island',
    transformIndexHtml: {
      order: 'pre',
      handler() {
        let children: string
        if (template) {
          children = DATA_PLACEHOLDER
        } else {
          const payload = {
            architecture: read('architecture.json'),
            site: read('site.json'),
            changelog: tryRead(read, 'changelog.json', { schemaVersion: 1, entries: [] }),
            tours: tryRead(read, 'tours.json', { schemaVersion: 1, tours: [] }),
            pages: readPages(pubDir),
          }
          children = JSON.stringify(payload).replace(/<\//g, '<\\/')
        }
        return [
          {
            tag: 'script',
            attrs: { type: 'application/json', id: 'cartograph-data' },
            children,
            injectTo: 'body',
          },
        ]
      },
    },
  }
}

function tryRead(read: (f: string) => unknown, f: string, fallback: unknown): unknown {
  try {
    return read(f)
  } catch {
    return fallback
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), dataIsland(), viteSingleFile()],
  build: {
    rollupOptions: {
      // Vite respects the HTML entry's filename → emits dist/viewer.html directly.
      input: { viewer: resolve(import.meta.dirname, 'viewer.html') },
    },
  },
})
