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
  friendly .c4 model plus an interactive diagrams site published to GitHub Pages.
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
3. **Use LikeC4 ≥ 1.57.0** (`npx likec4@1.57.0 …`, and the CI is pinned to it).
   The features that make the diagrams good — the clickable details panel,
   relationship popovers in the *published* site, `multiple` edge-expansion, and
   `list-icons` — are all version-gated; on an older build they're silently
   absent no matter how good the `.c4` is.

### Phase 1 — Recon (cheap, deterministic, no guessing)
Follow `references/extraction-playbook.md`. Detect the stack, then harvest the
*structure*, not the code:
- Skeleton: `git ls-files`, directory tree, workspace/package manifests.
- Edges: imports between modules, HTTP/RPC clients, DB clients, queue
  producers/consumers, env vars pointing at external services.
- Boundaries: entry points (HTTP routes, CLI, cron, webhooks, message
  handlers), datastores, third-party SDKs.
- Intent: README + a peek at top-level package descriptions for good titles.
- **Source + facts (for clickable nodes):** for each element note the file/dir
  it maps to and a few facts (language, package, path, owner). Compute the repo's
  blob-URL base once (`git remote get-url origin` + branch) so every element can
  carry an absolute source `link`. This is the cheap deterministic step that
  delivers "click the box → the right code" — don't skip it.

High-signal files to always check: `docker-compose.yml` and `k8s/` (they
literally declare services and their links), `.env.example` (reveals external
integrations), `package.json` workspaces / `go.mod` / `pyproject.toml` /
`Cargo.toml`. Use language dep-graph tools where present (`madge`, `grimp`,
`go list`, `cargo-modules`, `jdeps`) — they give edges for free.

**Write everything to `likec4/ARCHITECTURE-FACTS.md`** using
`references/extraction-playbook.md`'s manifest template: the element list (with
kind, purpose, tech, icon), the edge list (source → target, kind, label), the
external systems, and the most important runtime flows.

**Then plan the diagrams (this is the adaptive step).** Read
`references/repo-archetypes.md` and reason about what this repo *is* — it's
usually several archetypes at once (e.g. web-app + API + stateful-domain). From
that, derive the diagram set that actually illuminates *this* system: the
backbone always, the flows/sequences that matter for it, and the specialized +
overlay views its signals call for. **Write the chosen diagrams into the manifest
as a "Diagram plan" with a one-line rationale each**, and flag any genuinely
useful diagram that LikeC4 can't express (state machine, ER, branching
flowchart). **Pause here if the repo is unfamiliar** — let the human review both
the facts and the diagram plan before you draw.

### Phase 2 — Model
Translate the manifest into LikeC4 in `likec4/model.c4` (or one file per service
for monorepos). Map each fact to a pre-styled kind from the spec (see the mapping
table in the extraction playbook). **Every element carries SIX things** — this is
the difference between a bare box and a clickable, source-linked node, and the
gap that made the first runs look bad:
1. **`summary`** — ONE short line; this is what shows on the node face. Keep it short.
2. **`description`** — rich triple-quoted **markdown**; shows only in the
   click-through details panel (headings, bullets, inline links all render). Put
   the long prose here, NOT on the face.
3. **`technology`** — the stack.
4. **`icon`** — the biggest visual lever. Verify the id with `likec4 list-icons`
   (validate hard-rejects a non-existent id). If a brand has no pack icon, use its
   official SVG by **absolute URL** (`icon https://brand.com/favicon.svg`) or
   `icon none` — **never** a same-named glyph from another pack (that's how
   `bootstrap:cursor`, a mouse-pointer, mislabels the Cursor editor).
5. **`link`** — one or more **absolute** source URLs (`link <blob-url> 'Source'`,
   plus labelled links to the workflow YAML / Dockerfile / OpenAPI). This is the
   user-facing payoff: click a box → the real code. Relative paths die on Pages.
6. **`metadata { … }`** — the deterministic facts from recon (path, language,
   package, loc, owner). Renders alphabetised in the panel.

Use relationship **kinds** (`sync`/`async`/`reads`/`writes`/`dep`) so edges are
self-explanatory, and give each a short verb-led title. Tag entry points
`#public`, third parties `#external`, any PII/auth path `#pii`. **`navigateTo` is
NOT an element-body property** (it fails to parse there) — set drill-down on a
relationship (`a -> b { navigateTo someFlow }`, to a *dynamic* view) or in a
view's `with { navigateTo … }`. See `references/EXAMPLE.c4` for the full pattern.

### Phase 3 — Views (the backbone + the plan you made in Phase 1)
Execute the **Diagram plan** from your manifest. `references/repo-archetypes.md`
decided *what* to draw and *why*; `references/view-recipes.md` is *how* (the
predicate pattern for each). Two non-negotiables frame the plan:

**Always produce the backbone** — a run that yields only flows is incomplete:
1. **System Context** (`view index`) — the system + people + external systems.
2. **Container / Service map** (`view of <system>`) — the runnable units and how
   they connect. The single most useful diagram — and the one that most often
   turns into an unreadable **hairball**. If any element has >5 edges in/out (a
   hub: GitHub, a gateway, a shared DB, an event bus), do NOT use a flat
   `include *`: group the spokes into named lanes, give the hub its own focused
   view, and mute it. Follow `references/view-recipes.md` §2b — it's the headline
   fix for "looks bad".
3. **A Component view per significant container**, wired with `navigateTo` for
   drill-down (whenever there's more than one container).

**Then the planned views** — the flows and specialized/overlay views your
archetype analysis selected (event choreography, command tree, data flow, domain
map, dependency graph, deployment, auth/trust-boundary, tag overlays, …). This is
where the repo-specific intelligence shows up; don't substitute a generic set.

**Sequence diagrams:** the dynamic (flow) views ARE the sequence diagrams — but
you must opt in. Three rules: (a) add **`variant sequence`** to each flow's body
so the hosted viewer defaults it to lifelines (the original skill skipped this,
so flows only ever rendered spatially); (b) author the steps between **leaf
elements** (a `service`/`component`, never a parent container with children) —
the sequence layout silently can't lay out non-leaf nodes; (c) the viewer still
toggles diagram↔sequence, embeds pin it with `dynamic-variant="sequence"`, and a
PNG export uses `likec4 export png --seq`. Leaf-level flows with `variant
sequence` give you both renderings from one definition.

All views are predicates over the one model, so producing a dozen costs barely
more than one. Keep each at the right **altitude** (Context ≈ 5–9 nodes; never
cram) and apply `references/styling-conventions.md` to *every* view. The
"looks unfinished" misses, in order of how much they hurt: (1) a hub hairball
(fix with §2b lanes + focused hub view); (2) the whole description on the node
face instead of a short `summary`; (3) `[...]` merged-edge labels (give the edge
a title or `with { multiple true }`); (4) an empty `group` box (group's
`include` must precede any `include *`); (5) missing/wrong icons; (6) not muting
the parent boundary (`style <system> { color muted  opacity 10% }`). Use scoped
views + drill-down instead of one mega-diagram.

**C4-only.** If the plan flagged a family LikeC4 can't express (state machine,
ER/data model, branching flowchart, class diagram), leave it as a ⚠️
recommendation to the human in the manifest — this skill does not generate other
formats. Still express what C4 can: a status-driven entity gets the dynamic flow
that drives its transitions, even though the state machine itself stays a note.

### Phase 4 — Validate + self-check, then publish (GitHub *or* GitLab)
```sh
cd likec4
npx likec4@1.57.0 validate    # syntax + unknown-icon + layout-drift check; fix ALL errors before publishing
npx likec4@1.57.0 serve       # optional: live interactive preview (hot reload) while iterating
```
**Self-check before publishing** (these are the defects that made the first runs
look bad — catch them now, not on the live site):
- **Render and look.** `npx likec4@1.57.0 export png -o /tmp/preview` (add `--seq`
  for the flows) and actually open the PNGs. The container map must not be a
  hairball; if it is, apply `view-recipes.md` §2b and re-render.
- **No `[...]` edges** and **no empty `group` boxes** in any view — grep the
  generated views and fix (explicit edge title / `with { multiple true }` /
  group-first ordering).
- **Every element has** a `summary`, an `icon` that's the *right* picture, and at
  least one **absolute** source `link` whose path actually exists in the repo.
- **Every flow** has `variant sequence` and uses leaf elements only.
The diagrams are published as an **interactive site on the host's Pages** — the
single supported render (no image files generated or committed). **Detect where
the user's code lives and run the matching flow** — don't hand them manual steps
when a CLI is authenticated. Detect from the remote:
```sh
git remote get-url origin    # github.com/… → GitHub;  gitlab.com or gitlab.* → GitLab
```
(or by which CLI is authed: `gh auth status` vs `glab auth status`).

**GitHub (`gh`):**
1. Copy `assets/workflows/likec4-pages.yml` → `.github/workflows/` (adjust `path:`
   if sources aren't in `./likec4`).
2. If not on GitHub yet: `gh repo create <owner>/<repo> --public --source=. --push`.
3. Enable Pages (the one manual click, automated): `gh api --method POST
   repos/<owner>/<repo>/pages -f build_type=workflow` — if it 409s, use `--method
   PUT`. Your `gh` user token can do this; don't enable it from inside the workflow
   (that needs a PAT).
4. Add the README link (see below) using `https://<owner>.github.io/<repo>/`.
5. `git add -A && git commit && git push` → CI deploys.

**GitLab (`glab`):**
1. Copy `assets/workflows/gitlab-pages.yml` → the repo root as **`.gitlab-ci.yml`**
   (if the repo already has one, merge in the `pages` job instead of overwriting).
2. If not on GitLab yet: `glab repo create <namespace>/<project> --public` then add
   the remote and push (self-managed: `GITLAB_HOST=<host> glab repo create …`).
3. **No enable step** — a `pages` job publishing `public/` deploys automatically on
   the default branch.
4. `git add -A && git commit && git push`. After the pipeline's `pages` job runs,
   read the live URL (`glab api projects/:id/pages` or Settings → Pages — it's
   `CI_PAGES_URL`) and add the README link to it. The CI config derives the base
   path from that URL automatically, so it works for both path-based and
   unique-domain Pages.

**README link (both):** insert near the top of the repo README, before pushing
where the URL is known:
```md
**[📐 Architecture diagrams](<pages-url>)** — interactive, auto-updated
```
On GitLab the exact URL (especially with unique domains) often isn't known until
the first deploy — leave a `<!-- TODO: Pages URL -->` placeholder and fill it from
`CI_PAGES_URL` after the pipeline runs.

**Fallback** (no CLI / insufficient permission): copy the right config in and tell
the user the manual step — GitHub: **Settings → Pages → Source = "GitHub Actions"**;
GitLab: nothing beyond pushing (Pages is automatic). Details: `references/publishing.md`.

Iterating later means editing predicates and pushing — CI rebuilds the site; never
redraw by hand.

## What you deliver
```
likec4/
  likec4.config.json          # theme/project config
  specification.c4            # the pre-styled vocabulary + legend
  ARCHITECTURE-FACTS.md       # the recon manifest (human-reviewable source of truth)
  model.c4                    # (or one *.c4 per service) the elements + relationships
  views.c4                    # the curated diagrams
# plus ONE of these, depending on the host:
.github/workflows/likec4-pages.yml   # GitHub: builds + deploys to GitHub Pages on push
.gitlab-ci.yml                       # GitLab: `pages` job builds + deploys to GitLab Pages on push
# (the built site is produced in CI and served on Pages — never committed)
```

## Definition of done (quality bar)
- `likec4 validate` passes clean.
- **The backbone exists plus the planned views** — not just flows: System
  Context + Container map + a Component view per significant container, then the
  flows and specialized/overlay views the Diagram plan selected. A deliverable
  that is only flow diagrams, or a generic set that ignores what the repo is, is
  incomplete.
- Each diagram earns its place — it answers a real question for this repo, per
  the rationale in the manifest's Diagram plan.
- Any family C4 can't express (state machine, ER, branching flowchart) is left
  as a ⚠️ recommendation in the plan, not generated and not forced into a LikeC4
  view where it reads poorly.
- **Every element is richly populated:** a short `summary` (face) + a markdown
  `description` (panel) + `technology` + a correct `icon` + at least one absolute
  source `link` + `metadata`. No bare boxes, no walls of text on the face.
- **Icons are the right picture.** Verified with `list-icons`; a brand with no
  pack icon uses an absolute SVG URL or `icon none` — never a wrong-meaning glyph
  (no `bootstrap:cursor` for the Cursor editor).
- **Clickable to source:** a reader can click any node and reach the real code
  (the `link`s resolve on the published site — absolute URLs, paths that exist).
- **No hairballs, no `[...]` edges, no empty group boxes.** Hub fan-in is tamed
  with lanes + a focused hub view (§2b); merged edges get a title or
  `multiple true`; groups are declared before any `include *`.
- Colors/shapes follow the semantics in `specification.c4` consistently across
  every view; scoped views mute the parent boundary.
- Flows carry `variant sequence` and use leaf-level elements, so they render as
  real sequence diagrams.
- A reader who has never seen the repo can answer "what is this, what are its
  parts, what does it talk to, and what happens in the main flow" from the
  Context + Container + one flow view alone.
- Views are uncluttered; drill-down via `navigateTo` rather than one huge graph.
- The Pages workflow is in place (pinned to likec4 ≥ 1.57.0) and the README links
  to the deployed site.

## Optional power-up: keep it queryable
After generating, suggest wiring the LikeC4 **MCP server** (`npx -y @likec4/mcp`,
or the VS Code extension's built-in server) so the user can later ask the model
natural-language questions ("list everything that writes to the payments DB",
"what crosses the trust boundary") and extend it conversationally. See
`references/dsl-cheatsheet.md` → Tooling.

## Reference files
- `references/extraction-playbook.md` — per-language recon commands, signal→element mapping, the manifest template. **Read in Phase 1.**
- `references/repo-archetypes.md` — the adaptive planning aid: classify the repo and derive the diagram set that fits it. **Read in Phase 1.**
- `references/view-recipes.md` — the diagram-type catalog with predicate patterns and examples (the *how*). **Read in Phase 3.**
- `references/dsl-cheatsheet.md` — condensed LikeC4 syntax + CLI. **Read in Phase 0; consult while writing `.c4`.**
- `references/styling-conventions.md` — the aesthetic rules. **Read in Phase 0; obey throughout.**
- `references/EXAMPLE.c4` — a complete, validated spec+model+views in one file. Pattern-match against it when writing `.c4`; it's known-good.
- `references/publishing.md` — publish the interactive site to **GitHub or GitLab Pages** (host detected from the remote); configs in `assets/workflows/likec4-pages.yml` (GitHub) and `assets/workflows/gitlab-pages.yml` (GitLab `.gitlab-ci.yml`). **Read in Phase 4.**
