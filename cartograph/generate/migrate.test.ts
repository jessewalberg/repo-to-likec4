import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { type RepoFs, detectLikeC4Artifacts, formatMigrationNotice, removeLikeC4Artifacts } from './migrate.ts'

// A fake fs so detection logic is tested without touching disk (dependency inversion).
// `present` keys are ABSOLUTE paths (exists/read); `files` are repo-relative (list).
function fakeFs(present: Record<string, string | true>, files: string[] = []): RepoFs {
  return {
    exists: (p) => p in present,
    read: (p) => {
      const v = present[p]
      return typeof v === 'string' ? v : ''
    },
    remove: () => {
      throw new Error('remove not expected in detection tests')
    },
    list: () => files,
  }
}

// ---- detectLikeC4Artifacts (pure) ----
test('detect: likec4/ dir and the dedicated workflow are removable; a clean repo finds nothing', () => {
  const root = '/repo'
  const fs = fakeFs({
    [join(root, 'likec4')]: true,
    [join(root, '.github', 'workflows', 'likec4-pages.yml')]: true,
  }, ['likec4/model.c4', 'src/app.ts'])
  const found = detectLikeC4Artifacts(root, fs)
  // model.c4 lives under the removable likec4/ dir, so it isn't listed separately.
  assert.deepEqual(found.removable, ['.github/workflows/likec4-pages.yml', 'likec4'])
  assert.deepEqual(found.manual, [])

  assert.deepEqual(detectLikeC4Artifacts(root, fakeFs({})), { removable: [], manual: [] }, 'clean repo: nothing')
})

test('detect: stray .c4 / .likec4 / likec4.config.json anywhere are removable (broadened)', () => {
  const root = '/repo'
  const fs = fakeFs({}, ['docs/arch/model.c4', 'specification.likec4', 'config/likec4.config.json', 'src/index.ts'])
  const found = detectLikeC4Artifacts(root, fs)
  assert.deepEqual(found.removable, ['config/likec4.config.json', 'docs/arch/model.c4', 'specification.likec4'])
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
test('formatMigrationNotice: empty when clean; phrasing reflects removed-vs-found', () => {
  assert.equal(formatMigrationNotice({ removable: [], manual: [] }, true), '', 'no notice for a clean repo')
  const removed = formatMigrationNotice({ removable: ['likec4'], manual: ['.gitlab-ci.yml'] }, true)
  assert.match(removed, /removed/)
  assert.match(removed, /deleted/)
  assert.match(removed, /\.gitlab-ci\.yml/)
  const kept = formatMigrationNotice({ removable: ['likec4'], manual: [] }, false)
  assert.match(kept, /--keep-c4/, 'when not removing, explains the opt-out')
})

// ---- removeLikeC4Artifacts (real fs integration) ----
test('remove: deletes removable artifacts (incl. stray .c4), never touches shared files', () => {
  const root = mkdtempSync(join(tmpdir(), 'cartograph-migrate-'))
  try {
    mkdirSync(join(root, 'likec4'), { recursive: true })
    writeFileSync(join(root, 'likec4', 'model.c4'), 'model {}')
    mkdirSync(join(root, '.github', 'workflows'), { recursive: true })
    writeFileSync(join(root, '.github', 'workflows', 'likec4-pages.yml'), 'name: pages')
    mkdirSync(join(root, 'docs'), { recursive: true })
    writeFileSync(join(root, 'docs', 'extra.c4'), 'specification {}') // stray .c4 outside likec4/
    writeFileSync(join(root, '.gitlab-ci.yml'), 'pages:\n  script: npx likec4 build')

    const found = detectLikeC4Artifacts(root)
    assert.ok(found.removable.includes('docs/extra.c4'), 'stray .c4 detected')
    removeLikeC4Artifacts(root, found)

    assert.equal(existsSync(join(root, 'likec4')), false, 'likec4/ dir removed')
    assert.equal(existsSync(join(root, '.github', 'workflows', 'likec4-pages.yml')), false, 'workflow removed')
    assert.equal(existsSync(join(root, 'docs', 'extra.c4')), false, 'stray .c4 removed')
    assert.equal(existsSync(join(root, '.gitlab-ci.yml')), true, 'shared CI file left for the user to edit')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
