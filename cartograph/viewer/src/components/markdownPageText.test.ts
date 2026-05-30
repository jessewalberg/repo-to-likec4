import assert from 'node:assert/strict'
import { test } from 'node:test'

import type { DocPage } from '../lib/types.ts'

// MarkdownPage.tsx is a render-only JSX module and this repo runs tests under bare
// `node --test` (no React-DOM renderer). Following the NodeCard / DetailPanel
// precedent (see detailPanelText.test.ts), the DOM-free decision helpers the page
// embeds are mirrored here VERBATIM and proven directly; the component keeps them
// private to honour its named-export contract (MarkdownPage, MissingPage). Keep
// the copies in lockstep.
//
// These prove CONTRACT §11 truths the renderer must obey:
//   - missing-page gate: no page OR empty/whitespace body -> MissingPage (the
//     COMMON case for the fixture, whose pages/**.md do not exist)
//   - react-markdown v9: the <code> override has NO `inline` prop; a fenced block
//     is detected by the className containing `language-`
//   - links open safely: external (http/https) -> target=_blank + safe rel; same-
//     origin/relative -> no target/rel (never an unsafe popup)

// (1) isPageMissing — the gate that keeps <Markdown> from ever seeing a non-string.
function isPageMissing(page?: DocPage): boolean {
  if (!page) return true
  if (typeof page.body !== 'string') return true
  return page.body.trim() === ''
}

// (2) isFencedCode — v9 has no `inline` prop; a fenced block is the one whose
//     className carries a `language-` token (set by the markdown grammar).
function isFencedCode(className?: string): boolean {
  return /\blanguage-[\w-]+/.test(className ?? '')
}

// (3) safeLinkAttrs — external links open in a new tab with a hardened rel; same-
//     origin/relative/anchor links stay in-tab with no rel. (Unsafe schemes like
//     javascript: are already neutralised by react-markdown's default urlTransform;
//     here we only decide the target/rel pair.)
function safeLinkAttrs(href?: string): { target?: string; rel?: string } {
  if (href && /^https?:\/\//i.test(href)) {
    return { target: '_blank', rel: 'noopener noreferrer' }
  }
  return {}
}

test('isPageMissing: no page -> missing (the fixture common case)', () => {
  assert.equal(isPageMissing(undefined), true)
})

test('isPageMissing: empty or whitespace body -> missing (never renders blank)', () => {
  assert.equal(isPageMissing({ body: '' }), true)
  assert.equal(isPageMissing({ body: '   \n\t ' }), true)
})

test('isPageMissing: a real body renders (not missing)', () => {
  assert.equal(isPageMissing({ body: '# Title\n\nReal content.' }), false)
})

test('isPageMissing: a non-string body is treated as missing (never NaN/undefined)', () => {
  assert.equal(isPageMissing({ body: undefined as unknown as string }), true)
})

test('isFencedCode: v9 detects a fenced block via the language- className', () => {
  assert.equal(isFencedCode('language-ts'), true)
  assert.equal(isFencedCode('language-js hljs'), true)
})

test('isFencedCode: inline code (no language- className) is not fenced', () => {
  assert.equal(isFencedCode(undefined), false)
  assert.equal(isFencedCode(''), false)
  assert.equal(isFencedCode('some-other-class'), false)
})

test('safeLinkAttrs: external http(s) links open in a new tab with a hardened rel', () => {
  assert.deepEqual(safeLinkAttrs('https://example.com'), {
    target: '_blank',
    rel: 'noopener noreferrer',
  })
  assert.deepEqual(safeLinkAttrs('http://example.com/x'), {
    target: '_blank',
    rel: 'noopener noreferrer',
  })
})

test('safeLinkAttrs: relative/anchor/absent links stay in-tab (no target, no rel)', () => {
  assert.deepEqual(safeLinkAttrs('#section'), {})
  assert.deepEqual(safeLinkAttrs('./other.md'), {})
  assert.deepEqual(safeLinkAttrs('/modules/cli'), {})
  assert.deepEqual(safeLinkAttrs(undefined), {})
})
