---
name: cartograph
description: >-
  Generate a beautiful, interactive architecture diagram + docs site for ANY code
  repository, and optionally publish it to GitHub Pages. Use whenever the user wants
  to visualize, diagram, map, document, or "see" the architecture of a codebase,
  microservices, a system, or a repo — system/container/component maps, module
  graphs, or dependency graphs. Trigger even when the user just says "draw the
  architecture", "map this repo", "how does this codebase fit together", or hands
  over a repo and asks what it is — and even if they don't say "Cartograph" or "C4".
  Produces a single self-contained viewer.html (works offline over file://) from a
  schema-validated, agent-owned architecture.json manifest, and can deploy it to
  GitHub Pages in the repo it acts on.
---

# Cartograph

Turn any repo into an interactive architecture viewer: a light, accessible
React-Flow canvas + docs shell (sidebar, ⌘K search, detail panel, changelog),
driven by a JSON manifest an agent generates and can keep current. Output is **one
self-contained `viewer.html`** — no server, no build step for the end user.

Two shipped pieces (in this skill's `assets/`):

- **`assets/engine/`** — the deterministic generation pipeline (recon → model →
  elkjs layout → validate → site/changelog; plus three-way merge so human edits
  survive re-runs). Node + `elkjs` only; no LLM call required.
- **`assets/viewer-template.html`** — the prebuilt viewer (≈0.8 MB) with a
  replaceable data-island placeholder. `bundle.ts` injects a repo's JSON into a
  copy of it — that's how the diagram is "built" for any repo without npm/vite.

## When to use

Any request to visualize / diagram / map / document a codebase's architecture, or
"what is this repo / how does it fit together". Works on JS/TS repos today (recon
walks `.mjs/.cjs/.js/.jsx/.ts/.tsx`); other languages render but with a lighter
graph.

## Workflow

Let `SKILL` = this skill's directory, `REPO` = the target repository root, and
`SCAN` = an optional subdirectory to focus on (e.g. `tools/factory`, `apps/api`).

### 1. Locate the target

Confirm `REPO` (default: the current working directory) and ask for `SCAN` only if
the repo is large and the user hasn't implied a focus. Determine the repo's
`owner/name` (from `git remote get-url origin`) and default branch.

### 2. Ensure engine dependencies (once)

```bash
npm install --prefix "$SKILL/assets/engine"   # installs elkjs; idempotent
```

### 3. Generate the manifest for this repo

```bash
node "$SKILL/assets/engine/generate.ts" \
  --repo "$REPO" [--scan "$SCAN"] \
  --name "owner/name" --ref "<default-branch>" \
  --out "$REPO/.cartograph"
```

Writes `architecture.json`, `site.json`, `changelog.json` into `$REPO/.cartograph`.
On re-runs over an existing `architecture.json` it **three-way merges** (human
relabels / pins / positions / suppressions survive) and appends a changelog entry.

> If the repo was previously mapped by the **old `repo-to-likec4`** skill, generate
> prints a migration notice; pass `--migrate` to remove the stale `likec4/` dir and
> `likec4-pages.yml` (shared CI files are reported, never auto-deleted).

### 4. Bundle into a self-contained viewer

```bash
node "$SKILL/assets/engine/bundle.ts" \
  --template "$SKILL/assets/viewer-template.html" \
  --data "$REPO/.cartograph" \
  --out "$REPO/cartograph-site/index.html"
```

`$REPO/cartograph-site/index.html` is now a complete, offline-capable viewer.
Open it (`file://…`) to verify it renders before going further.

### 5. (Optional) Deploy to GitHub Pages

Cartograph can publish the viewer for the repo it acts on:

1. Copy the deploy workflow into the repo:
   ```bash
   mkdir -p "$REPO/.github/workflows"
   cp "$SKILL/assets/workflows/cartograph-pages.yml" "$REPO/.github/workflows/"
   ```
   It deploys `cartograph-site/` as a static site — no Node/secrets in CI (the
   viewer is already self-contained). Trim the `branches:` list to the repo's
   default branch if you like.
2. Commit `cartograph-site/index.html` + the workflow and push (use the user's
   commit conventions; one logical commit, e.g.
   `docs(architecture): publish Cartograph viewer to Pages`).
3. Tell the user the **one-time manual step**: repo **Settings → Pages → Source =
   "GitHub Actions"**. After that, the workflow runs on push and the URL appears in
   the Actions run / Pages settings.

To **refresh** the published diagram later: re-run steps 3–4 and commit the new
`cartograph-site/index.html` — the merge keeps any human edits, and the push
redeploys. (Manual refresh is the default per the cost research; see
`references/publishing.md` for an optional always-rebuild-in-CI variant and GitLab
Pages.)

## What you deliver

```
<repo>/
  .cartograph/               # the agent-owned source of truth (commit this)
    architecture.json        #   the graph (nodes/edges/groups/views + merge bookkeeping)
    site.json                #   sidebar nav (Documentation / Architecture / Modules / Learning)
    changelog.json           #   what changed between runs (from the merge report)
  cartograph-site/
    index.html               # the self-contained viewer (deploy target)
  .github/workflows/
    cartograph-pages.yml      # GitHub Pages deploy (only if publishing)
```

## Definition of done

- `generate` prints `validate: OK` (no orphan edges; every node source-linked).
- `cartograph-site/index.html` opens offline and renders the graph (nodes, lanes,
  edges) with no console errors.
- If publishing: workflow committed, Pages source set to GitHub Actions, the user
  has the live URL.
- Re-running on an edited manifest preserves human edits (don't redraw by hand —
  edit the manifest / re-run and let the merge do its job).

## Notes

- The viewer is **light-themed** (OKLCH) with a dark toggle; accessibility is
  first-class (keyboard nav, ARIA graph semantics, WCAG-AA contrast).
- The manifest is the source of truth; the viewer is a projection. Keep edits in
  `architecture.json` (or via a future in-viewer write-back), never by editing the
  built HTML.
- See `references/publishing.md` for Pages enablement details, custom domains,
  GitLab Pages, and the optional CI-rebuild-on-push variant.
