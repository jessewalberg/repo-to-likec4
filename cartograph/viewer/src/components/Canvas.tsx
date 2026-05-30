import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from "@xyflow/react"
import { edgeTypes, nodeTypes } from "./flowTypes"
import { manifestToFlow } from "../lib/manifestToFlow"
import { neighborsOf } from "../lib/graph"
import { useReducedMotion } from "../lib/useReducedMotion"
import type {
  CardNodeData,
  CartoEdge,
  CartoNode,
  KindKey,
  Manifest,
  View,
} from "../lib/types"

interface CanvasProps {
  view: View
  manifest: Manifest
  selectedNodeId: string | null
  onSelect: (id: string | null) => void
}

// CONTRACT §3/§6/§9/§12 — the React Flow canvas. Read-only (no drag/connect),
// keyboard-first (roving tabindex), with the neighbour-highlight fan driven into
// node/edge `data` flags. All visuals come from the --xy-* tokens + scoped css.

const KIND_STRIPE: Record<KindKey, string> = {
  service: "var(--service-stripe)",
  frontend: "var(--frontend-stripe)",
  datastore: "var(--datastore-stripe)",
  infra: "var(--infra-stripe)",
  external: "var(--external-stripe)",
  queue: "var(--queue-stripe)",
}

const FIT_VIEW_OPTIONS = { padding: 0.2 } as const

/** MiniMap dot colour by node kind; lanes read transparent (field, not card). */
function miniMapNodeColor(node: { type?: string; data?: Record<string, unknown> }): string {
  if (node.type !== "card") return "transparent"
  const kind = (node.data?.kind as KindKey | undefined) ?? "external"
  return KIND_STRIPE[kind] ?? KIND_STRIPE.external
}

/** Type guard: a card node (carries CardNodeData). Lanes are skipped by keyboard nav. */
function isCard(n: CartoNode): n is CartoNode & { data: CardNodeData } {
  return n.type === "card"
}

export function Canvas({ view, manifest, selectedNodeId, onSelect }: CanvasProps): React.ReactElement {
  const reduced = useReducedMotion()
  const { fitView } = useReactFlow()

  // Build initial graph once per view (manifestToFlow is pure; cheap to memoise).
  const initial = useMemo(() => manifestToFlow(view, manifest), [view, manifest])

  const [nodes, setNodes, onNodesChange] = useNodesState<CartoNode>(initial.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState<CartoEdge>(initial.edges)

  // Hovered node drives the same fan as selection (focus delegates to selection).
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  // Roving tabindex: which card currently owns keyboard focus.
  const [focusId, setFocusId] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState("")

  const wrapRef = useRef<HTMLDivElement | null>(null)
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Card nodes in view order — the keyboard model walks this list.
  const cards = useMemo(() => initial.nodes.filter(isCard), [initial.nodes])

  // Lane (parentId) → ordered card ids, for j/k within-lane + Tab across-lanes.
  const lanes = useMemo(() => {
    const order: string[] = []
    const byLane = new Map<string, string[]>()
    for (const c of cards) {
      const lane = c.parentId ?? "__none__"
      if (!byLane.has(lane)) {
        byLane.set(lane, [])
        order.push(lane)
      }
      byLane.get(lane)!.push(c.id)
    }
    return { order, byLane }
  }, [cards])

  // Rebuild graph when the active view changes (e.g. switching views in App).
  useEffect(() => {
    setNodes(initial.nodes)
    setEdges(initial.edges)
    setHoveredId(null)
    setFocusId(initial.nodes.find(isCard)?.id ?? null)
  }, [initial, setNodes, setEdges])

  // The node whose neighbours stay lit: selection wins, else hover.
  const activeId = selectedNodeId ?? hoveredId

  // Neighbour set of the active node (null when nothing active → no dimming).
  const neighbors = useMemo(
    () => (activeId ? neighborsOf(manifest, activeId) : null),
    [activeId, manifest],
  )

  // --- Reflect selection + neighbour-fan into node/edge data (§3/§12) --------
  // Information-bearing state changes happen instantly regardless of motion; the
  // timing/easing is handled by CSS transitions which the reduced-motion media
  // query already neutralises. We only gate the 60ms hover intent delay via JS.
  useEffect(() => {
    setNodes((prev) =>
      prev.map((n) => {
        if (n.type !== "card") return n
        const selected = n.id === selectedNodeId
        const dimmed =
          activeId != null &&
          n.id !== activeId &&
          !(neighbors?.has(n.id) ?? false) &&
          n.data.pinned !== true
        if (n.selected === selected && n.data.dimmed === dimmed) return n
        return { ...n, selected, data: { ...n.data, dimmed } }
      }),
    )
  }, [selectedNodeId, activeId, neighbors, setNodes])

  useEffect(() => {
    setEdges((prev) =>
      prev.map((e) => {
        const incident = activeId != null && (e.source === activeId || e.target === activeId)
        const dimmed = activeId != null && !incident
        if (e.data?.incident === incident && e.data?.dimmed === dimmed) return e
        return { ...e, selected: incident, data: { ...e.data, incident, dimmed } } as CartoEdge
      }),
    )
  }, [activeId, setEdges])

  // --- aria-live announcement for selection ---------------------------------
  useEffect(() => {
    if (!selectedNodeId) {
      setAnnouncement("Selection cleared")
      return
    }
    const n = manifest.nodes[selectedNodeId]
    if (!n) return
    const lane = n.parentId ? manifest.groups[n.parentId]?.label : undefined
    const count = neighbors?.size ?? 0
    setAnnouncement(
      `Selected ${n.data.label}${lane ? `, in ${lane} lane` : ""}, ${count} connection${count === 1 ? "" : "s"}`,
    )
  }, [selectedNodeId, manifest, neighbors])

  // --- hover with 60ms intent delay (§12) -----------------------------------
  const clearHoverTimer = () => {
    if (hoverTimer.current) {
      clearTimeout(hoverTimer.current)
      hoverTimer.current = null
    }
  }

  const onNodeMouseEnter = useCallback(
    (_e: React.MouseEvent, node: CartoNode) => {
      if (node.type !== "card") return
      clearHoverTimer()
      const set = () => setHoveredId(node.id)
      if (reduced) set()
      else hoverTimer.current = setTimeout(set, 60)
    },
    [reduced],
  )

  const onNodeMouseLeave = useCallback(() => {
    clearHoverTimer()
    setHoveredId(null)
  }, [])

  useEffect(() => clearHoverTimer, [])

  // --- selection via click (ignore lane clicks) -----------------------------
  const onNodeClick = useCallback(
    (_e: React.MouseEvent, node: CartoNode) => {
      if (node.type !== "card") return // lanes are not selectable
      setFocusId(node.id)
      onSelect(node.id)
    },
    [onSelect],
  )

  // Clicking empty canvas clears selection.
  const onPaneClick = useCallback(() => onSelect(null), [onSelect])

  // --- roving-tabindex keyboard model (§9) ----------------------------------
  const focusCardDom = useCallback((id: string) => {
    const el = wrapRef.current?.querySelector<HTMLElement>(`.react-flow__node[data-id="${id}"]`)
    el?.focus()
  }, [])

  const moveWithinLane = useCallback(
    (delta: number) => {
      if (cards.length === 0) return
      const current = focusId ?? cards[0].id
      const lane = manifest.nodes[current]?.parentId ?? "__none__"
      const ids = lanes.byLane.get(lane) ?? cards.map((c) => c.id)
      const idx = ids.indexOf(current)
      const next = ids[Math.min(Math.max(idx + delta, 0), ids.length - 1)] ?? current
      setFocusId(next)
      focusCardDom(next)
    },
    [cards, focusId, lanes, manifest, focusCardDom],
  )

  const moveAcrossLanes = useCallback(
    (delta: number) => {
      if (cards.length === 0 || lanes.order.length === 0) return
      const current = focusId ?? cards[0].id
      const lane = manifest.nodes[current]?.parentId ?? "__none__"
      const laneIdx = lanes.order.indexOf(lane)
      const nextLane =
        lanes.order[(laneIdx + delta + lanes.order.length) % lanes.order.length] ?? lane
      // Keep the same row position within the destination lane when possible.
      const fromIds = lanes.byLane.get(lane) ?? []
      const pos = Math.max(0, fromIds.indexOf(current))
      const toIds = lanes.byLane.get(nextLane) ?? []
      const next = toIds[Math.min(pos, toIds.length - 1)] ?? toIds[0]
      if (!next) return
      setFocusId(next)
      focusCardDom(next)
    },
    [cards, focusId, lanes, manifest, focusCardDom],
  )

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Don't hijack typing in inputs (palette/search live elsewhere).
      const t = e.target as HTMLElement
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable) return
      if (cards.length === 0) return

      const current = focusId ?? cards[0].id
      switch (e.key) {
        case "j":
        case "ArrowDown":
          e.preventDefault()
          moveWithinLane(1)
          break
        case "k":
        case "ArrowUp":
          e.preventDefault()
          moveWithinLane(-1)
          break
        case "Tab":
          // Tab/Shift-Tab move ACROSS lanes within the canvas (§9).
          e.preventDefault()
          moveAcrossLanes(e.shiftKey ? -1 : 1)
          break
        case "Enter":
          e.preventDefault()
          onSelect(current)
          break
        case "o": {
          // Open the node's Source link in a new tab.
          e.preventDefault()
          const url = manifest.nodes[current]?.data.links?.[0]?.url
          if (url) window.open(url, "_blank", "noopener,noreferrer")
          break
        }
        case "F":
        case "f":
          e.preventDefault()
          fitView({ ...FIT_VIEW_OPTIONS, duration: reduced ? 0 : 300 })
          break
        case "Escape":
          e.preventDefault()
          onSelect(null)
          break
        default:
          break
      }
    },
    [cards, focusId, moveWithinLane, moveAcrossLanes, onSelect, manifest, fitView, reduced],
  )

  // Keep a valid roving anchor: default tabindex owner to the first card.
  useEffect(() => {
    if (!focusId && cards.length > 0) setFocusId(cards[0].id)
  }, [focusId, cards])

  // Empty view: render the field with no nodes, never crash (spec: "Never crash
  // on empty view"). manifestToFlow already returns [] for an empty/absent view.
  const hasNodes = nodes.length > 0

  return (
    <div
      ref={wrapRef}
      className="carto-canvas__root"
      role="application"
      aria-label={`Architecture map: ${view?.title ?? "view"}`}
      aria-roledescription="interactive architecture diagram"
      onKeyDown={onKeyDown}
    >
      <ReactFlow<CartoNode, CartoEdge>
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={onNodeClick}
        onNodeMouseEnter={onNodeMouseEnter}
        onNodeMouseLeave={onNodeMouseLeave}
        onPaneClick={onPaneClick}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        fitView
        fitViewOptions={FIT_VIEW_OPTIONS}
        colorMode="light"
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={20} />
        <Controls showInteractive={false} />
        <MiniMap
          pannable
          zoomable
          nodeColor={miniMapNodeColor}
          ariaLabel="Minimap of the architecture"
        />
      </ReactFlow>

      {!hasNodes && (
        <div className="carto-canvas__empty" role="status">
          <p className="carto-canvas__empty-title">Empty view</p>
          <p className="carto-canvas__empty-body">This view has no nodes to map yet.</p>
        </div>
      )}

      {/* Polite live region announcing selection + neighbour-fan (§9). */}
      <div className="carto-canvas__sr" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
    </div>
  )
}
