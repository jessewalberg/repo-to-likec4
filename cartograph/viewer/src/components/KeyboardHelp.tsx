import type { ReactElement } from "react"
import * as Dialog from "@radix-ui/react-dialog"

import { cn } from "../lib/cn"
import { useReducedMotion } from "../lib/useReducedMotion"

// CONTRACT §9 — the "?" keyboard-help overlay. The interaction vocabulary
// (j/k, Tab, Enter, o, F, Esc, ⌘K, ⌘B …) is otherwise invisible; this overlay
// surfaces the full map on demand (and on first run). It is a controlled Radix
// Dialog: App owns the "?" hotkey and the open state, Radix owns the focus
// trap + return-focus-to-opener + Esc-to-close (so we never reimplement them).
//
// The model is two columns — Canvas (what the focused node responds to) and
// Global (app-wide shortcuts) — kept as a pure, exported data table so the
// rendered strings can be asserted without a DOM (this file is render-only,
// matching the repo's *.ts/*.test.ts convention for the rest of the chrome).

/** One row of the help table: the action and the keys that trigger it. */
export interface KeyHint {
  /** Human description of what the shortcut does. */
  readonly action: string
  /**
   * Key combos. Each inner array is ONE chord rendered as adjacent chips
   * (e.g. ["Shift", "Tab"]); multiple chords are alternatives joined by "or"
   * (e.g. [["⌘", "K"], ["/"]] → "⌘ K  or  /").
   */
  readonly chords: ReadonlyArray<ReadonlyArray<string>>
}

/** A titled column of hints. */
export interface KeyGroup {
  readonly title: string
  readonly hints: readonly KeyHint[]
}

/**
 * The keyboard model, verbatim from CONTRACT §9. Pure data so it is trivially
 * unit-testable and so a single source drives both columns. "⌘" carries a
 * "Ctrl" alias in the action text rather than duplicating every row per-OS.
 */
export const KEYBOARD_MODEL: readonly KeyGroup[] = [
  {
    title: "Canvas",
    hints: [
      { action: "Move within lane", chords: [["j"], ["k"]] },
      { action: "Move across lanes", chords: [["Tab"], ["Shift", "Tab"]] },
      { action: "Open in detail panel", chords: [["Enter"]] },
      { action: "Open source", chords: [["o"]] },
      { action: "Fit view", chords: [["F"]] },
      { action: "Clear selection", chords: [["Esc"]] },
    ],
  },
  {
    title: "Global",
    hints: [
      { action: "Search the map", chords: [["⌘", "K"], ["/"]] },
      { action: "Toggle sidebar", chords: [["⌘", "B"]] },
      { action: "This help", chords: [["?"]] },
      { action: "Close overlay", chords: [["Esc"]] },
    ],
  },
] as const

export interface KeyboardHelpProps {
  open: boolean
  onOpenChange: (o: boolean) => void
}

/** A single keycap chip (mono, sunken). */
function Kbd({ children }: { children: string }): ReactElement {
  return <kbd className="carto-keyhelp__kbd">{children}</kbd>
}

/** Renders a hint's chord list: chips within a chord, "or" between chords. */
function Chords({ chords }: { chords: KeyHint["chords"] }): ReactElement {
  return (
    <span className="carto-keyhelp__chords">
      {chords.map((chord, ci) => (
        // Chords are a fixed, ordered data table — index keys are stable here.
        <span key={ci} className="carto-keyhelp__chord">
          {ci > 0 ? <span className="carto-keyhelp__or">or</span> : null}
          {chord.map((key, ki) => (
            <Kbd key={ki}>{key}</Kbd>
          ))}
        </span>
      ))}
    </span>
  )
}

export function KeyboardHelp({
  open,
  onOpenChange,
}: KeyboardHelpProps): ReactElement {
  // Information-bearing content (the shortcut map) must appear instantly; only
  // the decorative fade/translate is gated. The global reduced-motion token
  // block also neutralises transitions — this is belt-and-suspenders so the
  // rule "import useReducedMotion where motion is involved" is honoured at the
  // component seam, not just globally.
  const reduced = useReducedMotion()

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="carto-keyhelp__overlay" />
        <Dialog.Content
          className={cn(
            "carto-keyhelp__panel",
            reduced && "carto-keyhelp__panel--still",
          )}
          aria-label="Keyboard shortcuts"
        >
          {/* sr-only programmatic name + description (Radix requires both). */}
          <Dialog.Title className="carto-keyhelp__sr">
            Keyboard shortcuts
          </Dialog.Title>
          <Dialog.Description className="carto-keyhelp__sr">
            The full keyboard model for navigating the Cartograph canvas and the
            app shell.
          </Dialog.Description>

          <header className="carto-keyhelp__head">
            <h2 className="carto-keyhelp__heading">Keyboard shortcuts</h2>
            <Dialog.Close
              className="carto-keyhelp__close"
              aria-label="Close keyboard shortcuts"
            >
              Esc
            </Dialog.Close>
          </header>

          <div className="carto-keyhelp__cols">
            {KEYBOARD_MODEL.map((group) => (
              <section key={group.title} className="carto-keyhelp__col">
                <h3 className="carto-keyhelp__eyebrow">{group.title}</h3>
                <dl className="carto-keyhelp__list">
                  {group.hints.map((hint) => (
                    <div key={hint.action} className="carto-keyhelp__row">
                      <dt className="carto-keyhelp__action">{hint.action}</dt>
                      <dd className="carto-keyhelp__keys">
                        <Chords chords={hint.chords} />
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
