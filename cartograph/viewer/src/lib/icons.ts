// Icon-registry DECISION (pure, React-free). The RENDER half lives in
// components/NodeIcon.tsx. Rule: a brand icon is shown ONLY on an exact
// normalized-technology match in the allowlist; otherwise a neutral lucide glyph
// chosen by node type; otherwise a safe default box. NEVER a wrong-meaning brand.

/** What NodeIcon should render. */
export type IconKey =
  | { kind: 'brand'; slug: string } // simple-icons slug, e.g. 'javascript'
  | { kind: 'lucide'; name: string } // lucide-react icon name, e.g. 'box'

/** Neutral type glyphs (lucide names) — the fallback when no brand is certain. */
export const LUCIDE_BY_TYPE: Record<string, string> = {
  service: 'server',
  gateway: 'door-open',
  worker: 'cog',
  function: 'square-function',
  datastore: 'database',
  database: 'database',
  cache: 'database-zap',
  queue: 'list-end',
  event: 'radio',
  topic: 'radio',
  stream: 'waves',
  external: 'box',
  component: 'package',
  module: 'package',
  person: 'user',
  decision: 'git-branch',
  entity: 'table',
  state: 'circle-dot',
}

/** normalized technology -> simple-icons slug. Exact-match allowlist only. */
const BRAND_SLUGS: Record<string, string> = {
  javascript: 'javascript',
  typescript: 'typescript',
  python: 'python',
  go: 'go',
  rust: 'rust',
  java: 'openjdk',
  kotlin: 'kotlin',
  ruby: 'ruby',
  php: 'php',
  csharp: 'dotnet',
  react: 'react',
  vue: 'vuedotjs',
  svelte: 'svelte',
  angular: 'angular',
  node: 'nodedotjs',
  deno: 'deno',
  bun: 'bun',
  postgresql: 'postgresql',
  mysql: 'mysql',
  sqlite: 'sqlite',
  redis: 'redis',
  mongodb: 'mongodb',
  docker: 'docker',
  kubernetes: 'kubernetes',
  graphql: 'graphql',
  html: 'html5',
  css: 'css3',
}

const TECH_ALIASES: Record<string, string> = {
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  jsx: 'javascript',
  py: 'python',
  golang: 'go',
  nodejs: 'node',
  'node.js': 'node',
  postgres: 'postgresql',
  psql: 'postgresql',
  cs: 'csharp',
  'c#': 'csharp',
}

/** Lowercase, strip noise, resolve aliases → a stable tech key. */
export function normalizeTech(tech?: string): string {
  if (!tech) return ''
  const cleaned = tech.trim().toLowerCase().replace(/[^a-z0-9.#+]/g, '')
  return TECH_ALIASES[cleaned] ?? cleaned
}

export interface IconNodeLike {
  type?: string
  data?: { technology?: string; icon?: string }
}

export function iconFor(node: IconNodeLike): IconKey {
  // Explicit manifest icon wins (author asserted it) — treated as a brand slug.
  const explicit = node.data?.icon?.trim()
  if (explicit) return { kind: 'brand', slug: explicit.toLowerCase() }

  const tech = normalizeTech(node.data?.technology)
  if (tech && BRAND_SLUGS[tech]) return { kind: 'brand', slug: BRAND_SLUGS[tech] }

  return { kind: 'lucide', name: LUCIDE_BY_TYPE[node.type ?? ''] ?? 'box' }
}
