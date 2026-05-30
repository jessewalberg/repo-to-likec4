import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { type RepoFs, detectLikeC4Artifacts, formatMigrationNotice, removeLikeC4Artifacts } from './migrate.ts'

// A fake fs so detection logic is tested without touching disk (dependency inversion).
function fakeFs(present: Record<string, string | true>): RepoFs {
  return {
    exists: (p) => p in present,
    read: (p) => {
      const v = present[p]
      return typeof v === 'string' ? v : ''
    },
    remove: () => {
      throw new Error('remove not expected in detection tests')
    },
  }
}

// ---- detectLikeC4Artifacts (pure) ----
test('detect: likec4/ dir and the dedicated workflow are removable; a clean repo finds nothing', () => {
  const root = '/repo'
  const fs = fakeFs({
    [join(root, 'likec4')]: true,
    [join(root, '.github', 'workflows', 'likec4-pages.yml')]: true,
  })
  const found = detectLikeC4Artifacts(root, fs)
  assert.deepEqual(found.removable.sort(), ['.github/workflows/likec4-pages.yml', 'likec4'].sort())
  assert.deepEqual(found.manual, [])

  assert.deepEqual(detectLikeC4Artifacts(root, fakeFs({})), { removable: [], manual: [] }, 'clean repo: nothing')
})

test('detect: a .gitlab-ci.yml is manual only when it actually references likec4', () => {
  const root = '/repo'
  const withLikec4 = fakeFs({ [join(root, '.gitlab-ci.yml')]: 'pages:\n  script: npx likec4 build' })
  assert.deepEqual(detectLikeC4Artifacts(root, withLikec4).manual, ['.gitlab-ci.yml'], 'shared file → manual, not removable')
  assert.deepEqual(detectLikeC4Artifacts(root, withLikec4).removable, [], 'never auto-delete a shared CI file')

  const unrelated = fakeFs({ [join(root, '.gitlab-ci.yml')]: 'test:\n  script: npm test' })
  assert.deepEqual(detectLikeC4Artifacts(root, unrelated), { removable: [], manual: [] }, 'unrelated CI file ignored')
})

// ---- formatMigrationNotice (pure) ----
test('formatMigrationNotice: empty when nothing found; lists artifacts + guidance otherwise', () => {
  assert.equal(formatMigrationNotice({ removable: [], manual: [] }), '', 'no notice for a clean repo')
  const notice = formatMigrationNotice({ removable: ['likec4'], manual: ['.gitlab-ci.yml'] })
  assert.match(notice, /likec4/)
  assert.match(notice, /\.gitlab-ci\.yml/)
  assert.match(notice, /--migrate/, 'tells the user how to remove')
})

// ---- removeLikeC4Artifacts (real fs integration) ----
test('remove: deletes removable artifacts, never touches manual/shared files', () => {
  const root = mkdtempSync(join(tmpdir(), 'cartograph-migrate-'))
  try {
    mkdirSync(join(root, 'likec4'), { recursive: true })
    writeFileSync(join(root, 'likec4', 'model.c4'), 'model {}')
    mkdirSync(join(root, '.github', 'workflows'), { recursive: true })
    writeFileSync(join(root, '.github', 'workflows', 'likec4-pages.yml'), 'name: pages')
    writeFileSync(join(root, '.gitlab-ci.yml'), 'pages:\n  script: npx likec4 build')

    const found = detectLikeC4Artifacts(root)
    removeLikeC4Artifacts(root, found)

    assert.equal(existsSync(join(root, 'likec4')), false, 'likec4/ dir removed')
    assert.equal(existsSync(join(root, '.github', 'workflows', 'likec4-pages.yml')), false, 'workflow removed')
    assert.equal(existsSync(join(root, '.gitlab-ci.yml')), true, 'shared CI file left for the user to edit')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
