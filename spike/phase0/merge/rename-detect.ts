import type { Manifest } from './types.ts'

// Rename/move detection between two recon snapshots, by edge-neighborhood
// similarity + filename-stem match. Emits idAliases (oldId -> newId).
//
// This is the step the red-team flagged as the highest real-world risk: a false
// positive silently moves a human's edits onto the wrong node; a false negative
// orphans them. The proof exercises it on a real file move while a genuinely-new
// split module must NOT be matched.

function neighborhood(id: string, man: Manifest): Set<string> {
  const s = new Set<string>()
  for (const e of Object.values(man.edges)) {
    if (e.source === id) s.add(`out:${e.target}`)
    if (e.target === id) s.add(`in:${e.source}`)
  }
  return s
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0
  let inter = 0
  for (const x of a) if (b.has(x)) inter++
  const uni = a.size + b.size - inter
  return uni === 0 ? 0 : inter / uni
}

function stem(id: string): string {
  return id.split('/').pop() ?? id
}

export interface RenameMatch {
  from: string
  to: string
  score: number
  stemMatch: boolean
  neighborhoodJaccard: number
}

export function detectRenamesDetailed(t0: Manifest, t1: Manifest, threshold = 0.5): RenameMatch[] {
  const disappeared = Object.keys(t0.nodes).filter((id) => !t1.nodes[id])
  const appeared = Object.keys(t1.nodes).filter((id) => !t0.nodes[id])
  const matches: RenameMatch[] = []
  const usedNew = new Set<string>()

  for (const d of disappeared) {
    let best: RenameMatch | null = null
    for (const a of appeared) {
      if (usedNew.has(a)) continue
      const j = jaccard(neighborhood(d, t0), neighborhood(a, t1))
      const stemMatch = stem(d) === stem(a)
      const score = j + (stemMatch ? 0.5 : 0)
      if (!best || score > best.score) best = { from: d, to: a, score, stemMatch, neighborhoodJaccard: j }
    }
    if (best && best.score >= threshold) {
      matches.push(best)
      usedNew.add(best.to)
    }
  }
  return matches
}

export function detectRenames(t0: Manifest, t1: Manifest, threshold = 0.5): Record<string, string> {
  return Object.fromEntries(detectRenamesDetailed(t0, t1, threshold).map((m) => [m.from, m.to]))
}
