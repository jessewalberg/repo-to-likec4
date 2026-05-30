import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { cn } from '../../lib/cn'

/* ============================================================================
   leanSidebar — hand-authored sidebar primitives for the single-file build.
   Avoids shadcn's Sheet/Tooltip/Skeleton. CONTRACT §2/§7.
   ========================================================================== */

const DEFAULT_WIDTH = 272
const MIN_WIDTH = 220
const MAX_WIDTH = 360
const RAIL_WIDTH = 48

const KEY_OPEN = 'carto.sb.open'
const KEY_WIDTH = 'carto.sb.width'

function clampWidth(w: number): number {
  if (!Number.isFinite(w)) return DEFAULT_WIDTH
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(w)))
}

function readStoredOpen(fallback: boolean): boolean {
  try {
    const raw = window.localStorage.getItem(KEY_OPEN)
    if (raw === null) return fallback
    return raw !== 'false'
  } catch {
    return fallback
  }
}

function readStoredWidth(fallback: number): number {
  try {
    const raw = window.localStorage.getItem(KEY_WIDTH)
    if (raw === null) return fallback
    return clampWidth(Number(raw))
  } catch {
    return fallback
  }
}

interface SidebarContextValue {
  open: boolean
  setOpen: (open: boolean) => void
  toggle: () => void
  width: number
  setWidth: (width: number) => void
}

const SidebarContext = createContext<SidebarContextValue | null>(null)

/** Hook into the surrounding SidebarProvider. Throws if used outside. */
export function useSidebar(): SidebarContextValue {
  const ctx = useContext(SidebarContext)
  if (!ctx) {
    throw new Error('useSidebar must be used within a <SidebarProvider>')
  }
  return ctx
}

export interface SidebarProviderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Initial open state on the very first mount (before localStorage). */
  defaultOpen?: boolean
  /** Initial width (px) before any stored value or drag. */
  defaultWidth?: number
}

/**
 * Holds open(bool) + width(number) in React context, persists to localStorage
 * (carto.sb.open / carto.sb.width) and toggles open on Cmd/Ctrl-B globally.
 */
export function SidebarProvider({
  defaultOpen = true,
  defaultWidth = DEFAULT_WIDTH,
  className,
  children,
  ...rest
}: SidebarProviderProps) {
  const initialWidth = clampWidth(defaultWidth)
  // Lazy initializer reads localStorage exactly once, file://-safe.
  const [open, setOpenState] = useState<boolean>(() => readStoredOpen(defaultOpen))
  const [width, setWidthState] = useState<number>(() => readStoredWidth(initialWidth))

  const setOpen = useCallback((next: boolean) => {
    setOpenState(next)
    try {
      window.localStorage.setItem(KEY_OPEN, next ? 'true' : 'false')
    } catch {
      /* private mode / file:// — state still lives in memory. */
    }
  }, [])

  const toggle = useCallback(() => {
    setOpenState((prev) => {
      const next = !prev
      try {
        window.localStorage.setItem(KEY_OPEN, next ? 'true' : 'false')
      } catch {
        /* ignore persistence failure */
      }
      return next
    })
  }, [])

  const setWidth = useCallback((next: number) => {
    const clamped = clampWidth(next)
    setWidthState(clamped)
    try {
      window.localStorage.setItem(KEY_WIDTH, String(clamped))
    } catch {
      /* ignore persistence failure */
    }
  }, [])

  // Global ⌘/Ctrl-B toggle. Ignored while typing in a field.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey)) return
      if (e.key !== 'b' && e.key !== 'B') return
      const target = e.target as HTMLElement | null
      if (target) {
        const tag = target.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) {
          return
        }
      }
      e.preventDefault()
      toggle()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [toggle])

  const value = useMemo<SidebarContextValue>(
    () => ({ open, setOpen, toggle, width, setWidth }),
    [open, setOpen, toggle, width, setWidth],
  )

  return (
    <SidebarContext.Provider value={value}>
      <div className={cn('carto-sb__provider', className)} {...rest}>
        {children}
      </div>
    </SidebarContext.Provider>
  )
}

/* --- ResizeHandle: pointer-drag the right edge (220–360px) ----------------- */

function ResizeHandle() {
  const { width, setWidth } = useSidebar()
  const widthRef = useRef(width)
  widthRef.current = width
  const draggingRef = useRef(false)

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault()
      draggingRef.current = true
      const startX = e.clientX
      const startWidth = widthRef.current
      const el = e.currentTarget
      el.setPointerCapture(e.pointerId)

      const onMove = (ev: PointerEvent) => {
        if (!draggingRef.current) return
        setWidth(startWidth + (ev.clientX - startX))
      }
      const onUp = () => {
        draggingRef.current = false
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [setWidth],
  )

  // Keyboard fallback so the affordance is operable without a pointer.
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setWidth(widthRef.current - (e.shiftKey ? 24 : 8))
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        setWidth(widthRef.current + (e.shiftKey ? 24 : 8))
      }
    },
    [setWidth],
  )

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar"
      aria-valuenow={width}
      aria-valuemin={MIN_WIDTH}
      aria-valuemax={MAX_WIDTH}
      tabIndex={0}
      className="carto-sb__resize"
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
    />
  )
}

export interface SidebarProps extends React.HTMLAttributes<HTMLElement> {
  /** Width (px) to use as the open-state default before context/drag. */
  defaultWidth?: number
}

/**
 * The aside shell. Width tracks context (resizable 220–360); collapses to a
 * 48px icon rail when closed. bg --canvas, 1px --divider right, NO shadow.
 */
export function Sidebar({ className, style, children, defaultWidth, ...rest }: SidebarProps) {
  const { open, width } = useSidebar()
  const openWidth = open ? clampWidth(width || defaultWidth || DEFAULT_WIDTH) : RAIL_WIDTH

  return (
    <aside
      data-state={open ? 'expanded' : 'collapsed'}
      className={cn('carto-sb__aside relative flex h-full shrink-0 flex-col', className)}
      style={{
        width: openWidth,
        background: 'var(--canvas)',
        borderRight: '1px solid var(--divider)',
        ...style,
      }}
      {...rest}
    >
      {children}
      {open ? <ResizeHandle /> : null}
    </aside>
  )
}

export type SidebarContentProps = React.HTMLAttributes<HTMLDivElement>

/** Vertical scroll area for the nav tree. */
export function SidebarContent({ className, ...rest }: SidebarContentProps) {
  return (
    <div
      className={cn('carto-sb__content min-h-0 flex-1 overflow-y-auto overflow-x-hidden', className)}
      {...rest}
    />
  )
}

export type SidebarGroupLabelProps = React.HTMLAttributes<HTMLDivElement>

/** The one typographic eyebrow: UPPERCASE, --fs-xs, --fw-semibold, wide, subtle. */
export function SidebarGroupLabel({ className, style, ...rest }: SidebarGroupLabelProps) {
  return (
    <div
      className={cn('carto-sb__eyebrow flex items-center px-3 py-1.5 uppercase select-none', className)}
      style={{
        fontSize: 'var(--fs-xs)',
        fontWeight: 'var(--fw-semibold)',
        letterSpacing: 'var(--tracking-wide)',
        color: 'var(--text-subtle)',
        ...style,
      }}
      {...rest}
    />
  )
}

export interface SidebarMenuButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Active row: --n-100 fill + 2px --focus-ring-color left bar. */
  isActive?: boolean
}

/**
 * A 28px row button. --fs-sm. isActive -> --n-100 bg + 2px accent left bar.
 * Focus-visible ring is provided by the scoped CSS below.
 */
export function SidebarMenuButton({
  className,
  style,
  isActive = false,
  type,
  children,
  ...rest
}: SidebarMenuButtonProps) {
  return (
    <button
      type={type ?? 'button'}
      data-active={isActive ? 'true' : undefined}
      aria-current={isActive ? 'true' : undefined}
      className={cn(
        'carto-sb__menu-btn flex w-full items-center gap-2 truncate text-left',
        className,
      )}
      style={{
        fontSize: 'var(--fs-sm)',
        color: isActive ? 'var(--text-strong)' : 'var(--text-muted)',
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  )
}

export interface SidebarTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

/**
 * The toggle button. Calls toggle() and also forwards any caller onClick.
 * Caller supplies the icon as children.
 */
export function SidebarTrigger({ className, onClick, children, type, ...rest }: SidebarTriggerProps) {
  const { toggle, open } = useSidebar()
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(e)
      if (!e.defaultPrevented) toggle()
    },
    [onClick, toggle],
  )
  return (
    <button
      type={type ?? 'button'}
      aria-label={open ? 'Collapse sidebar' : 'Expand sidebar'}
      aria-expanded={open}
      className={cn('carto-sb__trigger inline-flex items-center justify-center', className)}
      onClick={handleClick}
      {...rest}
    >
      {children}
    </button>
  )
}
