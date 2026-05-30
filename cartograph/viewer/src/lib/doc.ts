import type { DocPage } from './types'

// Split a raw .md string into { frontmatter, body }. The generator writes a small
// YAML frontmatter block (node / provenance / pinned); react-markdown would render
// it as text, so we strip it here before the body reaches <Markdown>. Intentionally
// tiny — only the flat key: value pairs the generator emits, no YAML dependency.
export function parseDoc(raw: string): DocPage {
  const m = raw.match(/^﻿?---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
  if (!m) return { body: raw }
  const frontmatter: Record<string, unknown> = {}
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(':')
    if (i < 0) continue
    const key = line.slice(0, i).trim()
    if (!key) continue
    frontmatter[key] = line.slice(i + 1).trim()
  }
  return { frontmatter, body: raw.slice(m[0].length).replace(/^\n+/, '') }
}
