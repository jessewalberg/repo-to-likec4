import { useEffect } from "react"
import type { ReactElement } from "react"
import { Command } from "cmdk"
import { ArrowRight, Box, FileText, Route, type LucideIcon } from "lucide-react"

import { CommandDialog } from "./ui/leanCommand"
import type { SearchDoc } from "../lib/types"

// CONTRACT §8 — the ⌘K command palette. cmdk inside the lean CommandDialog
// (Radix Dialog wrapper: portal + scrim + sr-only Title/Description + focus
// trap & return). This component owns three jobs:
//   1) global hotkeys — ⌘/Ctrl-K toggles, "/" opens (when not typing in a
//      field), mirroring the canvas/sidebar vocabulary;
//   2) grouping the flat SearchDoc[] index into Nodes / Edges / Pages / Tours
//      with one lucide glyph per group, in a fixed canonical order;
//   3) wiring each row to its doc.go() and closing on select.
// cmdk does its OWN substring filtering over value + keywords + text content,
// so we never filter manually — we just hand it items. Each item's `value` is
// the unique doc.id (so same-label nodes never de-dupe) and `keywords` carry
// label / technology / path / id for fuzzy matching.

export interface CommandPaletteProps {
  index: SearchDoc[]
  open: boolean
  onOpenChange: (o: boolean) => void
}

/** Canonical group order + the per-group lucide glyph (echoes the sidebar IA). */
const GROUP_ORDER: SearchDoc["group"][] = ["Nodes", "Edges", "Pages", "Tours"]
const GROUP_ICON: Record<SearchDoc["group"], LucideIcon> = {
  Nodes: Box, // neutral component glyph (fixture kind = external)
  Edges: ArrowRight, // imports/flow
  Pages: FileText,
  Tours: Route,
}

/** A path-like sublabel (contains a "/" or a "." or "→") renders in mono. */
function isPathLike(sublabel: string): boolean {
  return /[/.→]/.test(sublabel)
}

export function CommandPalette({
  index,
  open,
  onOpenChange,
}: CommandPaletteProps): ReactElement {
  // Global hotkeys: ⌘/Ctrl-K toggles from anywhere; "/" opens only when the
  // user is NOT typing in a field (same guard the canvas uses). When the
  // palette is already open, cmdk owns "/" as literal input — so we no-op.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        onOpenChange(!open)
        return
      }
      if (e.key === "/" && !open) {
        const t = e.target as HTMLElement | null
        const tag = t?.tagName
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          t?.isContentEditable
        ) {
          return
        }
        e.preventDefault()
        onOpenChange(true)
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [open, onOpenChange])

  // Bucket the flat index by group, preserving canonical order and dropping
  // empty groups so we never render a heading with no rows.
  const grouped = GROUP_ORDER.map((group) => ({
    group,
    Icon: GROUP_ICON[group],
    docs: index.filter((d) => d.group === group),
  })).filter((g) => g.docs.length > 0)

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <Command className="carto-cmdk" label="Search the map">
        <Command.Input
          className="carto-cmdk__input"
          placeholder="Search nodes, edges, pages, tours"
          autoFocus
        />
        <Command.List className="carto-cmdk__list">
          <Command.Empty className="carto-cmdk__empty">No results</Command.Empty>
          {grouped.map(({ group, Icon, docs }) => (
            <Command.Group
              key={group}
              heading={group}
              className="carto-cmdk__group"
            >
              {docs.map((doc) => (
                <Command.Item
                  key={doc.id}
                  value={doc.id}
                  keywords={doc.keywords}
                  onSelect={() => {
                    doc.go()
                    onOpenChange(false)
                  }}
                  className="carto-cmdk__item"
                >
                  <Icon
                    className="carto-cmdk__glyph"
                    size={15}
                    strokeWidth={1.75}
                    aria-hidden
                  />
                  <span className="carto-cmdk__label" title={doc.label}>
                    {doc.label}
                  </span>
                  {doc.sublabel ? (
                    <span
                      className={
                        isPathLike(doc.sublabel)
                          ? "carto-cmdk__sub carto-cmdk__sub--mono"
                          : "carto-cmdk__sub"
                      }
                      title={doc.sublabel}
                    >
                      {doc.sublabel}
                    </span>
                  ) : null}
                </Command.Item>
              ))}
            </Command.Group>
          ))}
        </Command.List>
      </Command>
    </CommandDialog>
  )
}
