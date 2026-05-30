// Pure presentation-text derivations for NodeCard (React-free, unit-testable).
// The component is render-only; these helpers own every string it shows so the
// behaviour (tech abbreviation, parent-dir crumb, ARIA label per CONTRACT §9)
// can be proven without a DOM. Never returns NaN/undefined/'' for a slot the
// card renders — absent slots collapse to `null` so the card hides them.

/** Short, recognisable tech badge text. `JavaScript`->`JS`, full name in title. */
const TECH_ABBR: Record<string, string> = {
  javascript: 'JS',
  typescript: 'TS',
  python: 'Py',
  go: 'Go',
  rust: 'Rs',
  java: 'Java',
  kotlin: 'Kt',
  ruby: 'Rb',
  php: 'PHP',
  csharp: 'C#',
  'c#': 'C#',
  html: 'HTML',
  css: 'CSS',
}

/**
 * Badge label for the meta-row tech tag. Returns the canonical short form for
 * known languages, otherwise the trimmed original. `undefined`/blank -> null
 * (slot collapses).
 */
export function techTag(tech?: string): string | null {
  if (!tech) return null
  const trimmed = tech.trim()
  if (!trimmed) return null
  return TECH_ABBR[trimmed.toLowerCase()] ?? trimmed
}

/**
 * Parent-directory crumb from a metadata path so the 15 same-kind cards are
 * differentiable when there is no summary. `tools/factory/cli.mjs`->`tools/factory`.
 * A bare filename (no directory) or absent path -> null (slot collapses).
 */
export function parentDirCrumb(metadataPath?: string): string | null {
  if (!metadataPath) return null
  const normalized = metadataPath.trim().replace(/\\/g, '/').replace(/\/+$/, '')
  if (!normalized) return null
  const lastSlash = normalized.lastIndexOf('/')
  if (lastSlash <= 0) return null
  return normalized.slice(0, lastSlash)
}

export interface NodeAriaFields {
  label: string
  kind: string
  zone?: string
  importsCount: number
  importedByCount: number
}

/**
 * CONTRACT §9 graph semantics:
 * "{label}, {kind}, in {zone} lane, imports {n}, imported by {m}".
 * The lane clause is dropped when zone is absent. Counts are coerced to a
 * safe integer (never NaN/undefined in the spoken label).
 */
export function nodeAriaLabel(fields: NodeAriaFields): string {
  const imports = safeCount(fields.importsCount)
  const importedBy = safeCount(fields.importedByCount)
  const lane = fields.zone ? `, in ${fields.zone} lane` : ''
  return `${fields.label}, ${fields.kind}${lane}, imports ${imports}, imported by ${importedBy}`
}

function safeCount(n: number): number {
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0
}
