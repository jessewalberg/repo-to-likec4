import type { Manifest } from './schema.ts'

export interface ValidationResult {
  ok: boolean
  errors: string[]
}

/**
 * Deterministic self-check gates (from the gen-pipeline research): no orphan edges,
 * every node carries a source link and a doc ref, every view id resolves. (Bounding-
 * box overlap is checked after the layout stage, not here.)
 */
export function validate(manifest: Manifest): ValidationResult {
  const errors: string[] = []
  const nodeIds = new Set(Object.keys(manifest.nodes))

  for (const e of Object.values(manifest.edges)) {
    if (!nodeIds.has(e.source)) errors.push(`edge ${e.id}: dangling source ${e.source}`)
    if (!nodeIds.has(e.target)) errors.push(`edge ${e.id}: dangling target ${e.target}`)
  }

  for (const n of Object.values(manifest.nodes)) {
    const where = `node ${n.data.label} (${n.id})`
    if (!n.data.links || n.data.links.length === 0) errors.push(`${where}: missing source link`)
    if (!n.data.doc) errors.push(`${where}: missing doc ref`)
  }

  for (const v of manifest.views) {
    for (const id of v.nodeIds) {
      if (!nodeIds.has(id)) errors.push(`view ${v.id}: unknown node ${id}`)
    }
  }

  return { ok: errors.length === 0, errors }
}
