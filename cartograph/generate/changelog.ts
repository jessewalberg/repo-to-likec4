import type { MergeReport } from './schema.ts'

// changelog.json — the "what changed between commits" feed (ADR-0001). Each
// re-run's MergeReport becomes one entry; the viewer's Changelog nav renders it.
// Field/position preservation is intentionally NOT a feed event — it's the
// no-clobber guarantee working, not a change a reader cares about.

export interface ChangelogEntry {
  ref?: string
  timestamp: string
  added: string[]
  removed: string[]
  migrated: { from: string; to: string }[]
  suppressedSkipped: string[]
}

export interface Changelog {
  schemaVersion: number
  /** Newest entry first. */
  entries: ChangelogEntry[]
}

export function emptyChangelog(): Changelog {
  return { schemaVersion: 1, entries: [] }
}

/** A report worth recording: it added, removed, migrated, or skipped something. */
export function isEmptyReport(report: MergeReport): boolean {
  return (
    report.added.length === 0 &&
    report.mutedRemoved.length === 0 &&
    report.migrated.length === 0 &&
    report.suppressedSkipped.length === 0
  )
}

/** Prepend a changelog entry built from `report`; a no-op report leaves the feed unchanged. */
export function appendChangelog(prev: Changelog, report: MergeReport, meta: { ref?: string; timestamp: string }): Changelog {
  if (isEmptyReport(report)) return prev
  const entry: ChangelogEntry = {
    ref: meta.ref,
    timestamp: meta.timestamp,
    added: report.added,
    removed: report.mutedRemoved,
    migrated: report.migrated,
    suppressedSkipped: report.suppressedSkipped,
  }
  return { schemaVersion: prev.schemaVersion, entries: [entry, ...prev.entries] }
}
