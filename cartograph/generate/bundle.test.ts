import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PLACEHOLDER, injectData } from './bundle.ts'

const template = `<html><body><script type="application/json" id="cartograph-data">${PLACEHOLDER}</script></body></html>`

test('injectData: swaps the placeholder for the JSON payload', () => {
  const out = injectData(template, { architecture: { nodes: {} }, site: { sidebar: [] }, changelog: { entries: [] }, pages: {} })
  assert.ok(!out.includes(PLACEHOLDER), 'placeholder consumed')
  assert.ok(out.includes('"architecture"') && out.includes('"sidebar"'), 'payload embedded')
})

test('injectData: throws if the template lacks the placeholder', () => {
  assert.throws(() => injectData('<html></html>', { architecture: {}, site: {}, changelog: {}, pages: {} }), /placeholder/)
})

test('injectData: escapes </ so embedded markup cannot close the script tag early', () => {
  const out = injectData(template, { architecture: { x: '</script><script>alert(1)</script>' }, site: {}, changelog: {}, pages: {} })
  assert.ok(!out.includes('</script><script>alert(1)'), 'no raw </script> from the payload')
  assert.ok(out.includes('<\\/script>'), 'closing slashes escaped')
})

test('injectData: payload with $ sequences is inserted verbatim (no String.replace $-expansion)', () => {
  const out = injectData(template, { architecture: { price: '$5 for $&each $$' }, site: {}, changelog: {}, pages: {} })
  assert.ok(out.includes('$5 for $&each $$'), 'dollar sequences survive intact')
})
