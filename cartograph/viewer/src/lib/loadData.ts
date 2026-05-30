import type { CartographData, Changelog, Manifest, Site, Tours } from './types'

const EMPTY_CHANGELOG: Changelog = { schemaVersion: 1, entries: [] }
const EMPTY_TOURS: Tours = { schemaVersion: 1, tours: [] }

/**
 * Read the build-injected JSON data-island synchronously (file://-safe, no fetch).
 * In dev the island is absent → fall back to fetching the loose JSON from /public.
 * Always returns a fully-formed CartographData; never throws on missing pages.
 */
export async function loadData(): Promise<CartographData> {
  const island = typeof document !== 'undefined' ? document.getElementById('cartograph-data') : null
  const text = island?.textContent?.trim()
  // A non-empty island that parses = the injected data. An un-injected template
  // (placeholder) or malformed text falls through to the dev fetch fallback.
  if (text && text.startsWith('{')) {
    try {
      return normalize(JSON.parse(text) as Partial<CartographData>)
    } catch {
      /* fall through to fetch */
    }
  }

  // DEV fallback: files served from /public at the root.
  const [architecture, site, changelog, tours] = await Promise.all([
    fetchJson<Manifest>('./architecture.json'),
    fetchJson<Site>('./site.json'),
    fetchJson<Changelog>('./changelog.json').catch(() => EMPTY_CHANGELOG),
    fetchJson<Tours>('./tours.json').catch(() => EMPTY_TOURS),
  ])
  return normalize({ architecture, site, changelog, tours, pages: {} })
}

function normalize(d: Partial<CartographData>): CartographData {
  return {
    architecture: d.architecture as Manifest,
    site: d.site as Site,
    changelog: d.changelog ?? EMPTY_CHANGELOG,
    tours: d.tours ?? EMPTY_TOURS,
    pages: d.pages ?? {},
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`loadData: ${url} → ${res.status}`)
  return (await res.json()) as T
}
