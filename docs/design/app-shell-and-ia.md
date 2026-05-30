# App shell & information architecture

**Date:** 2026-05-29
**Status:** accepted design (maintainer-directed) — extends [ADR-0001](../decisions/ADR-0001-react-flow-architecture-engine.md)
**Decision:** the viewer is a **documentation application** with a navigation **sidebar**, not just an architecture canvas. The canvas is one mode among prose docs, nested docs, and a learning track.

## The directive

The sidebar must hold **documentation, architecture, nested documentation, and learning** — and support **all three** candidate layouts at once (four fixed sections / a nestable docs tree / per-node docs+lessons). They compose into one model rather than being mutually exclusive.

## App shell

```
┌────────────┬──────────────────────────────┬────────────┐
│  SIDEBAR   │   MAIN CONTENT                │  DETAIL    │
│ (nav tree, │   Architecture view (React    │  PANEL     │
│ collapsible│   Flow)  — or —  a doc page   │ (node info,│
│ resizable) │   (MDX)  — or —  a learning   │  source    │
│            │   tour                        │  links, on │
│  📖 Docs    │                              │  canvas    │
│  🗺 Arch    │                              │  focus)    │
│  🗂 Modules │                              │            │
│  🎓 Learn   │                              │            │
└────────────┴──────────────────────────────┴────────────┘
```

Built with the shadcn `Sidebar` primitive — the **same shadcn base React Flow UI Components are built on**, so the canvas and the shell share one design system (the light OKLCH palette) instead of fighting. Main content swaps among three renderers: React Flow (architecture), an MDX renderer (doc pages), and the tour player (learning). A breadcrumb header tracks position; global search spans nodes, pages, and tours.

## How "all three" compose

| Candidate layout | How it's expressed |
|---|---|
| **A — four fixed sections** (Documentation, Architecture, Modules, Learning) | the *default* top-level arrangement of the `sidebar` tree |
| **B — documentation as a nestable tree** | any `section`/`tree` entry nests arbitrarily; collapse/expand or merge Documentation + Modules into one tree by editing `site.json` |
| **C — per-node docs + lessons** | every architecture node carries `data.doc` + `data.lesson`; the canvas surfaces them on click, and the **Modules** + **Learning** trees are auto-generated from these attachments |

C is the integrating idea: a doc that lives with a node is the **single source** that powers (1) the node's click-through panel, (2) the auto-built Modules tree in the sidebar, and (3) the page you can deep-link to — no duplication. Bidirectional via stable node IDs (`service:apps/api` ↔ `pages/modules/apps/api.md`), so links survive refactors through the same `idAliases` migration the merge already does.

## Data model — one new file + per-node attachments

The graph manifest is unchanged. Two additions make it a site:

**1. `site.json`** — the free-form, nestable sidebar tree. Entry `kind`s: `section` | `tree` | `group` | `page` | `view` | `tour`. Leaves point to a doc page, an architecture `viewId`, or a `tourId`. `tree`/`group` entries may set `source: "auto:node-docs"` / `"auto:node-lessons"` to be generated from per-node attachments.

```jsonc
{
  "schemaVersion": 1,
  "home": "view:container",                 // canvas-home (C) OR a doc page (A/B) — configurable
  "search": { "enabled": true, "index": ["nodes", "edges", "pages", "tours"] },  // ⌘K global search (app chrome)
  "sidebar": [
    { "id": "documentation", "kind": "section", "label": "Documentation", "icon": "book",
      "provenance": "machine",
      "children": [
        { "id": "overview", "kind": "page", "label": "Overview", "page": "pages/overview.md", "provenance": "machine" },
        { "id": "getting-started", "kind": "page", "label": "Getting started", "page": "pages/getting-started.md", "provenance": "human" },
        { "id": "changelog", "kind": "changelog", "label": "What changed", "feed": "changelog.json" }
      ] },
    { "id": "architecture", "kind": "section", "label": "Architecture", "icon": "map",
      "children": [
        { "id": "v-context", "kind": "view", "label": "System Context", "viewId": "context" },
        { "id": "v-container", "kind": "view", "label": "Containers", "viewId": "container" },
        { "id": "v-components", "kind": "group", "label": "Components", "children": [ /* per-container views */ ] }
      ] },
    { "id": "modules", "kind": "tree", "label": "Modules", "icon": "folder-tree",
      "source": "auto:node-docs",           // generated from node.data.doc, mirrors repo/domain structure (A+B+C)
      "children": [ /* apps/ ▸ api/ ▸ auth.md … each linked to a node id */ ] },
    { "id": "learning", "kind": "section", "label": "Learning", "icon": "graduation-cap",
      "children": [
        { "id": "t-understand", "kind": "tour", "label": "Understand the system", "tourId": "understand" },
        { "id": "t-fixbug", "kind": "tour", "label": "Fix a bug", "tourId": "fix-bug" },
        { "id": "t-feature", "kind": "tour", "label": "Add a feature", "tourId": "add-feature" },
        { "id": "per-node-lessons", "kind": "group", "label": "Per-component lessons", "source": "auto:node-lessons" }
      ] }
  ]
}
```

**2. Per-node attachments** in `architecture.json` (`node.data`): `doc` (a page ref) and `lesson` (a tour/lesson ref). These feed the auto-built sidebar trees and the canvas click affordances.

**3. `pages/`** — doc content as real nested `.md`/`.mdx` files (git-diffable, human-editable), with frontmatter:
```yaml
---
node: service:apps/api      # bidirectional cross-link to the architecture node
provenance: machine         # machine = agent regenerates; human = agent never overwrites
pinned: false
---
```

## The proven merge engine extends to all of it — no new machinery

Provenance + suppressions + `idAliases` (validated in [Phase-0](../research/phase0-findings.md)) now span **four content types**: graph nodes, edges, **doc pages, and nav entries**.
- A doc page with `provenance: human` is never overwritten by the agent (it offers a suggested-update diff instead) — same rule as a human-edited node `label`.
- A human-reordered or human-added sidebar entry survives an agent re-run; a `suppressed` entry stays hidden.
- A renamed module migrates its node, its page (`pages/modules/old.md` → `new.md`), and its nav entry together via the same alias.

## Docs are written by the same agents (per the research — not a separate step)

The doc pages are authored by the **same decomposed generation pipeline** that builds the graph. The Phase-3 **View-Refine** stage writes each node's prose (`summary`/`description`) *and* its `pages/modules/…md` page from the recon manifest — never from raw source — using schema-constrained structured output. The human can edit any page; `provenance: human` then protects it from the next agent run (a suggested-update diff is offered instead). There is no separate doc-writing tool or step: agent-authored by default, human-editable, merge-preserved — the gen-pipeline finding applied to prose.

## Search & changelog (already answered by the research)

Both fall straight out of work already specced or built, so neither is a new design problem:

- **Search** — a global ⌘K palette over nodes, edges, doc pages, and tours (app chrome, always present; the `⌕` box atop the sidebar). This is the learning-UX dimension's "search, filter, and trace-a-path." Implemented as a flat client-side index over the manifest + page frontmatter — no server.
- **Changelog ("What changed")** — a sidebar entry (`kind: "changelog"`) rendering a `changelog.json` feed. **Each agent re-run already produces the data:** the Phase-0 `MergeReport` (`added`, `mutedRemoved`, `migrated`, `suppressedSkipped`) plus page-content diffs *are* the changelog — append one dated entry per run, keyed to the recon commit. This is the update-in-place dimension's "diff two snapshots to show what changed between commits," made concrete by the merge report we already built. It turns architectural drift from invisible into a reviewable feed, and it's nearly free.

## Packaging consequence

Doc pages are committed as editable `.md` files (clean PR diffs). The self-contained `viewer.html` bundles an MDX renderer + the tour player alongside React Flow, and inlines a **snapshot** of `site.json` + pages into the data island for offline (`file://`) viewing; on GitHub Pages (http) it can read the live files. Editable source + built offline snapshot — the same dual model already chosen for the graph manifest.

## Plan impact

Phase-1 MVP grows to include the **app shell** (shadcn sidebar + main + detail panel), an MDX page renderer, the `site.json` model, per-node `doc`/`lesson` attachment (data + canvas affordance), **global ⌘K search**, and one architecture view. **Changelog** lands in Phase-2 (it's produced by the incremental merge run's `MergeReport`). Deep learning/tours, the full auto-generated nested trees, and per-component lessons land in Phase-3 (multi-view + learning UX). See ADR-0001.
