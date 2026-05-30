import type { Manifest, Tour, TourStep, Tours } from './schema.ts'

// Build the three role tours (understand / fix-bug / add-feature) DETERMINISTICALLY
// from the graph — grounded steps (entry points, hubs, areas) with prose derived
// from labels + degree, no LLM. The viewer's TourPlayer focuses each step's node
// via the normal selection machinery. (LLM-authored tour prose can layer on later;
// these are the structural defaults so Learning is never empty.)

interface Degree {
  id: string
  label: string
  inCount: number
  outCount: number
}

const isModule = (type: string) => type !== 'container'

function degrees(manifest: Manifest): Map<string, Degree> {
  const d = new Map<string, Degree>()
  for (const n of Object.values(manifest.nodes)) {
    if (!isModule(n.type)) continue
    d.set(n.id, { id: n.id, label: n.data.label, inCount: 0, outCount: 0 })
  }
  for (const e of Object.values(manifest.edges)) {
    const s = d.get(e.source)
    const t = d.get(e.target)
    if (s) s.outCount++
    if (t) t.inCount++
  }
  return d
}

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`

function understandTour(manifest: Manifest, deg: Map<string, Degree>): Tour {
  const mods = [...deg.values()]
  const areas = Object.keys(manifest.groups).length || 1
  const entrypoints = mods.filter((m) => m.inCount === 0 && m.outCount > 0).sort((a, b) => b.outCount - a.outCount).slice(0, 3)
  const hubs = mods.filter((m) => !entrypoints.includes(m)).sort((a, b) => b.inCount + b.outCount - (a.inCount + a.outCount)).slice(0, 3)

  const steps: TourStep[] = [
    {
      title: 'Understand the system',
      body: `This map covers ${plural(mods.length, 'module')} across ${plural(areas, 'area')}. We'll start at the entry points, then visit the busiest hubs.`,
    },
  ]
  for (const m of entrypoints) {
    steps.push({ nodeId: m.id, title: `Entry point: ${m.label}`, body: `${m.label} is a starting point — nothing imports it, and it pulls in ${plural(m.outCount, 'module')}.` })
  }
  for (const m of hubs) {
    if (m.inCount + m.outCount === 0) continue
    steps.push({ nodeId: m.id, title: `Hub: ${m.label}`, body: `${m.label} is central — ${plural(m.inCount, 'module')} import it and it imports ${plural(m.outCount, 'module')}.` })
  }
  return { id: 'understand', title: 'Understand the system', steps }
}

function fixBugTour(manifest: Manifest, deg: Map<string, Degree>): Tour {
  const mods = [...deg.values()]
  const hub = [...mods].sort((a, b) => b.inCount + b.outCount - (a.inCount + a.outCount))[0]
  const steps: TourStep[] = [
    { title: 'Fix a bug', body: 'Start from where the behaviour lives, then follow its imports toward the cause.' },
  ]
  if (hub) {
    steps.push({ nodeId: hub.id, title: `Likely touchpoint: ${hub.label}`, body: `${hub.label} is the most-connected module, so a change here ripples widely — a good place to start tracing.` })
    const importsOfHub = Object.values(manifest.edges)
      .filter((e) => e.source === hub.id && deg.has(e.target))
      .map((e) => deg.get(e.target)!)
      .slice(0, 3)
    for (const dep of importsOfHub) {
      steps.push({ nodeId: dep.id, title: `It depends on ${dep.label}`, body: `${hub.label} imports ${dep.label} — check here if the bug is in shared behaviour.` })
    }
  }
  return { id: 'fix-bug', title: 'Fix a bug', steps }
}

function addFeatureTour(manifest: Manifest, deg: Map<string, Degree>): Tour {
  const steps: TourStep[] = [
    { title: 'Add a feature', body: "Find the right area to extend — each area below groups related modules." },
  ]
  const containers = Object.values(manifest.nodes).filter((n) => n.type === 'container')
  if (containers.length > 0) {
    for (const c of containers) {
      const count = typeof c.data.metadata?.modules === 'number' ? c.data.metadata.modules : undefined
      steps.push({ nodeId: c.id, title: `Area: ${c.data.label}`, body: count !== undefined ? `${c.data.label} holds ${plural(count, 'module')}. New code that fits this area lives here.` : `${c.data.label} groups related modules.` })
    }
  } else {
    // No container ladder (single-area repo): point at a representative leaf.
    const leaf = [...deg.values()].sort((a, b) => a.inCount + a.outCount - (b.inCount + b.outCount))[0]
    if (leaf) steps.push({ nodeId: leaf.id, title: `A small module: ${leaf.label}`, body: `${leaf.label} is lightly connected — a low-risk place to add or model a new piece.` })
  }
  return { id: 'add-feature', title: 'Add a feature', steps }
}

export function buildTours(manifest: Manifest): Tours {
  const deg = degrees(manifest)
  return {
    schemaVersion: 1,
    tours: [understandTour(manifest, deg), fixBugTour(manifest, deg), addFeatureTour(manifest, deg)],
  }
}
