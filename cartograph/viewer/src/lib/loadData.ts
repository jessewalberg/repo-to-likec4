import type { CartographData, Changelog, Manifest, Site } from './types'

const EMPTY_CHANGELOG: Changelog = { schemaVersion: 1, entries: [] }

/**
 * Read the build-injected JSON data-island synchronously (file://-safe, no fetch).
 * In dev the island is absent → fall back to fetching the loose JSON from /public.
 * Always returns a fully-formed CartographData; never throws on missing pages.
 */
export async function loadData(): Promise<CartographData> {
  const island = typeof document !== 'undefined' ? document.getElementById('cartograph-data') : null
  if (island?.textContent) {
    const parsed = JSON.parse(island.textContent) as Partial<CartographData>
    return normalize(parsed)
  }

  // DEV fallback: files served from /public at the root.
  const [architecture, site, changelog] = await Promise.all([
    fetchJson<Manifest>('./architecture.json'),
    fetchJson<Site>('./site.json'),
    fetchJson<Changelog>('./changelog.json').catch(() => EMPTY_CHANGELOG),
  ])
  return normalize({ architecture, site, changelog, pages: {} })
}

function normalize(d: Partial<CartographData>): CartographData {
  return {
    architecture: d.architecture as Manifest,
    site: d.site as Site,
    changelog: d.changelog ?? EMPTY_CHANGELOG,
    pages: d.pages ?? {},
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`loadData: ${url} → ${res.status}`)
  return (await res.json()) as T
}
