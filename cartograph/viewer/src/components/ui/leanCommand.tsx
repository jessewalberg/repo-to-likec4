import type { ReactNode } from 'react'
import { Command } from 'cmdk'
import * as Dialog from '@radix-ui/react-dialog'
import { cn } from '../../lib/cn'

/**
 * Lean CommandDialog (CONTRACT §8).
 *
 * A `@radix-ui/react-dialog` (Root/Portal/Overlay/Content) shell wrapping cmdk's
 * `Command`. Radix gives us focus-trap, return-focus-to-opener, `Esc`-to-close
 * and scroll-lock "for free"; cmdk owns the actual filtering. We keep this file
 * structural only — `CommandPalette` mounts `Command.Input` / `Command.List` /
 * `Command.Group` / `Command.Item` inside via `children`.
 *
 * Accessibility: Radix Dialog requires a `Dialog.Title`; we ship a visually
 * hidden Title ("Search") + Description so screen readers announce the dialog's
 * purpose while the visible UI stays uncluttered.
 *
 * Motion (CONTRACT §8/§12): 120ms fade + 8px rise on the panel, faint
 * `--canvas-sunken` scrim on the overlay, both driven by Radix's
 * `data-state="open|closed"` attribute. The `prefers-reduced-motion` media
 * query in the scoped stylesheet collapses this to an instant, information-
 * bearing state change — so no JS motion gate is needed here.
 */
export interface CommandDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode
  /** Optional override for the sr-only dialog title (default "Search"). */
  title?: string
  /** Optional override for the sr-only dialog description. */
  description?: string
  /** Extra classes merged onto the cmdk Command root. */
  className?: string
}

export function CommandDialog({
  open,
  onOpenChange,
  children,
  title = 'Search',
  description = 'Search nodes, edges, pages and tours. Use the arrow keys to move and Enter to go.',
  className,
}: CommandDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="carto-cmd__overlay fixed inset-0 z-40" />
        <Dialog.Content
          aria-label={title}
          className="carto-cmd__content fixed left-1/2 top-[18vh] z-50 w-[min(560px,92vw)] -translate-x-1/2 overflow-hidden"
        >
          {/* a11y: Radix requires a Title; both stay visually hidden (sr-only). */}
          <Dialog.Title className="carto-cmd__sr-only">{title}</Dialog.Title>
          <Dialog.Description className="carto-cmd__sr-only">
            {description}
          </Dialog.Description>
          <Command
            label={title}
            className={cn('carto-cmd__command flex flex-col', className)}
          >
            {children}
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/**
 * Re-export cmdk's native slots so `CommandPalette` imports its building blocks
 * from one place and the cmdk dependency stays encapsulated behind this module.
 */
export const CommandInput = Command.Input
export const CommandList = Command.List
export const CommandEmpty = Command.Empty
export const CommandGroup = Command.Group
export const CommandItem = Command.Item
export const CommandSeparator = Command.Separator

export { Command }
