// Icon-registry RENDERING half. The DECISION half (which IconKey to show) lives
// in ../lib/icons (iconFor). This file maps that IconKey to a concrete React
// component: a simple-icons brand glyph on an exact tech/brand match, else a
// neutral lucide type glyph, else a safe Box. It NEVER renders a wrong-meaning
// brand: an unknown slug degrades to Box, not a guessed icon.
//
// Color is intentionally driven by `currentColor` so the parent NodeCard (which
// sets --kind-fg on the [data-kind] element) owns the hue. We never hard-code a
// brand's own color here — kind color must stay recoverable and consistent.

import {
  Box,
  Cog,
  CircleDot,
  Database,
  DatabaseZap,
  DoorOpen,
  GitBranch,
  ListEnd,
  Package,
  Radio,
  Server,
  SquareFunction,
  Table,
  User,
  Waves,
  type LucideIcon,
} from 'lucide-react'
import {
  SiAngular, SiBun, SiCss, SiDeno, SiDocker, SiDotnet, SiGo, SiGraphql, SiHtml5,
  SiJavascript, SiKotlin, SiKubernetes, SiMongodb, SiMysql, SiNodedotjs, SiOpenjdk,
  SiPhp, SiPostgresql, SiPython, SiReact, SiRedis, SiRuby, SiRust, SiSqlite,
  SiSvelte, SiTypescript, SiVuedotjs,
} from '@icons-pack/react-simple-icons'
import { iconFor } from '../lib/icons'

/** A glyph component accepting the shared icon prop shape (lucide + simple-icons). */
type GlyphComponent = React.ComponentType<{
  size?: number
  color?: string
  title?: string
  'aria-hidden'?: boolean
}>

/**
 * Explicit kebab -> lucide PascalCase component map for exactly the names emitted
 * by LUCIDE_BY_TYPE in ../lib/icons. An explicit map (not dynamic indexing) keeps
 * the bundle honest and the set auditable; anything unmapped falls back to Box.
 */
export const LUCIDE_BY_NAME: Record<string, LucideIcon> = {
  server: Server,
  'door-open': DoorOpen,
  cog: Cog,
  'square-function': SquareFunction,
  database: Database,
  'database-zap': DatabaseZap,
  'list-end': ListEnd,
  radio: Radio,
  waves: Waves,
  box: Box,
  package: Package,
  user: User,
  'git-branch': GitBranch,
  table: Table,
  'circle-dot': CircleDot,
}

/**
 * Static slug -> simple-icons component map for ONLY the brands in the registry
 * allowlist (../lib/icons BRAND_SLUGS). Explicit imports (not a namespace import)
 * keep the bundle tiny — otherwise every one of the ~3k brand icons ships. Any
 * slug not here degrades to the neutral type glyph / Box, never a wrong brand.
 */
const BRAND_BY_SLUG: Record<string, GlyphComponent> = {
  javascript: SiJavascript, typescript: SiTypescript, python: SiPython, go: SiGo,
  rust: SiRust, openjdk: SiOpenjdk, kotlin: SiKotlin, ruby: SiRuby, php: SiPhp,
  dotnet: SiDotnet, react: SiReact, vuedotjs: SiVuedotjs, svelte: SiSvelte,
  angular: SiAngular, nodedotjs: SiNodedotjs, deno: SiDeno, bun: SiBun,
  postgresql: SiPostgresql, mysql: SiMysql, sqlite: SiSqlite, redis: SiRedis,
  mongodb: SiMongodb, docker: SiDocker, kubernetes: SiKubernetes, graphql: SiGraphql,
  html5: SiHtml5, css3: SiCss,
}

/** Resolve a brand slug to its simple-icons component, or null if not allowlisted. */
function brandGlyph(slug: string): GlyphComponent | null {
  return BRAND_BY_SLUG[slug.trim().toLowerCase()] ?? null
}

export interface NodeIconProps {
  node: { type?: string; data?: { technology?: string; icon?: string } }
  /** Square px size of the glyph. Defaults to 16 (the 22x22 role-glyph slot's inner icon). */
  size?: number
  /** Accessible name. When omitted the glyph is decorative (aria-hidden). */
  title?: string
}

/**
 * Render the registry's chosen glyph for a node. Pure presentation: the choice is
 * made by iconFor(); this only maps that choice to a component and applies size +
 * currentColor. The wrapper is a non-blocking inline span so it sits cleanly inside
 * the NodeCard role-glyph tile.
 */
export function NodeIcon({ node, size = 16, title }: NodeIconProps) {
  const key = iconFor(node)

  let Glyph: GlyphComponent | null = null
  if (key.kind === 'brand') {
    Glyph = brandGlyph(key.slug)
  } else {
    Glyph = LUCIDE_BY_NAME[key.name] ?? null
  }
  // Final safety net: an unknown brand slug or unmapped lucide name degrades to
  // Box — a safe neutral glyph, never a wrong-meaning brand.
  if (!Glyph) Glyph = Box

  const decorative = title === undefined

  return (
    <span
      className="inline-flex shrink-0 items-center justify-center leading-none"
      style={{ width: size, height: size }}
    >
      <Glyph
        size={size}
        color="currentColor"
        title={title}
        aria-hidden={decorative ? true : undefined}
      />
    </span>
  )
}
