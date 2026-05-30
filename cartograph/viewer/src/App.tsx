import { useReactFlow } from '@xyflow/react'
import { Compass, Route as RouteIcon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AppHeader } from './components/AppHeader'
import { Canvas } from './components/Canvas'
import { ChangelogView } from './components/ChangelogView'
import { CommandPalette } from './components/CommandPalette'
import { DetailPanel } from './components/DetailPanel'
import { EmptyState } from './components/EmptyState'
import { KeyboardHelp } from './components/KeyboardHelp'
import { MarkdownPage } from './components/MarkdownPage'
import { Sidebar } from './components/Sidebar'
import { SidebarProvider, useSidebar } from './components/ui/leanSidebar'
import { buildSearchIndex } from './lib/searchIndex'
import type { AppRoute, CartographData, DocPage, NavEntry, View } from './lib/types'

export function App({ data }: { data: CartographData }) {
  return (
    <SidebarProvider>
      <Shell data={data} />
    </SidebarProvider>
  )
}

function routeFromHome(home: string, views: View[]): AppRoute {
  const [kind, rest] = splitFirst(home, ':')
  if (kind === 'view' && rest) return { kind: 'view', viewId: rest }
  if (kind === 'page' && rest) return { kind: 'page', page: rest }
  if (kind === 'changelog') return { kind: 'changelog' }
  return { kind: 'view', viewId: views[0]?.id ?? '' }
}

function routeFromEntry(entry: NavEntry): AppRoute | null {
  switch (entry.kind) {
    case 'view':
      return entry.viewId ? { kind: 'view', viewId: entry.viewId } : null
    case 'page':
      return entry.page ? { kind: 'page', page: entry.page, node: entry.node } : null
    case 'changelog':
      return { kind: 'changelog' }
    case 'tour':
      return entry.tourId ? { kind: 'tour', tourId: entry.tourId } : null
    default:
      return null // section/tree/group are branches, not destinations
  }
}

function Shell({ data }: { data: CartographData }) {
  const { architecture: manifest, site } = data
  const views = manifest.views
  const sidebar = useSidebar()
  const { fitView } = useReactFlow()

  const [route, setRoute] = useState<AppRoute>(() => routeFromHome(site.home, views))
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [commandOpen, setCommandOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [dark, setDark] = useState(false)

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : ''
  }, [dark])

  const defaultView = useMemo(
    () => views.find((v) => route.kind === 'view' && v.id === route.viewId) ?? views[0],
    [views, route],
  )
  const currentView = route.kind === 'view' ? views.find((v) => v.id === route.viewId) : undefined
  const panelView = currentView ?? defaultView

  const viewContaining = useCallback(
    (nodeId: string): View | undefined => views.find((v) => v.nodeIds.includes(nodeId)),
    [views],
  )

  const selectNode = useCallback(
    (id: string | null) => {
      setSelectedEdgeId(null)
      setSelectedNodeId(id)
      if (id) {
        const v = viewContaining(id)
        if (v && (route.kind !== 'view' || route.viewId !== v.id)) setRoute({ kind: 'view', viewId: v.id })
      }
    },
    [route, viewContaining],
  )

  const selectEdge = useCallback(
    (id: string) => {
      const e = manifest.edges[id]
      setSelectedNodeId(null)
      setSelectedEdgeId(id)
      const v = e && views.find((vw) => vw.nodeIds.includes(e.source) && vw.nodeIds.includes(e.target))
      if (v) setRoute({ kind: 'view', viewId: v.id })
    },
    [manifest, views],
  )

  const openPage = useCallback((page: string, node?: string) => {
    setRoute({ kind: 'page', page, node })
    if (node) setSelectedNodeId(node)
  }, [])

  const activate = useCallback((entry: NavEntry) => {
    const r = routeFromEntry(entry)
    if (r) setRoute(r)
    if (entry.node) setSelectedNodeId(entry.node)
  }, [])

  const onFit = useCallback(() => fitView({ padding: 0.2, duration: 300 }), [fitView])

  const searchIndex = useMemo(
    () =>
      buildSearchIndex(data, {
        selectNode: (id) => selectNode(id),
        selectEdge: (id) => selectEdge(id),
        openPage: (page, node) => openPage(page, node),
        openTour: (tourId) => setRoute({ kind: 'tour', tourId }),
      }),
    [data, selectNode, selectEdge, openPage],
  )

  // '?' opens the keyboard-help overlay (⌘K and ⌘B are owned by the palette / sidebar provider).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '?' && !isTypingTarget(e.target)) {
        e.preventDefault()
        setHelpOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const selection = selectedNodeId && manifest.nodes[selectedNodeId]
    ? ({ kind: 'node', node: manifest.nodes[selectedNodeId] } as const)
    : selectedEdgeId && manifest.edges[selectedEdgeId]
      ? ({ kind: 'edge', edge: manifest.edges[selectedEdgeId] } as const)
      : null

  const repo = typeof manifest.meta?.repo === 'string' ? (manifest.meta.repo as string) : undefined

  return (
    <div className="flex h-full w-full flex-col" style={{ background: 'var(--canvas)' }}>
      <a href="#main" className="carto-skip">Skip to main</a>
      <AppHeader
        route={route}
        view={currentView}
        manifest={manifest}
        selectedNodeId={selectedNodeId}
        onCrumbNavigate={setRoute}
        onFit={onFit}
        onOpenSearch={() => setCommandOpen(true)}
        onToggleSidebar={sidebar.toggle}
      />
      <div className="flex min-h-0 flex-1">
        <Sidebar
          site={site}
          repo={repo}
          activeRoute={route}
          activeNodeId={selectedNodeId}
          onActivate={activate}
          onOpenSearch={() => setCommandOpen(true)}
          onToggleTheme={() => setDark((d) => !d)}
        />
        <main id="main" className="relative min-w-0 flex-1" style={{ background: 'var(--canvas)' }}>
          <Main
            route={route}
            data={data}
            selectedNodeId={selectedNodeId}
            onSelectNode={selectNode}
            onOpenInArchitecture={(id) => selectNode(id)}
          />
        </main>
        <DetailPanel
          selection={selection}
          manifest={manifest}
          view={panelView}
          onSelectNode={(id) => selectNode(id)}
          onClose={() => {
            setSelectedNodeId(null)
            setSelectedEdgeId(null)
          }}
        />
      </div>
      <CommandPalette index={searchIndex} open={commandOpen} onOpenChange={setCommandOpen} />
      <KeyboardHelp open={helpOpen} onOpenChange={setHelpOpen} />
    </div>
  )
}

function Main({
  route,
  data,
  selectedNodeId,
  onSelectNode,
  onOpenInArchitecture,
}: {
  route: AppRoute
  data: CartographData
  selectedNodeId: string | null
  onSelectNode: (id: string | null) => void
  onOpenInArchitecture: (id: string) => void
}) {
  const { architecture: manifest } = data

  if (route.kind === 'view') {
    const view = manifest.views.find((v) => v.id === route.viewId)
    if (!view) return <EmptyState icon={<Compass />} title="View not found" body={`No view "${route.viewId}".`} />
    return <Canvas view={view} manifest={manifest} selectedNodeId={selectedNodeId} onSelect={onSelectNode} />
  }

  if (route.kind === 'page') {
    const raw = data.pages[route.page]
    const page: DocPage | undefined = raw === undefined ? undefined : typeof raw === 'string' ? { body: raw } : raw
    const sourceUrl = route.node ? manifest.nodes[route.node]?.data.links?.[0]?.url : undefined
    return (
      <div className="h-full overflow-auto p-8">
        <MarkdownPage docRef={route.page} page={page} onOpenInArchitecture={onOpenInArchitecture} sourceUrl={sourceUrl} />
      </div>
    )
  }

  if (route.kind === 'changelog') {
    return (
      <div className="h-full overflow-auto p-8">
        <ChangelogView changelog={data.changelog} />
      </div>
    )
  }

  // tour landing (the player is a later phase)
  return (
    <div className="grid h-full place-items-center p-8">
      <EmptyState
        icon={<RouteIcon />}
        title={`Tour: ${route.tourId}`}
        body="Guided, step-through tours land in a later phase. For now, explore the architecture map and module docs."
      />
    </div>
  )
}

function splitFirst(s: string, sep: string): [string, string] {
  const i = s.indexOf(sep)
  return i < 0 ? [s, ''] : [s.slice(0, i), s.slice(i + 1)]
}

function isTypingTarget(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}
