import type { Manifest, ManifestNode, MergeReport, MergeResult, View, ViewLayoutPos } from './schema.ts'

/**
 * Three-way merge of an architecture.json manifest (ported from spike/phase0, 8/8 proven).
 *
 *   base    = the recon snapshot from the last run (common ancestor; reserved for
 *             future audit / rename-detection — see note below).
 *   fresh   = a freshly-extracted recon (recon-owned content only: machine
 *             provenance, view membership, no positions, no human fields).
 *   current = the on-disk manifest carrying human edits (positions, pins,
 *             relabels, annotations, suppressions, idAliases).
 *
 * Goal: refresh recon-owned facts while NEVER clobbering human edits.
 *
 * Design note: ownership is derived from EXPLICIT per-field `provenance` and an
 * EXPLICIT `suppressions` list rather than from diffing against `base`. That is
 * deliberate — explicit provenance is more robust than inferring intent from a
 * base-vs-current diff, and explicit suppression is the only safe way to record
 * "the human deliberately removed this." `base` is kept in the signature because
 * the data model is three-way and base is useful later (e.g. flagging recon-side
 * field churn for audit), but the merge below does not need it.
 */
export function mergeManifest(base: Manifest, fresh: Manifest, current: Manifest): MergeResult {
  void base // intentionally reserved; see note above
  const report: MergeReport = {
    added: [],
    mutedRemoved: [],
    migrated: [],
    suppressedSkipped: [],
    humanFieldsPreserved: [],
  }

  // 0. Canonicalize `current` through idAliases so it speaks the same ids as fresh.
  const aliases = { ...current.idAliases, ...fresh.idAliases }
  const cur = applyAliases(current, aliases, report)

  const remap = (id: string) => aliases[id] ?? id
  const suppressedNodes = new Set(cur.suppressions.nodes)
  const suppressedEdges = new Set(cur.suppressions.edges)

  // 1. Nodes.
  const mergedNodes: Record<string, ManifestNode> = {}

  for (const [id, fn] of Object.entries(fresh.nodes)) {
    if (suppressedNodes.has(id)) {
      report.suppressedSkipped.push(id)
      continue
    }
    const cn = cur.nodes[id]
    if (cn) {
      mergedNodes[id] = mergeNode(cn, fn, report)
    } else {
      mergedNodes[id] = { ...fn, data: { ...fn.data, confidence: 'static' } }
      report.added.push(id)
    }
  }

  for (const [id, cn] of Object.entries(cur.nodes)) {
    if (mergedNodes[id] || suppressedNodes.has(id)) continue
    if (cn.origin === 'human') {
      mergedNodes[id] = cn // human-authored node recon never produced — keep untouched
    } else {
      mergedNodes[id] = { ...cn, data: { ...cn.data, confidence: 'unknown' } } // recon no longer sees it → mute, never delete
      report.mutedRemoved.push(id)
    }
  }

  // 2. Edges (recon-owned; suppression honored; removed machine edges muted not deleted).
  const mergedEdges: Manifest['edges'] = {}
  for (const [id, fe] of Object.entries(fresh.edges)) {
    if (suppressedEdges.has(id)) {
      report.suppressedSkipped.push(id)
      continue
    }
    mergedEdges[id] = { ...fe, confidence: 'static' }
  }
  for (const [id, ce] of Object.entries(cur.edges)) {
    if (mergedEdges[id] || suppressedEdges.has(id)) continue
    mergedEdges[id] = ce.origin === 'human' ? ce : { ...ce, confidence: 'unknown' }
  }

  // 3. Views — recon owns membership; current owns positions; new nodes need layout.
  const nodesNeedingLayout = new Set<string>()
  const curViewsById = new Map(cur.views.map((v) => [v.id, v]))
  const mergedViews: View[] = []

  for (const fv of fresh.views) {
    const cv = curViewsById.get(fv.id)
    const layout: Record<string, ViewLayoutPos> = {}
    const nodeIds: string[] = []
    const seen = new Set<string>()

    const addToView = (rawId: string) => {
      const id = remap(rawId)
      if (seen.has(id) || suppressedNodes.has(id) || !mergedNodes[id]) return
      seen.add(id)
      nodeIds.push(id)
      const pos = cv?.layout[id]
      if (pos) layout[id] = pos
      else if (!mergedNodes[id].data.pinned) nodesNeedingLayout.add(id)
    }

    for (const id of fv.nodeIds) addToView(id)
    // retain human-authored + muted-removed nodes that the human kept in this view
    if (cv) {
      for (const id of cv.nodeIds) {
        const n = mergedNodes[id]
        if (n && (n.origin === 'human' || n.data.confidence === 'unknown')) addToView(id)
      }
      // carry forward frozen container/lane positions (layout keys that aren't node ids)
      for (const [k, pos] of Object.entries(cv.layout)) {
        if (!(k in layout) && !mergedNodes[k] && !(k in fresh.nodes)) layout[k] = pos
      }
    }
    mergedViews.push({ ...fv, nodeIds, layout })
  }
  // keep human-created views that recon doesn't know about
  const freshViewIds = new Set(fresh.views.map((v) => v.id))
  for (const cv of cur.views) if (!freshViewIds.has(cv.id)) mergedViews.push(cv)

  const manifest: Manifest = {
    schemaVersion: fresh.schemaVersion,
    meta: fresh.meta ?? current.meta,
    nodes: mergedNodes,
    edges: mergedEdges,
    suppressions: cur.suppressions,
    idAliases: aliases,
    groups: fresh.groups ?? current.groups,
    views: mergedViews,
  }

  return { manifest, report, nodesNeedingLayout: [...nodesNeedingLayout] }
}

/** Merge one current (human) node with its fresh (recon) counterpart. */
function mergeNode(cn: ManifestNode, fn: ManifestNode, report: MergeReport): ManifestNode {
  const prov = cn.data.provenance ?? {}
  const data: ManifestNode['data'] = { ...fn.data } // recon-owned facts (label, metadata, technology, links, icon…)
  const preserved: string[] = []

  for (const field of Object.keys(prov)) {
    if (prov[field] === 'human' && field in cn.data) {
      ;(data as Record<string, unknown>)[field] = (cn.data as Record<string, unknown>)[field]
      preserved.push(field)
    }
  }

  data.provenance = prov
  if (cn.data.pinned !== undefined) data.pinned = cn.data.pinned
  if (cn.data.annotation !== undefined && prov.annotation === 'human') data.annotation = cn.data.annotation
  // Prose (summary/description) is LLM-authored, never recon-authored — so carry
  // the current value forward whenever the fresh recon node lacks one. Otherwise a
  // plain (non-refine) re-run would silently drop view-refine's summaries/docs.
  if (fn.data.summary === undefined && cn.data.summary !== undefined) data.summary = cn.data.summary
  if (fn.data.description === undefined && cn.data.description !== undefined) data.description = cn.data.description
  data.confidence = 'static' // recon sees it now

  if (preserved.length) report.humanFieldsPreserved.push({ id: cn.id, fields: preserved })

  return { ...fn, id: cn.id, data, origin: cn.origin ?? fn.origin }
}

/** Rewrite a manifest's ids through `aliases` (oldId -> newId): nodes, edge endpoints, view layout keys, suppressions. */
function applyAliases(manifest: Manifest, aliases: Record<string, string>, report: MergeReport): Manifest {
  if (Object.keys(aliases).length === 0) return manifest
  const remap = (id: string) => aliases[id] ?? id

  const nodes: Record<string, ManifestNode> = {}
  for (const [id, n] of Object.entries(manifest.nodes)) {
    const nid = remap(id)
    if (nid !== id) report.migrated.push({ from: id, to: nid })
    nodes[nid] = { ...n, id: nid }
  }

  const edges: Manifest['edges'] = {}
  for (const [id, e] of Object.entries(manifest.edges)) {
    edges[id] = { ...e, source: remap(e.source), target: remap(e.target) }
  }

  const views = manifest.views.map((v) => ({
    ...v,
    nodeIds: v.nodeIds.map(remap),
    layout: Object.fromEntries(Object.entries(v.layout).map(([k, pos]) => [remap(k), pos])),
  }))

  const suppressions = {
    nodes: manifest.suppressions.nodes.map(remap),
    edges: manifest.suppressions.edges.map(remap),
  }

  return { ...manifest, nodes, edges, views, suppressions }
}
