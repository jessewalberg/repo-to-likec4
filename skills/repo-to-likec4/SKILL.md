---
name: repo-to-likec4
description: >-
  Generate beautiful, accurate architecture diagrams for any code repository
  using LikeC4. Use this whenever the user wants to visualize, diagram, map,
  document, or "see" the architecture of a codebase, microservices, a system,
  or a repo — including system context, container/service maps, component
  breakdowns, request/sequence flows, data flow, deployment topology, or
  dependency graphs. Trigger this even when the user just says "draw the
  architecture", "how does this repo fit together", "make me a diagram of
  this codebase", or hands over a repo and asks what it does, and even if they
  do not say the words "LikeC4" or "C4". Produces a validated, version-control-
  friendly .c4 model plus a set of rendered views (PNG/SVG/interactive site).
---

# Repo → LikeC4 architecture diagrams

Turn a repository into a single LikeC4 **model** and a curated set of **views**
(diagrams). The whole point of LikeC4: model the system once, then project many
views from it cheaply. So most of the work is building one good model; the
diagrams are then near-free predicates over it, and they never drift from each
other.

## The one principle that makes this work

**Extract the architecture; do not feed the code.** Architecture lives at the
*boundaries and edges* of a codebase — entry points, module/package seams,
calls between services, datastores, queues, and third-party integrations — not
inside function bodies. A 5k-line and a 500k-line repo can have the same
diagram. So:

> Never try to "compress" or summarize source files to fit a context window.
> Instead run a cheap, deterministic **recon pass** that throws away
> implementation and keeps structure + relationships, writing it to an
> `ARCHITECTURE-FACTS.md` manifest. Build the model from the manifest, not from
> the source.

This is what answers the "codebase is too big" problem. The manifest *is* the
compression — semantic and lossless **for diagramming purposes** — and it's
small even when the repo is huge, deterministic, and reviewable by a human
before any diagram is drawn.

**When to chunk (and how):** chunk only along **architectural seams**, never by
token windows, and only when even the *structure* is too large to model in one
pass (a real monorepo / many independent services). LikeC4 is built for this:
put one `.c4` file per service/package and let LikeC4 merge them into one model
(`extend` re-opens an element defined elsewhere; a `likec4.config.json` per
folder makes a separate project). Decision rule:

| Repo shape | Approach |
|---|---|
| Single app / a handful of modules | One model, files split by concern (`model.c4`, `views.c4`). No chunking. |
| Monorepo, 3–15 services | One project, **one `.c4` file per service**, merged. Recon each service in turn. |
| 15+ services / multiple domains | Multiple LikeC4 **projects** (folder + `likec4.config.json` each), linked via `import`. Generate per-domain, plus one landscape. |

Never split a single module across chunks. Follow the seams the codebase
already has.

## Workflow

### Phase 0 — Set up
1. Read `references/dsl-cheatsheet.md` (syntax — avoid hallucinating DSL) and
   `references/styling-conventions.md` (the rules that make output *beautiful*).
2. Create a `likec4/` dir in the repo. Copy `assets/specification.c4` and
   `assets/likec4.config.json` into it. The spec pre-styles every element kind
   (icons, shapes, semantic colors, legend) so you don't restyle per repo.

### Phase 1 — Recon (cheap, deterministic, no guessing)
Follow `references/extraction-playbook.md`. Detect the stack, then harvest the
*structure*, not the code:
- Skeleton: `git ls-files`, directory tree, workspace/package manifests.
- Edges: imports between modules, HTTP/RPC clients, DB clients, queue
  producers/consumers, env vars pointing at external services.
- Boundaries: entry points (HTTP routes, CLI, cron, webhooks, message
  handlers), datastores, third-party SDKs.
- Intent: README + a peek at top-level package descriptions for good titles.

High-signal files to always check: `docker-compose.yml` and `k8s/` (they
literally declare services and their links), `.env.example` (reveals external
integrations), `package.json` workspaces / `go.mod` / `pyproject.toml` /
`Cargo.toml`. Use language dep-graph tools where present (`madge`, `grimp`,
`go list`, `cargo-modules`, `jdeps`) — they give edges for free.

**Write everything to `likec4/ARCHITECTURE-FACTS.md`** using
`references/extraction-playbook.md`'s manifest template: the element list (with
kind, purpose, tech, icon), the edge list (source → target, kind, label), the
external systems, and the 3–5 most important runtime flows. **Pause here if the
repo is unfamiliar** — let the human sanity-check the manifest before you draw.

### Phase 2 — Model
Translate the manifest into LikeC4 in `likec4/model.c4` (or one file per service
for monorepos). Map each fact to a pre-styled kind from the spec (see the
mapping table in the extraction playbook). Give every element a `title`, a
one-line `description`, a `technology`, and an `icon` (use bundled `tech:`,
`aws:`, `gcp:`, `azure:` packs — this is the biggest single quality lever). Use
relationship **kinds** (`sync`/`async`/`reads`/`writes`/`dep`) so edges are
self-explanatory. Tag entry points `#public`, third parties `#external`, and any
PII/auth path `#pii`.

### Phase 3 — Views
Apply `references/view-recipes.md`. Don't invent views ad hoc — pick from the
catalog based on what the repo actually has:
- **Always:** System Context + Container/Service map.
- **Per significant service:** a Component view, wired with `navigateTo` so the
  container diagram drills down into it.
- **3–5 key flows:** dynamic (sequence) views for the most important use cases.
- **Where applicable:** Data/persistence, External-integrations (trust
  boundary), Deployment (if compose/k8s/terraform exists), Domain map, and
  cheap tag-overlay views (`#deprecated`, `#pii`, per-team).

All views are predicates over the one model, so producing eight costs barely
more than one. Keep each view at the right **altitude** (Context ≈ 5–9 nodes;
never cram) — the #1 cause of ugly diagrams is too many nodes/edges in one view.
Use scoped views + drill-down instead of one mega-diagram.

### Phase 4 — Validate & render
```sh
cd likec4
npx likec4 validate                      # syntax + layout-drift check; fix all errors
npx likec4 serve                         # live interactive preview (hot reload) while iterating
npx likec4 build -o ../dist              # static interactive site (Share links per view)
npx likec4 export png  -o ../diagrams --theme dark      # high-res PNGs (also: jpg)
npx likec4 gen mermaid                   # optional: Mermaid/D2/PlantUML for embedding in docs
```
Iterating later means editing predicates, not redrawing — that's the payoff of a
model over hand-drawn diagrams.

## What you deliver
```
likec4/
  likec4.config.json          # theme/project config
  specification.c4            # the pre-styled vocabulary + legend
  ARCHITECTURE-FACTS.md       # the recon manifest (human-reviewable source of truth)
  model.c4                    # (or one *.c4 per service) the elements + relationships
  views.c4                    # the curated diagrams
diagrams/                     # rendered PNG/SVG per view
dist/                         # optional: static interactive site
```

## Definition of done (quality bar)
- `likec4 validate` passes clean.
- Every element has title + description + technology + icon. No bare boxes.
- Colors/shapes follow the semantics in `specification.c4` consistently.
- A reader who has never seen the repo can answer "what is this, what are its
  parts, what does it talk to, and what happens in the main flow" from the
  Context + Container + one flow view alone.
- Views are uncluttered; drill-down via `navigateTo` rather than one huge graph.

## Optional power-up: keep it queryable
After generating, suggest wiring the LikeC4 **MCP server** (`npx -y @likec4/mcp`,
or the VS Code extension's built-in server) so the user can later ask the model
natural-language questions ("list everything that writes to the payments DB",
"what crosses the trust boundary") and extend it conversationally. See
`references/dsl-cheatsheet.md` → Tooling.

## Reference files
- `references/extraction-playbook.md` — per-language recon commands, signal→element mapping, the manifest template. **Read in Phase 1.**
- `references/view-recipes.md` — the catalog of diagram types with predicate patterns and examples. **Read in Phase 3.**
- `references/dsl-cheatsheet.md` — condensed LikeC4 syntax + CLI. **Read in Phase 0; consult while writing `.c4`.**
- `references/styling-conventions.md` — the aesthetic rules. **Read in Phase 0; obey throughout.**
- `references/EXAMPLE.c4` — a complete, validated spec+model+views in one file. Pattern-match against it when writing `.c4`; it's known-good.
