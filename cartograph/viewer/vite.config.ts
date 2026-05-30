import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { type Plugin, defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// Reads the agent-owned manifest at BUILD time and injects it as a
// <script type="application/json" id="cartograph-data"> island so the built
// viewer.html is fully self-contained and works over file:// with no fetch.
function dataIsland(): Plugin {
  const read = (f: string) => JSON.parse(readFileSync(resolve(import.meta.dirname, 'public', f), 'utf8'))
  return {
    name: 'cartograph-data-island',
    transformIndexHtml: {
      order: 'pre',
      handler() {
        const payload = {
          architecture: read('architecture.json'),
          site: read('site.json'),
          changelog: tryRead(read, 'changelog.json', { schemaVersion: 1, entries: [] }),
          pages: {} as Record<string, string>, // filled from pages/**.md when they exist
        }
        return [
          {
            tag: 'script',
            attrs: { type: 'application/json', id: 'cartograph-data' },
            children: JSON.stringify(payload).replace(/<\//g, '<\\/'),
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
