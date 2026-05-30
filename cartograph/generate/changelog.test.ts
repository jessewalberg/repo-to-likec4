import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { MergeReport } from './schema.ts'
import { type Changelog, appendChangelog, emptyChangelog, isEmptyReport } from './changelog.ts'

function report(over: Partial<MergeReport> = {}): MergeReport {
  return { added: [], mutedRemoved: [], migrated: [], suppressedSkipped: [], humanFieldsPreserved: [], ...over }
}

test('appendChangelog: builds an entry from the merge report and prepends it (newest first)', () => {
  const prev: Changelog = {
    schemaVersion: 1,
    entries: [{ ref: 'v1', timestamp: '2026-01-01T00:00:00Z', added: ['a'], removed: [], migrated: [], suppressedSkipped: [] }],
  }
  const next = appendChangelog(prev, report({ added: ['b', 'c'], mutedRemoved: ['old'], migrated: [{ from: 'x', to: 'y' }] }), {
    ref: 'v2',
    timestamp: '2026-02-02T00:00:00Z',
  })

  assert.equal(next.entries.length, 2, 'entry appended')
  assert.equal(next.entries[0].ref, 'v2', 'newest first')
  assert.deepEqual(next.entries[0].added, ['b', 'c'])
  assert.deepEqual(next.entries[0].removed, ['old'], 'mutedRemoved surfaces as removed')
  assert.deepEqual(next.entries[0].migrated, [{ from: 'x', to: 'y' }])
  assert.equal(next.entries[1].ref, 'v1', 'old entry retained below')
})

test('isEmptyReport / appendChangelog: a no-op merge does not create a changelog entry', () => {
  assert.equal(isEmptyReport(report()), true, 'all-empty report is a no-op')
  assert.equal(isEmptyReport(report({ humanFieldsPreserved: [{ id: 'n', fields: ['label'] }] })), true, 'preserve-only is still a no-op for the feed')
  const next = appendChangelog(emptyChangelog(), report(), { ref: 'v1', timestamp: 't' })
  assert.deepEqual(next.entries, [], 'no entry added for a no-op run')
})
