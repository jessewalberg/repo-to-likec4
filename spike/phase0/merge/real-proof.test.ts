import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cpSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { reconDir } from './recon.ts'
import { detectRenames } from './rename-detect.ts'
import { mergeManifest } from './merge.ts'
import type { Manifest } from './types.ts'

// The red-team's gating requirement: prove the merge survives REAL id churn, not a
// fake recon. We recon software-factory's real tools/factory module graph, perform a
// real file MOVE (lib/dag.mjs -> lib/graph/dag.mjs) and a real module SPLIT
// (lib/policy.mjs -> + lib/policy-rules.mjs) on a copy, run rename detection, and
// merge human edits made before the refactor.

const SF_TOOLS = '/Volumes/home-ext/projects/software-factory/tools/factory'
const TMP = join(import.meta.dirname, '.tmp-sf')
const TMP_TOOLS = join(TMP, 'tools/factory')

function rewrite(file: string, replacements: [string, string][]): void {
  let s = readFileSync(file, 'utf8')
  for (const [a, b] of replacements) s = s.split(a).join(b)
  writeFileSync(file, s)
}

test('REAL repo proof: recon + real file-move + module-split + rename-detect + merge — human edits survive id churn', () => {
  if (!existsSync(SF_TOOLS)) {
    assert.fail(`software-factory testbed not found at ${SF_TOOLS}`)
  }

  // --- t0: recon the REAL current files ---
  const t0 = reconDir(SF_TOOLS, 'tools/factory')
  const dagOld = 'module:tools/factory/lib/dag.mjs'
  const policy = 'module:tools/factory/lib/policy.mjs'
  assert.ok(t0.nodes[dagOld], 'recon found lib/dag.mjs')
  assert.ok(t0.nodes[policy], 'recon found lib/policy.mjs')

  // --- build a refactored copy ---
  rmSync(TMP, { recursive: true, force: true })
  mkdirSync(TMP_TOOLS, { recursive: true })
  cpSync(SF_TOOLS, TMP_TOOLS, { recursive: true })

  // refactor 1 — FILE MOVE: lib/dag.mjs -> lib/graph/dag.mjs (+ fix importers)
  mkdirSync(join(TMP_TOOLS, 'lib/graph'), { recursive: true })
  renameSync(join(TMP_TOOLS, 'lib/dag.mjs'), join(TMP_TOOLS, 'lib/graph/dag.mjs'))
  rewrite(join(TMP_TOOLS, 'lib/graph/dag.mjs'), [['from "./', 'from "../']]) // fix dag's own local imports, if any
  rewrite(join(TMP_TOOLS, 'lib/schema.mjs'), [['from "./dag.mjs"', 'from "./graph/dag.mjs"']])
  rewrite(join(TMP_TOOLS, 'child-issues-run.mjs'), [['from "./lib/dag.mjs"', 'from "./lib/graph/dag.mjs"']])
  rewrite(join(TMP_TOOLS, 'epic-coordinator-run.mjs'), [['from "./lib/dag.mjs"', 'from "./lib/graph/dag.mjs"']])

  // refactor 2 — MODULE SPLIT: extract part of lib/policy.mjs into lib/policy-rules.mjs
  writeFileSync(
    join(TMP_TOOLS, 'lib/policy-rules.mjs'),
    'import { matchesAnyGlob } from "./glob.mjs";\nexport function evaluatePullRequest() {}\n',
  )
  rewrite(join(TMP_TOOLS, 'policy-gate-run.mjs'), [['from "./lib/policy.mjs"', 'from "./lib/policy-rules.mjs"']])

  // --- t1: recon the refactored copy ---
  const t1 = reconDir(TMP_TOOLS, 'tools/factory')
  const dagNew = 'module:tools/factory/lib/graph/dag.mjs'
  const policyRules = 'module:tools/factory/lib/policy-rules.mjs'
  assert.ok(t1.nodes[dagNew], 'recon found moved dag at lib/graph/dag.mjs')
  assert.ok(t1.nodes[policyRules], 'recon found new split module policy-rules.mjs')
  assert.equal(t1.nodes[dagOld], undefined, 'old dag id is gone in t1')

  // --- rename detection (the risky step) ---
  const aliases = detectRenames(t0, t1)
  assert.deepEqual(
    aliases,
    { [dagOld]: dagNew },
    'rename detection maps the moved dag old->new AND does not alias the genuinely-new policy-rules',
  )

  // --- human edits made on the pre-refactor manifest ---
  const current: Manifest = structuredClone(t0)
  current.nodes[dagOld].data.label = 'DAG utilities'
  current.nodes[dagOld].data.annotation = 'core topological sort + ready-set'
  current.nodes[dagOld].data.pinned = true
  current.nodes[dagOld].data.provenance = { label: 'human', annotation: 'human' }
  current.views[0].layout[dagOld] = { x: 42, y: 42 }
  const suppressedEdge = 'imports:module:tools/factory/cli.mjs->module:tools/factory/lib/policy.mjs'
  assert.ok(t0.edges[suppressedEdge], 'the edge we will suppress exists in t0 recon')
  assert.ok(t1.edges[suppressedEdge], 'and recon rediscovers it in t1 (cli still imports policy)')
  current.suppressions.edges.push(suppressedEdge)

  // --- merge: base=t0, fresh=t1(+detected aliases), current=human-edited t0 ---
  const fresh: Manifest = { ...t1, idAliases: aliases }
  const { manifest, report, nodesNeedingLayout } = mergeManifest(t0, fresh, current)

  // human edits migrated to the NEW dag id across the file move
  assert.equal(manifest.nodes[dagNew].data.label, 'DAG utilities', 'human label migrated across the move')
  assert.equal(manifest.nodes[dagNew].data.pinned, true, 'pin migrated')
  assert.equal(manifest.nodes[dagNew].data.annotation, 'core topological sort + ready-set', 'annotation migrated')
  assert.deepEqual(manifest.views[0].layout[dagNew], { x: 42, y: 42 }, 'pinned position migrated to the new id')
  assert.equal(manifest.nodes[dagOld], undefined, 'old dag id removed from the merged manifest')
  assert.ok(report.migrated.some((m) => m.from === dagOld && m.to === dagNew), 'migration is reported')

  // the split: new module added and flagged as needing layout
  assert.ok(manifest.nodes[policyRules], 'split module present after merge')
  assert.ok(report.added.includes(policyRules), 'split module reported as added')
  assert.ok(nodesNeedingLayout.includes(policyRules), 'split module needs layout')

  // semantic suppression held across a real recon
  assert.equal(manifest.edges[suppressedEdge], undefined, 'human-suppressed edge stayed gone despite recon rediscovering it')

  rmSync(TMP, { recursive: true, force: true })
})
