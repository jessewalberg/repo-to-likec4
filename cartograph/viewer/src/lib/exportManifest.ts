import type { Manifest } from './types'

/**
 * Download the (edited) manifest as architecture.json so the user can commit it.
 * The engine's three-way merge then preserves these human edits on the next
 * agent re-run. Works over file:// (Blob + anchor download, no server).
 */
export function downloadManifest(manifest: Manifest, filename = 'architecture.json'): void {
  const blob = new Blob([`${JSON.stringify(manifest, null, 2)}\n`], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
