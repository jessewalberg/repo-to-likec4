// Pure presentation-text derivations for ChangelogView (React-free, unit-testable).
// CONTRACT §11: a non-empty changelog renders a timeline GROUPED BY TIMESTAMP;
// each entry lists added / removed / migrated / suppressedSkipped rows. We must
// NEVER fabricate rows — absent/empty arrays collapse to nothing. These helpers
// own every derivation (grouping, ordering, row counts, formatted timestamp,
// "X changes" summary) so the behaviour can be proven without a DOM.

import type { ChangelogEntry } from '../lib/types'

/** A single migration's display strings (from -> to). */
export interface MigratedRow {
  from: string
  to: string
}

/** One changelog entry shaped for rendering. Empty kinds are pre-filtered out. */
export interface TimelineEntry {
  ref?: string
  timestamp: string
  added: string[]
  removed: string[]
  migrated: MigratedRow[]
  suppressedSkipped: string[]
  /** Total number of real rows across all kinds (for the entry's count chip). */
  changeCount: number
}

/** Entries sharing one timestamp, in original order within the group. */
export interface TimelineGroup {
  timestamp: string
  label: string
  entries: TimelineEntry[]
}

/** Trim + drop blank ids so we never render an empty `<li>` for a bad row. */
function cleanIds(ids: readonly string[] | undefined): string[] {
  if (!Array.isArray(ids)) return []
  return ids.map((id) => (typeof id === 'string' ? id.trim() : '')).filter((id) => id.length > 0)
}

/** Trim + drop migrations missing either endpoint (never fabricate a half-row). */
function cleanMigrated(
  rows: readonly { from: string; to: string }[] | undefined,
): MigratedRow[] {
  if (!Array.isArray(rows)) return []
  return rows
    .map((r) => ({
      from: typeof r?.from === 'string' ? r.from.trim() : '',
      to: typeof r?.to === 'string' ? r.to.trim() : '',
    }))
    .filter((r) => r.from.length > 0 && r.to.length > 0)
}

/**
 * Normalise one raw ChangelogEntry into a render-ready TimelineEntry: every id
 * trimmed, blanks dropped, and a real `changeCount` so the UI can show the entry
 * weight without fabricating rows. A missing/blank timestamp falls back to ''
 * (callers group those under a single "Undated" bucket via {@link groupByTimestamp}).
 */
export function toTimelineEntry(entry: ChangelogEntry): TimelineEntry {
  const added = cleanIds(entry?.added)
  const removed = cleanIds(entry?.removed)
  const migrated = cleanMigrated(entry?.migrated)
  const suppressedSkipped = cleanIds(entry?.suppressedSkipped)
  const ref = typeof entry?.ref === 'string' && entry.ref.trim() ? entry.ref.trim() : undefined
  const timestamp =
    typeof entry?.timestamp === 'string' && entry.timestamp.trim() ? entry.timestamp.trim() : ''
  return {
    ref,
    timestamp,
    added,
    removed,
    migrated,
    suppressedSkipped,
    changeCount: added.length + removed.length + migrated.length + suppressedSkipped.length,
  }
}

/**
 * Group entries by their timestamp, preserving the order in which each timestamp
 * first appears (stable, deterministic — no sorting assumptions about input).
 * Blank timestamps collapse into one trailing "Undated" group so nothing is lost.
 */
export function groupByTimestamp(entries: readonly ChangelogEntry[]): TimelineGroup[] {
  const order: string[] = []
  const buckets = new Map<string, TimelineEntry[]>()

  for (const raw of Array.isArray(entries) ? entries : []) {
    const entry = toTimelineEntry(raw)
    const key = entry.timestamp || ''
    if (!buckets.has(key)) {
      buckets.set(key, [])
      order.push(key)
    }
    buckets.get(key)!.push(entry)
  }

  return order.map((key) => ({
    timestamp: key,
    label: formatTimestamp(key),
    entries: buckets.get(key)!,
  }))
}

/**
 * Human-readable timestamp label. Parses ISO-ish strings to a stable
 * locale-independent `YYYY-MM-DD HH:MM` (UTC) so snapshots/tests are
 * deterministic; an unparseable value is shown verbatim; blank -> "Undated".
 */
export function formatTimestamp(timestamp: string): string {
  const trimmed = (timestamp ?? '').trim()
  if (!trimmed) return 'Undated'
  // Only treat ISO-8601-ish datetimes as parseable. `Date.parse` is lenient
  // (it reads "release-42" as the year 2042), so a non-ISO label like a release
  // name or commit ref is shown verbatim instead of being mangled into a date.
  if (!/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/.test(trimmed)) {
    return trimmed
  }
  const ms = Date.parse(trimmed)
  if (Number.isNaN(ms)) return trimmed
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
    ` ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`
  )
}

/** "1 change" / "n changes" — singular-aware, never "0 change". */
export function changeSummary(count: number): string {
  const n = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0
  return `${n} ${n === 1 ? 'change' : 'changes'}`
}
