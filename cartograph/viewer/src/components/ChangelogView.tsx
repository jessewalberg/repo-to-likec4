import { ArrowRight, History, Minus, Plus, EyeOff } from "lucide-react"

import { EmptyState } from "./EmptyState"
import {
  changeSummary,
  groupByTimestamp,
  type MigratedRow,
  type TimelineEntry,
} from "./changelogTimeline"
import type { ChangelogEntry } from "../lib/types"

// CONTRACT §11 — ChangelogView. The fixture ships `entries:[]`, so the EMPTY
// branch (the History-glyph EmptyState, "Nothing logged yet", re-run hint) is
// the common case, not the edge case. A non-empty changelog renders a timeline
// GROUPED BY TIMESTAMP; each entry shows its ref + a change count and lists
// added (plus, service-fg) / removed (minus, muted) / migrated (arrow) /
// suppressedSkipped (eye-off). Every id is mono. We NEVER fabricate rows: empty
// kinds collapse, blank ids are dropped (see changelogTimeline.ts).
//
// Presentation only — all grouping/cleaning/formatting is the pure, unit-tested
// `changelogTimeline` helper (mirrors NodeCard / nodeCardText). Token colour
// comes from CSS vars; complex/stateful styling lives in the scoped css block.

export interface ChangelogViewProps {
  changelog: { entries: ChangelogEntry[] }
}

export function ChangelogView({ changelog }: ChangelogViewProps): React.ReactElement {
  const entries = Array.isArray(changelog?.entries) ? changelog.entries : []
  const groups = groupByTimestamp(entries)

  // EMPTY (fixture) — the shared EmptyState template, never a fake row.
  if (groups.length === 0) {
    return (
      <div className="carto-changelog carto-changelog--empty">
        <EmptyState
          icon={<History size={28} strokeWidth={1.5} aria-hidden="true" />}
          title="Nothing logged yet"
          body="Re-running the map after you edit the codebase records what changed — added, removed, and migrated nodes show up here as a timeline."
        />
      </div>
    )
  }

  // NON-EMPTY — a vertical timeline grouped by timestamp.
  return (
    <section
      className="carto-changelog"
      aria-label="Changelog"
      // Scroll container; flat (no shadow) — chrome recedes, content is hero.
      style={{ background: "var(--canvas)" }}
    >
      <div className="carto-changelog__inner">
        <header className="carto-changelog__head">
          <h1 className="carto-changelog__title">Changelog</h1>
          <p className="carto-changelog__lede">
            What changed each time the map was re-run.
          </p>
        </header>

        <ol className="carto-changelog__timeline" role="list">
          {groups.map((group) => (
            <li key={group.timestamp || "undated"} className="carto-changelog__group">
              <div className="carto-changelog__stamp">
                <span className="carto-changelog__node" aria-hidden="true" />
                <time
                  className="carto-changelog__stamp-label"
                  dateTime={group.timestamp || undefined}
                >
                  {group.label}
                </time>
              </div>

              <ol className="carto-changelog__entries" role="list">
                {group.entries.map((entry, i) => (
                  <EntryCard key={entry.ref ?? `${group.timestamp}-${i}`} entry={entry} />
                ))}
              </ol>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

/** One changelog entry: its ref + count chip, then only the non-empty kinds. */
function EntryCard({ entry }: { entry: TimelineEntry }): React.ReactElement {
  return (
    <li
      className="carto-changelog__entry"
      style={{
        background: "var(--elev-card)",
        border: "1px solid var(--hairline)",
        borderRadius: "var(--r-lg)",
        boxShadow: "var(--shadow-1)",
      }}
    >
      <div className="carto-changelog__entry-head">
        {entry.ref ? (
          <span className="carto-changelog__ref" title={entry.ref}>
            {entry.ref}
          </span>
        ) : (
          <span className="carto-changelog__ref carto-changelog__ref--none">
            no ref
          </span>
        )}
        <span className="carto-changelog__count">{changeSummary(entry.changeCount)}</span>
      </div>

      <div className="carto-changelog__kinds">
        <IdKind
          rows={entry.added}
          eyebrow="Added"
          tone="added"
          icon={<Plus size={13} strokeWidth={2.5} aria-hidden="true" />}
        />
        <IdKind
          rows={entry.removed}
          eyebrow="Removed"
          tone="removed"
          icon={<Minus size={13} strokeWidth={2.5} aria-hidden="true" />}
        />
        <MigratedKind rows={entry.migrated} />
        <IdKind
          rows={entry.suppressedSkipped}
          eyebrow="Suppressed / skipped"
          tone="suppressed"
          icon={<EyeOff size={13} strokeWidth={2} aria-hidden="true" />}
        />
      </div>
    </li>
  )
}

/** A list of bare ids for one kind (added / removed / suppressed). Collapses
    entirely when there are no rows — never an empty heading. */
function IdKind({
  rows,
  eyebrow,
  tone,
  icon,
}: {
  rows: string[]
  eyebrow: string
  tone: "added" | "removed" | "suppressed"
  icon: React.ReactNode
}): React.ReactElement | null {
  if (rows.length === 0) return null
  return (
    <div className="carto-changelog__kind" data-tone={tone}>
      <div className="carto-changelog__eyebrow">
        {eyebrow}
        <span className="carto-changelog__kind-count" aria-hidden="true">
          {rows.length}
        </span>
      </div>
      <ul className="carto-changelog__rows" role="list">
        {rows.map((id) => (
          <li key={id} className="carto-changelog__row">
            <span className="carto-changelog__glyph" aria-hidden="true">
              {icon}
            </span>
            <code className="carto-changelog__id">{id}</code>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Migrated rows render `from → to`, both ids in mono. Collapses when empty. */
function MigratedKind({ rows }: { rows: MigratedRow[] }): React.ReactElement | null {
  if (rows.length === 0) return null
  return (
    <div className="carto-changelog__kind" data-tone="migrated">
      <div className="carto-changelog__eyebrow">
        Migrated
        <span className="carto-changelog__kind-count" aria-hidden="true">
          {rows.length}
        </span>
      </div>
      <ul className="carto-changelog__rows" role="list">
        {rows.map((row) => (
          <li key={`${row.from}->${row.to}`} className="carto-changelog__row">
            <code className="carto-changelog__id">{row.from}</code>
            <span className="carto-changelog__arrow" aria-label="migrated to">
              <ArrowRight size={13} strokeWidth={2} aria-hidden="true" />
            </span>
            <code className="carto-changelog__id">{row.to}</code>
          </li>
        ))}
      </ul>
    </div>
  )
}
