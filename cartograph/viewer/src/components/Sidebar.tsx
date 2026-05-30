import { Map as MapIcon, SunMoon } from 'lucide-react'

import {
  Sidebar as SidebarPanel,
  SidebarContent,
  SidebarGroupLabel,
  SidebarTrigger,
} from './ui/leanSidebar'
import { NavTree } from './NavTree'
import type { AppRoute, NavEntry, Site } from '../lib/types'

/**
 * Cartograph left-nav shell — CONTRACT §2 / §7.
 *
 * Composes the lean shadcn-style sidebar primitives with the recursive
 * `NavTree`. Top: a small `Map` mark + `Cartograph` wordmark. Then a search
 * box that *looks* like an input (`--canvas-sunken` / `--hairline` / `--r-sm`
 * with a `⌘K` chip) but is a real button — clicking or pressing Enter/Space
 * opens the command palette; there is NO inline search field (§7/§8). Then the
 * nav: each top-level `site.sidebar` section is wrapped so its label renders as
 * a `SidebarGroupLabel` eyebrow, with that section's children fed to `NavTree`
 * (a section with no children still renders so the IA never silently drops a
 * heading). Footer (36px, pinned bottom): the repo id, a theme-toggle button
 * (`SunMoon` → `onToggleTheme`) and the rail-collapse `SidebarTrigger`.
 *
 * Presentation + wiring only. Selection/route lockstep flows down to `NavTree`
 * via `activeRoute` + `activeNodeId`; activations bubble up through
 * `onActivate`. The opener handoff (search) and theme toggle are callbacks so
 * this component owns no global state (Dependency Inversion).
 */
export interface SidebarProps {
  site: Site
  repo?: string
  activeRoute: AppRoute
  activeNodeId: string | null
  onActivate: (entry: NavEntry) => void
  onOpenSearch: () => void
  onToggleTheme: () => void
}

export function Sidebar({
  site,
  repo,
  activeRoute,
  activeNodeId,
  onActivate,
  onOpenSearch,
  onToggleTheme,
}: SidebarProps): React.JSX.Element {
  const sections = site.sidebar ?? []
  const hasRepo = typeof repo === 'string' && repo.trim().length > 0

  return (
    <SidebarPanel id="sidebar" tabIndex={-1} aria-label="Cartograph navigation">
      <div className="carto-sidebar flex h-full flex-col">
        {/* Brand */}
        <div className="carto-sidebar__brand flex items-center gap-2 px-3 py-3">
          <span
            aria-hidden="true"
            className="carto-sidebar__mark flex h-6 w-6 shrink-0 items-center justify-center"
            style={{
              background: 'var(--canvas-sunken)',
              border: '1px solid var(--hairline)',
              borderRadius: 'var(--r-sm)',
              color: 'var(--text-strong)',
            }}
          >
            <MapIcon size={14} strokeWidth={2} aria-hidden="true" />
          </span>
          <span
            className="carto-sidebar__wordmark truncate"
            style={{
              color: 'var(--text-strong)',
              fontSize: 'var(--fs-sm)',
              fontWeight: 'var(--fw-semibold)',
              letterSpacing: 'var(--tracking-tight)',
            }}
          >
            Cartograph
          </span>
        </div>

        {/* Search trigger — looks like an input, opens the ⌘K palette. */}
        <div className="px-2 pb-1">
          <button
            type="button"
            className="carto-sidebar__search flex w-full items-center gap-2 px-2.5 py-1.5 text-left"
            onClick={onOpenSearch}
            aria-haspopup="dialog"
            aria-keyshortcuts="Meta+K Control+K"
            style={{
              background: 'var(--canvas-sunken)',
              border: '1px solid var(--hairline)',
              borderRadius: 'var(--r-sm)',
            }}
          >
            <SearchGlyph />
            <span
              className="carto-sidebar__search-label flex-1 truncate"
              style={{ color: 'var(--text-subtle)', fontSize: 'var(--fs-sm)' }}
            >
              Search the map…
            </span>
            <kbd
              aria-hidden="true"
              className="carto-sidebar__kbd shrink-0 px-1.5 py-0.5"
              style={{
                background: 'var(--canvas)',
                border: '1px solid var(--hairline)',
                borderRadius: 'var(--r-sm)',
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--fs-xs)',
                lineHeight: 1,
              }}
            >
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Nav — each top-level section is an eyebrow heading + its NavTree. */}
        <SidebarContent className="carto-sidebar__nav">
          {sections.map((section) => {
            const children = section.children ?? []
            return (
              <section key={section.id} className="carto-sidebar__section pb-1">
                <SidebarGroupLabel id={`carto-navhead-${section.id}`}>
                  {section.label}
                </SidebarGroupLabel>
                <NavTree
                  entries={children}
                  activeRoute={activeRoute}
                  activeNodeId={activeNodeId}
                  onActivate={onActivate}
                />
              </section>
            )
          })}
        </SidebarContent>

        {/* Footer (36px): repo id · theme toggle · rail collapse. */}
        <footer
          className="carto-sidebar__footer flex shrink-0 items-center gap-1.5 px-2"
          style={{
            height: 36,
            borderTop: '1px solid var(--divider)',
          }}
        >
          <span
            className="carto-sidebar__repo flex-1 truncate"
            title={hasRepo ? repo : undefined}
            style={{
              color: 'var(--text-subtle)',
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--fs-xs)',
            }}
          >
            {hasRepo ? repo : 'local repo'}
          </span>

          <button
            type="button"
            className="carto-sidebar__iconbtn flex h-6 w-6 items-center justify-center"
            onClick={onToggleTheme}
            aria-label="Toggle color theme"
            title="Toggle color theme"
            style={{ color: 'var(--text-muted)', borderRadius: 'var(--r-sm)' }}
          >
            <SunMoon size={14} strokeWidth={2} aria-hidden="true" />
          </button>

          <SidebarTrigger className="carto-sidebar__iconbtn" />
        </footer>
      </div>
    </SidebarPanel>
  )
}

/** Inline magnifier glyph for the search trigger (kept local — purely decorative). */
function SearchGlyph(): React.JSX.Element {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
      style={{ color: 'var(--text-subtle)' }}
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  )
}
