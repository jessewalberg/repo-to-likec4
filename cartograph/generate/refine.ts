import type { Manifest } from './schema.ts'

// view-refine: author each node's prose (a one-line `summary` for the card/panel +
// a markdown `description` -> its pages/**.md doc page) FROM THE MANIFEST, never raw
// source dumped into the model. The LLM call is injected (a `Refiner`), so the
// deterministic parts — what to ask for, and how the answer folds back into the
// manifest + pages — are pure and testable. The default refiner (refine-cli.ts)
// shells out to the `claude` CLI, so this module stays dependency-free.
//
// Provenance: prose is LLM-owned (machine). A human edit flips that field to
// 'human' and the three-way merge then protects it on the next refine.

export interface RefineRequest {
  nodeId: string
  label: string
  kind: string // node.type, e.g. 'component' | 'container'
  technology?: string
  path?: string
  imports: string[] // labels this node depends on (out-neighbors)
  importedBy: string[] // labels that depend on this node (in-neighbors)
}

export interface Refinement {
  nodeId: string
  summary: string // one terse line (node face / panel)
  description: string // markdown body for the doc page
}

export type Refiner = (req: RefineRequest) => Promise<Refinement>

const labelOf = (m: Manifest, id: string) => m.nodes[id]?.data.label ?? id

/** Build a refine request per node that lacks a human-authored summary. */
export function buildRefineRequests(manifest: Manifest): RefineRequest[] {
  const out: RefineRequest[] = []
  for (const n of Object.values(manifest.nodes)) {
    // Skip nodes whose summary a human already owns — the merge protects those.
    if (n.data.summary && n.data.provenance?.summary === 'human') continue
    const imports: string[] = []
    const importedBy: string[] = []
    for (const e of Object.values(manifest.edges)) {
      if (e.source === n.id) imports.push(labelOf(manifest, e.target))
      if (e.target === n.id) importedBy.push(labelOf(manifest, e.source))
    }
    out.push({
      nodeId: n.id,
      label: n.data.label,
      kind: n.type,
      technology: n.data.technology,
      path: typeof n.data.metadata?.path === 'string' ? n.data.metadata.path : undefined,
      imports,
      importedBy,
    })
  }
  return out
}

export interface ApplyResult {
  manifest: Manifest
  /** docRef -> markdown page content (frontmatter + body). */
  pages: Record<string, string>
}

/** Fold refinements into the manifest (summary on the node) + emit the doc pages. */
export function applyRefinements(manifest: Manifest, refinements: Refinement[]): ApplyResult {
  const nodes = { ...manifest.nodes }
  const pages: Record<string, string> = {}

  for (const r of refinements) {
    const n = nodes[r.nodeId]
    if (!n) continue
    // Don't clobber a human-owned summary (defence in depth; builder already skips).
    const summaryIsHuman = n.data.provenance?.summary === 'human'
    const provenance = { ...(n.data.provenance ?? {}) }
    if (!summaryIsHuman) provenance.summary = 'machine' // mark LLM-authored so a later human edit can flip it
    nodes[r.nodeId] = {
      ...n,
      data: {
        ...n.data,
        summary: summaryIsHuman ? n.data.summary : r.summary,
        provenance,
      },
    }
    const docRef = n.data.doc
    if (docRef && r.description.trim()) {
      pages[docRef] = renderPage(n.data.label, r.description, n.id)
    }
  }

  return { manifest: { ...manifest, nodes }, pages }
}

/** True if an existing doc page is human-owned (frontmatter provenance:human or
 * pinned:true) and must NOT be overwritten by a refine run. */
export function pageIsHumanOwned(content: string): boolean {
  const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!m) return false
  return /^\s*provenance\s*:\s*human\s*$/im.test(m[1]) || /^\s*pinned\s*:\s*true\s*$/im.test(m[1])
}

/** A doc page: machine-provenance frontmatter + the authored body. */
export function renderPage(title: string, body: string, nodeId: string): string {
  const fm = ['---', `node: ${nodeId}`, 'provenance: machine', 'pinned: false', '---', ''].join('\n')
  const heading = body.trimStart().startsWith('#') ? '' : `# ${title}\n\n`
  return `${fm}${heading}${body.trim()}\n`
}

/** Orchestrate: ask the refiner for prose per node, then fold it in. Concurrency-bounded. */
export async function refineModel(
  manifest: Manifest,
  refiner: Refiner,
  opts: { concurrency?: number } = {},
): Promise<ApplyResult> {
  const requests = buildRefineRequests(manifest)
  const concurrency = Math.max(1, opts.concurrency ?? 6)
  const refinements: Refinement[] = []

  for (let i = 0; i < requests.length; i += concurrency) {
    const batch = requests.slice(i, i + concurrency)
    const settled = await Promise.all(
      batch.map((req) => refiner(req).then((r) => ({ ok: true as const, r })).catch(() => ({ ok: false as const }))),
    )
    for (const s of settled) if (s.ok) refinements.push(s.r)
  }

  return applyRefinements(manifest, refinements)
}
