import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseDoc } from './doc.ts'

test('parseDoc: strips leading YAML frontmatter and returns the body', () => {
  const raw = '---\nnode: module:x\nprovenance: machine\npinned: false\n---\n\n# Title\n\nBody text.'
  const doc = parseDoc(raw)
  assert.equal(doc.frontmatter?.node, 'module:x')
  assert.equal(doc.frontmatter?.provenance, 'machine')
  assert.match(doc.body, /^# Title/, 'body starts after the frontmatter')
  assert.ok(!doc.body.includes('provenance:'), 'no frontmatter leaks into the body')
})

test('parseDoc: a page with no frontmatter is returned verbatim', () => {
  const doc = parseDoc('# Just markdown\n\nhi')
  assert.equal(doc.frontmatter, undefined)
  assert.match(doc.body, /^# Just markdown/)
})
