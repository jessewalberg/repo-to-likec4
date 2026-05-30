import assert from 'node:assert/strict'
import { test } from 'node:test'

import type { Confidence, Group, Manifest, ManifestNode } from '../lib/types.ts'

// DetailPanel.tsx is a render-only JSX module and this repo runs tests under bare
// `node --test` (no React-DOM renderer). Following the NavTree / leanCollapsible
// precedent, the DOM-free decision helpers the panel embeds are mirrored here
// VERBATIM and proven directly; the component keeps them private to honour its
// single-export (`DetailPanel`) contract. Keep the two copies in lockstep.

// (1) confidencePill — the non-alarmist confidence pill (CONTRACT §7). `static`
//     reads as "verified" (calm --n-100), never an alarm. Absent/inferred/unknown
//     map to honest, still-calm labels. Never returns undefined text.
function confidencePill(confidence?: Confidence): { label: string; tone: 'calm' | 'soft' | 'warn' } {
  switch (confidence) {
    case 'static':
      return { label: 'verified', tone: 'calm' }
    case 'inferred':
      return { label: 'inferred', tone: 'soft' }
    case 'unknown':
      return { label: 'unverified', tone: 'warn' }
    default:
      return { label: 'verified', tone: 'calm' }
  }
}

// (2) territoryChip — the disambiguating territory label (CONTRACT §5/§7):
//     `Root — entry-point runners` / `lib — shared modules`. "Root" is the
//     entrypoints territory, NOT the repo root, so the descriptor is mandatory
//     when known. Absent lane -> null (slot collapses, never blank).
const LANE_DESCRIPTOR: Record<string, string> = {
  root: 'entry-point runners',
  lib: 'shared modules',
}
function territoryChip(lane: Group | undefined): { label: string; descriptor: string | null } | null {
  if (!lane) return null
  const descriptor = LANE_DESCRIPTOR[lane.label.toLowerCase()] ?? null
  return { label: lane.label, descriptor }
}

// (3) resolvePath — the mono Path from metadata.path (CONTRACT §7), copy-on-click.
//     Only a string path survives; numeric/absent -> null so nothing renders NaN.
function resolvePath(node: ManifestNode): string | null {
  const p = node.data.metadata?.path
  return typeof p === 'string' && p.trim() ? p.trim() : null
}

// (4) primaryLinkUrl — the doc/source-link guard. Returns the first link with a
//     real url, else null (the Source slot collapses).
function primaryLinkUrl(node: ManifestNode): string | null {
  const link = node.data.links?.find((l) => typeof l.url === 'string' && l.url.trim())
  return link ? link.url : null
}

function fixtureNode(over: Partial<ManifestNode> = {}): ManifestNode {
  return {
    id: 'module:tools/factory/cli.mjs',
    type: 'component',
    parentId: 'lane:root',
    data: {
      label: 'cli.mjs',
      technology: 'JavaScript',
      confidence: 'static',
      metadata: { path: 'tools/factory/cli.mjs' },
      links: [{ label: 'Source', url: 'https://example.com/cli.mjs' }],
      doc: 'pages/modules/tools/factory/cli.md',
    },
    ...over,
  }
}

function fixtureManifest(): Manifest {
  return {
    schemaVersion: 2,
    nodes: { [fixtureNode().id]: fixtureNode() },
    edges: {},
    suppressions: { nodes: [], edges: [] },
    idAliases: {},
    groups: {
      'lane:root': { id: 'lane:root', label: 'Root' },
      'lane:lib': { id: 'lane:lib', label: 'lib' },
    },
    views: [],
  }
}

test('confidencePill: static is the non-alarmist "verified" calm pill', () => {
  assert.deepEqual(confidencePill('static'), { label: 'verified', tone: 'calm' })
})

test('confidencePill: absent confidence defaults to verified (fixture truth: collapse cleanly)', () => {
  assert.equal(confidencePill(undefined).label, 'verified')
  assert.equal(confidencePill(undefined).tone, 'calm')
})

test('confidencePill: unknown is honest but still not an alarm word', () => {
  assert.equal(confidencePill('unknown').label, 'unverified')
  assert.equal(confidencePill('inferred').label, 'inferred')
})

test('territoryChip: Root carries the entrypoints descriptor (NOT the repo root)', () => {
  const m = fixtureManifest()
  const lane = m.groups['lane:root']
  assert.deepEqual(territoryChip(lane), { label: 'Root', descriptor: 'entry-point runners' })
})

test('territoryChip: lib carries the shared-modules descriptor', () => {
  const m = fixtureManifest()
  assert.deepEqual(territoryChip(m.groups['lane:lib']), {
    label: 'lib',
    descriptor: 'shared modules',
  })
})

test('territoryChip: an unknown lane keeps its label but null descriptor (never blank)', () => {
  assert.deepEqual(territoryChip({ id: 'x', label: 'Edge' }), { label: 'Edge', descriptor: null })
})

test('territoryChip: absent lane collapses the slot', () => {
  assert.equal(territoryChip(undefined), null)
})

test('resolvePath: reads metadata.path as mono text', () => {
  assert.equal(resolvePath(fixtureNode()), 'tools/factory/cli.mjs')
})

test('resolvePath: a non-string / absent path collapses (never renders NaN/undefined)', () => {
  const noPath = fixtureNode({ data: { label: 'x', metadata: {} } })
  assert.equal(resolvePath(noPath), null)
  const numericPath = fixtureNode({ data: { label: 'x', metadata: { path: 42 } } })
  assert.equal(resolvePath(numericPath), null)
})

test('primaryLinkUrl: returns the first real Source url', () => {
  assert.equal(primaryLinkUrl(fixtureNode()), 'https://example.com/cli.mjs')
})

test('primaryLinkUrl: no links -> null (Source slot collapses)', () => {
  assert.equal(primaryLinkUrl(fixtureNode({ data: { label: 'x' } })), null)
})
