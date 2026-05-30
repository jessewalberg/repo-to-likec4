import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { reconModuleGraph } from './recon.ts'

function repo(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'carto-recon-'))
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(root, rel)
    mkdirSync(join(abs, '..'), { recursive: true })
    writeFileSync(abs, content)
  }
  return root
}

const edgeIds = (m: ReturnType<typeof reconModuleGraph>) => Object.keys(m.edges)
const hasEdge = (m: ReturnType<typeof reconModuleGraph>, from: string, to: string) =>
  edgeIds(m).includes(`imports:module:r/${from}->module:r/${to}`)

test('recon JS/TS: relative imports resolve precisely (confidence static)', () => {
  const root = repo({ 'a.js': "import './b.js'\nimport './sub/c'", 'b.js': 'export const b=1', 'sub/c.js': 'export const c=1' })
  try {
    const m = reconModuleGraph(root, { idPrefix: 'r' })
    assert.ok(hasEdge(m, 'a.js', 'b.js'), 'a -> b')
    assert.ok(hasEdge(m, 'a.js', 'sub/c.js'), 'extensionless ./sub/c resolved to sub/c.js')
    assert.equal(m.edges['imports:module:r/a.js->module:r/b.js'].confidence, 'static')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('recon Python: relative + absolute dotted imports resolve; externals ignored (confidence inferred)', () => {
  const root = repo({
    'pkg/__init__.py': '',
    'pkg/a.py': 'import os\nfrom .b import thing\nfrom pkg.c import other\n',
    'pkg/b.py': 'x=1',
    'pkg/c.py': 'y=2',
  })
  try {
    const m = reconModuleGraph(root, { idPrefix: 'r' })
    assert.ok(hasEdge(m, 'pkg/a.py', 'pkg/b.py'), 'from .b -> sibling b.py')
    assert.ok(hasEdge(m, 'pkg/a.py', 'pkg/c.py'), 'from pkg.c -> pkg/c.py')
    assert.ok(!edgeIds(m).some((e) => e.includes('os')), 'external import os ignored')
    assert.equal(m.edges['imports:module:r/pkg/a.py->module:r/pkg/b.py'].confidence, 'inferred')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('recon Go: module-relative imports link to the target package files (confidence inferred)', () => {
  const root = repo({
    'go.mod': 'module example.com/app\n\ngo 1.22\n',
    'main.go': 'package main\nimport (\n\t"fmt"\n\t"example.com/app/lib"\n)\n',
    'lib/dag.go': 'package lib',
    'lib/util.go': 'package lib',
  })
  try {
    const m = reconModuleGraph(root, { idPrefix: 'r' })
    assert.ok(hasEdge(m, 'main.go', 'lib/dag.go'), 'main -> lib/dag.go (package import)')
    assert.ok(hasEdge(m, 'main.go', 'lib/util.go'), 'main -> lib/util.go (whole package)')
    assert.ok(!edgeIds(m).some((e) => e.includes('fmt')), 'stdlib fmt ignored')
    assert.equal(m.edges['imports:module:r/main.go->module:r/lib/dag.go'].confidence, 'inferred')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('recon: empty idPrefix (whole-repo) -> root-relative ids + paths (no phantom segment)', () => {
  const root = repo({ 'src/a.ts': "import './b'", 'src/b.ts': 'export const b=1' })
  try {
    const m = reconModuleGraph(root, { idPrefix: '' })
    assert.ok(m.nodes['module:src/a.ts'], 'id is module:<repo-relative>, no prefix segment')
    assert.equal(m.nodes['module:src/a.ts'].data.metadata?.path, 'src/a.ts', 'path is repo-root-relative')
    assert.ok(m.edges['imports:module:src/a.ts->module:src/b.ts'], 'edge resolves with empty prefix')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('recon Python: `from . import b` links to the sibling submodule, not the package init', () => {
  const root = repo({ 'pkg/__init__.py': '', 'pkg/a.py': 'from . import b\n', 'pkg/b.py': 'x=1' })
  try {
    const m = reconModuleGraph(root, { idPrefix: 'r' })
    assert.ok(hasEdge(m, 'pkg/a.py', 'pkg/b.py'), 'from . import b -> pkg/b.py (the submodule)')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('recon Ruby: require_relative resolves to the sibling .rb', () => {
  const root = repo({ 'a.rb': "require_relative './b'", 'b.rb': '# b' })
  try {
    const m = reconModuleGraph(root, { idPrefix: 'r' })
    assert.ok(hasEdge(m, 'a.rb', 'b.rb'), 'require_relative ./b -> b.rb')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
