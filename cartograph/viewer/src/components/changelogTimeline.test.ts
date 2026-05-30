import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { ChangelogEntry } from '../lib/types.ts'
import {
  changeSummary,
  formatTimestamp,
  groupByTimestamp,
  toTimelineEntry,
} from './changelogTimeline.ts'

function entry(over: Partial<ChangelogEntry>): ChangelogEntry {
  return {
    timestamp: '2026-05-30T12:00:00Z',
    added: [],
    removed: [],
    migrated: [],
    suppressedSkipped: [],
    ...over,
  }
}

test('toTimelineEntry: trims ids and drops blanks (never an empty row)', () => {
  const e = toTimelineEntry(
    entry({ added: ['  a.mjs ', '', '   '], removed: ['b.mjs'] }),
  )
  assert.deepEqual(e.added, ['a.mjs'])
  assert.deepEqual(e.removed, ['b.mjs'])
})

test('toTimelineEntry: drops migrations missing an endpoint (no half rows)', () => {
  const e = toTimelineEntry(
    entry({
      migrated: [
        { from: 'old.mjs', to: 'new.mjs' },
        { from: 'x.mjs', to: '   ' },
        { from: '', to: 'y.mjs' },
      ],
    }),
  )
  assert.deepEqual(e.migrated, [{ from: 'old.mjs', to: 'new.mjs' }])
})

test('toTimelineEntry: changeCount sums all real rows across kinds', () => {
  const e = toTimelineEntry(
    entry({
      added: ['a', 'b'],
      removed: ['c'],
      migrated: [{ from: 'x', to: 'y' }],
      suppressedSkipped: ['s'],
    }),
  )
  assert.equal(e.changeCount, 5)
})

test('toTimelineEntry: keeps a real ref, drops a blank one', () => {
  assert.equal(toTimelineEntry(entry({ ref: ' abc123 ' })).ref, 'abc123')
  assert.equal(toTimelineEntry(entry({ ref: '   ' })).ref, undefined)
  assert.equal(toTimelineEntry(entry({ ref: undefined })).ref, undefined)
})

test('groupByTimestamp: groups entries sharing a timestamp, stable order', () => {
  const groups = groupByTimestamp([
    entry({ timestamp: '2026-05-30T12:00:00Z', added: ['a'] }),
    entry({ timestamp: '2026-05-29T09:00:00Z', removed: ['b'] }),
    entry({ timestamp: '2026-05-30T12:00:00Z', added: ['c'] }),
  ])
  assert.equal(groups.length, 2)
  assert.equal(groups[0].timestamp, '2026-05-30T12:00:00Z')
  assert.equal(groups[0].entries.length, 2)
  assert.equal(groups[1].entries.length, 1)
})

test('groupByTimestamp: blank timestamp collapses into one Undated group', () => {
  const groups = groupByTimestamp([
    entry({ timestamp: '' }),
    entry({ timestamp: '   ' }),
  ])
  assert.equal(groups.length, 1)
  assert.equal(groups[0].label, 'Undated')
})

test('groupByTimestamp: empty input yields no groups (caller shows EmptyState)', () => {
  assert.deepEqual(groupByTimestamp([]), [])
})

test('formatTimestamp: parses ISO to deterministic UTC label', () => {
  assert.equal(formatTimestamp('2026-05-30T12:05:00Z'), '2026-05-30 12:05 UTC')
})

test('formatTimestamp: unparseable shown verbatim; blank -> Undated', () => {
  assert.equal(formatTimestamp('release-42'), 'release-42')
  assert.equal(formatTimestamp(''), 'Undated')
})

test('changeSummary: singular-aware, never "0 change"', () => {
  assert.equal(changeSummary(1), '1 change')
  assert.equal(changeSummary(3), '3 changes')
  assert.equal(changeSummary(0), '0 changes')
  assert.equal(changeSummary(Number.NaN), '0 changes')
})
