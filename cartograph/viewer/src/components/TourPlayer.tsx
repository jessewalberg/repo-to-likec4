import { ChevronLeft, ChevronRight, GraduationCap, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Tour } from '../lib/types'

// CONTRACT §13 (learning UX). A guided step-through: each step focuses its node
// via the host's selection machinery (which routes to the right view, selects the
// node, and the neighbour-fan dims everything else), while this floating card
// shows the prose + Prev/Next/Exit. Keyboard: ←/→ navigate, Esc exits.

interface TourPlayerProps {
  tour: Tour
  /** Focus a node (or clear, for intro steps) — the host selects + centers it. */
  onFocus: (nodeId: string | null) => void
  onExit: () => void
}

export function TourPlayer({ tour, onFocus, onExit }: TourPlayerProps): React.ReactElement | null {
  const [i, setI] = useState(0)

  // onFocus identity changes as the host's route/selection state changes; hold it
  // in a ref so focusing on step-change can't loop.
  const focusRef = useRef(onFocus)
  focusRef.current = onFocus

  // Reset to the first step whenever the tour changes.
  useEffect(() => setI(0), [tour])

  // Focus the current step's node on step change.
  useEffect(() => {
    focusRef.current(tour.steps[i]?.nodeId ?? null)
  }, [i, tour])

  const step = tour.steps[i]
  const last = i >= tour.steps.length - 1
  const prev = useCallback(() => setI((x) => Math.max(0, x - 1)), [])
  // Decide finish OUTSIDE the updater — state updaters must be pure (StrictMode
  // double-invokes them), and onExit triggers a parent setState.
  const next = useCallback(() => {
    if (last) onExit()
    else setI((x) => Math.min(tour.steps.length - 1, x + 1))
  }, [last, onExit, tour.steps.length])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') next()
      else if (e.key === 'ArrowLeft') prev()
      else if (e.key === 'Escape') onExit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, prev, onExit])

  if (!step) return null

  return (
    <div className="carto-tour" role="dialog" aria-label={`Tour: ${tour.title}`} aria-modal="false">
      <div className="carto-tour__card" aria-live="polite">
        <div className="carto-tour__head">
          <span className="carto-tour__eyebrow">
            <GraduationCap size={13} strokeWidth={2} aria-hidden="true" />
            {tour.title}
          </span>
          <button type="button" className="carto-tour__close" onClick={onExit} aria-label="Exit tour">
            <X size={15} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
        <h2 className="carto-tour__title">{step.title}</h2>
        <p className="carto-tour__body">{step.body}</p>
        <div className="carto-tour__foot">
          <span className="carto-tour__count">
            {i + 1} / {tour.steps.length}
          </span>
          <div className="carto-tour__nav">
            <button type="button" className="carto-tour__btn" onClick={prev} disabled={i === 0}>
              <ChevronLeft size={15} strokeWidth={2} aria-hidden="true" />
              Back
            </button>
            <button type="button" className="carto-tour__btn carto-tour__btn--next" onClick={next}>
              {last ? 'Finish' : 'Next'}
              {last ? null : <ChevronRight size={15} strokeWidth={2} aria-hidden="true" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
