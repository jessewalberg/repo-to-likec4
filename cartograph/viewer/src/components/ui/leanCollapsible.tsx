import {
  type ComponentPropsWithoutRef,
  type ReactNode,
  type SyntheticEvent,
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'

/**
 * Native <details>/<summary> collapsible (CONTRACT §7).
 *
 * The browser gives us correct keyboard handling (Enter/Space on the summary),
 * an accessible open/close affordance, and disclosure semantics "for free" — so
 * NavTree branches stay lean and a11y-correct without JS state machinery. Reveal
 * is instant (no height tween), which is the reduced-motion-safe, information-
 * bearing default the contract demands; any optional easing a consumer adds is
 * already neutralised by the tokens' `@media (prefers-reduced-motion)` block.
 *
 * Supports both modes:
 *  - uncontrolled: `defaultOpen` seeds the initial state, native toggling owns it.
 *  - controlled:  `open` makes the consumer authoritative; we report intended
 *                 changes via `onOpenChange` and reconcile the DOM back to the
 *                 prop so it can never drift from the controlled value.
 */

/** Effective open state: the controlled `open` prop wins; else internal state. */
function resolveOpen(open: boolean | undefined, internalOpen: boolean): boolean {
  return open === undefined ? internalOpen : open
}

export interface CollapsibleProps
  extends Omit<ComponentPropsWithoutRef<'details'>, 'open' | 'onToggle'> {
  /** Controlled open state. When provided, the consumer owns open/close. */
  open?: boolean
  /** Initial open state for uncontrolled usage. Ignored when `open` is set. */
  defaultOpen?: boolean
  /** Fired with the next intended open state on any user toggle. */
  onOpenChange?: (open: boolean) => void
  children?: ReactNode
}

export const Collapsible = forwardRef<HTMLDetailsElement, CollapsibleProps>(
  function Collapsible(
    { open, defaultOpen = false, onOpenChange, children, ...rest },
    forwardedRef,
  ) {
    const isControlled = open !== undefined
    const [internalOpen, setInternalOpen] = useState(defaultOpen)
    const effectiveOpen = resolveOpen(open, internalOpen)

    const innerRef = useRef<HTMLDetailsElement | null>(null)
    const setRefs = useCallback(
      (node: HTMLDetailsElement | null) => {
        innerRef.current = node
        if (typeof forwardedRef === 'function') forwardedRef(node)
        else if (forwardedRef) forwardedRef.current = node
      },
      [forwardedRef],
    )

    // Reconcile the DOM back to the controlled prop. Native <details> flips its
    // own `open` attribute on a summary click before React re-renders; when the
    // prop value is unchanged React skips the attribute write, so the element
    // would drift. Force it back here so the controlled value is authoritative.
    useEffect(() => {
      if (!isControlled) return
      const el = innerRef.current
      if (el && el.open !== open) el.open = open as boolean
    })

    const handleToggle = useCallback(
      (event: SyntheticEvent<HTMLDetailsElement>) => {
        const next = event.currentTarget.open
        if (!isControlled) setInternalOpen(next)
        if (next !== effectiveOpen) onOpenChange?.(next)
      },
      [isControlled, effectiveOpen, onOpenChange],
    )

    return (
      <details
        ref={setRefs}
        open={effectiveOpen}
        onToggle={handleToggle}
        {...rest}
      >
        {children}
      </details>
    )
  },
)

export interface CollapsibleTriggerProps extends ComponentPropsWithoutRef<'summary'> {
  children?: ReactNode
}

export const CollapsibleTrigger = forwardRef<HTMLElement, CollapsibleTriggerProps>(
  function CollapsibleTrigger({ className, children, ...rest }, ref) {
    return (
      <summary
        ref={ref}
        className={['carto-collapsible__trigger', className].filter(Boolean).join(' ')}
        {...rest}
      >
        {children}
      </summary>
    )
  },
)

export interface CollapsibleContentProps extends ComponentPropsWithoutRef<'div'> {
  children?: ReactNode
}

export const CollapsibleContent = forwardRef<HTMLDivElement, CollapsibleContentProps>(
  function CollapsibleContent({ className, children, ...rest }, ref) {
    return (
      <div
        ref={ref}
        className={['carto-collapsible__content', className].filter(Boolean).join(' ')}
        {...rest}
      >
        {children}
      </div>
    )
  },
)
