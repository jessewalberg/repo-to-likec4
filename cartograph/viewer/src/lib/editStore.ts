import { useStore } from 'zustand'
import { create } from 'zustand'
import { temporal } from 'zundo'
import {
  annotateNode,
  moveNode,
  renameNode,
  setPinned,
  setSuppressedEdge,
  setSuppressedNode,
} from './edits'
import type { Manifest } from './types'

// The working manifest + human edits, with zundo undo/redo. The viewer renders
// from `manifest` here (not the raw loaded data), so every edit is live and
// reversible. `export` serializes it back to architecture.json for the user to
// commit; the engine's three-way merge then preserves these edits on re-runs.

interface EditState {
  manifest: Manifest | null
  dirty: boolean
  init: (m: Manifest) => void
  move: (viewId: string, nodeId: string, pos: { x: number; y: number }) => void
  pin: (nodeId: string, pinned: boolean) => void
  rename: (nodeId: string, label: string) => void
  annotate: (nodeId: string, text: string) => void
  hideNode: (nodeId: string, hidden: boolean) => void
  hideEdge: (edgeId: string, hidden: boolean) => void
}

const edit = (fn: (m: Manifest) => Manifest) => (s: EditState) =>
  s.manifest ? { manifest: fn(s.manifest), dirty: true } : s

export const useEditStore = create<EditState>()(
  temporal(
    (set) => ({
      manifest: null,
      dirty: false,
      init: (m) => set({ manifest: m, dirty: false }),
      move: (viewId, nodeId, pos) => set(edit((m) => moveNode(m, viewId, nodeId, pos))),
      pin: (nodeId, pinned) => set(edit((m) => setPinned(m, nodeId, pinned))),
      rename: (nodeId, label) => set(edit((m) => renameNode(m, nodeId, label))),
      annotate: (nodeId, text) => set(edit((m) => annotateNode(m, nodeId, text))),
      hideNode: (nodeId, hidden) => set(edit((m) => setSuppressedNode(m, nodeId, hidden))),
      hideEdge: (edgeId, hidden) => set(edit((m) => setSuppressedEdge(m, edgeId, hidden))),
    }),
    // Only the manifest is time-travelled; `init` clears history (below) so undo
    // never crosses the initial load.
    { partialize: (s) => ({ manifest: s.manifest, dirty: s.dirty }) },
  ),
)

/** Seed the store and reset undo history to this baseline. */
export function initEditStore(manifest: Manifest): void {
  useEditStore.getState().init(manifest)
  useEditStore.temporal.getState().clear()
}

/** React hook: [canUndo, canRedo, undo, redo]. */
export function useUndoRedo(): { canUndo: boolean; canRedo: boolean; undo: () => void; redo: () => void } {
  const pastCount = useStore(useEditStore.temporal, (s) => s.pastStates.length)
  const futureCount = useStore(useEditStore.temporal, (s) => s.futureStates.length)
  const { undo, redo } = useEditStore.temporal.getState()
  return { canUndo: pastCount > 0, canRedo: futureCount > 0, undo: () => undo(), redo: () => redo() }
}
