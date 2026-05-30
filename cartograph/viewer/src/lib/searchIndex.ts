import type { CartographData, NavEntry, SearchDoc } from './types'

// Build the flat ⌘K index once from architecture + site, honoring
// site.search.index (which of nodes/edges/pages/tours to include). Keywords
// never contain undefined; same-label items disambiguate via their id.

export interface SearchHandlers {
  selectNode: (id: string) => void
  selectEdge: (id: string) => void
  openPage: (page: string, node?: string) => void
  openTour: (tourId: string) => void
}

export function buildSearchIndex(data: CartographData, handlers: SearchHandlers): SearchDoc[] {
  const include = new Set(data.site?.search?.index ?? ['nodes', 'edges', 'pages', 'tours'])
  const docs: SearchDoc[] = []
  const { nodes, edges } = data.architecture

  if (include.has('nodes')) {
    for (const n of Object.values(nodes)) {
      const path = typeof n.data.metadata?.path === 'string' ? n.data.metadata.path : undefined
      docs.push({
        id: `node:${n.id}`,
        group: 'Nodes',
        label: n.data.label,
        sublabel: path ?? n.data.technology,
        keywords: compact([n.data.label, n.data.technology, path, n.id, n.type]),
        go: () => handlers.selectNode(n.id),
      })
    }
  }

  if (include.has('edges')) {
    for (const e of Object.values(edges)) {
      const s = nodes[e.source]?.data.label ?? e.source
      const t = nodes[e.target]?.data.label ?? e.target
      docs.push({
        id: `edge:${e.id}`,
        group: 'Edges',
        label: `${s} → ${t}`,
        sublabel: e.type,
        keywords: compact([s, t, e.type, e.id]),
        go: () => handlers.selectEdge(e.id),
      })
    }
  }

  const entries = flatten(data.site?.sidebar ?? [])

  if (include.has('pages')) {
    for (const entry of entries) {
      if (entry.kind === 'page' && entry.page) {
        docs.push({
          id: `page:${entry.id}`,
          group: 'Pages',
          label: entry.label,
          sublabel: entry.page,
          keywords: compact([entry.label, entry.page, entry.id]),
          go: () => handlers.openPage(entry.page as string, entry.node),
        })
      }
    }
  }

  if (include.has('tours')) {
    for (const entry of entries) {
      if (entry.kind === 'tour' && entry.tourId) {
        docs.push({
          id: `tour:${entry.id}`,
          group: 'Tours',
          label: entry.label,
          sublabel: 'Learning tour',
          keywords: compact([entry.label, entry.tourId, entry.id]),
          go: () => handlers.openTour(entry.tourId as string),
        })
      }
    }
  }

  return docs
}

function flatten(entries: NavEntry[]): NavEntry[] {
  const out: NavEntry[] = []
  const walk = (list: NavEntry[]) => {
    for (const e of list) {
      out.push(e)
      if (e.children) walk(e.children)
    }
  }
  walk(entries)
  return out
}

function compact(values: (string | undefined)[]): string[] {
  return values.filter((v): v is string => typeof v === 'string' && v.length > 0)
}
