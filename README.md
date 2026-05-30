# Cartograph

An Agent Skill that turns a code repository into a beautiful, interactive
architecture map and documentation site. Cartograph generates a schema-validated
`architecture.json` manifest, lays it out with `elkjs`, preserves human edits on
re-runs, and bundles everything into one self-contained `viewer.html` that works
offline or on GitHub Pages.

This repository used to ship a LikeC4 workflow under the `repo-to-likec4` name.
That approach is now legacy. The current product is **Cartograph**: a React Flow
viewer, an agent-owned JSON manifest, a docs sidebar, search, changelog, tours,
and in-viewer editing/export.

## Install

One command, using the existing repository name:

```sh
npx skills add jessewalberg/repo-to-likec4
```

Target specific agents, install globally, and skip prompts:

```sh
npx skills add jessewalberg/repo-to-likec4 -a claude-code -a cursor -a codex -g -y
```

Try it locally before publishing:

```sh
git clone https://github.com/jessewalberg/repo-to-likec4
npx skills add ./repo-to-likec4
```

Update later:

```sh
npx skills update repo-to-likec4
```

## Use

In any repo, ask your agent:

> Generate a Cartograph architecture map for this repository.

The skill:

1. Runs deterministic recon over the repo, extracting module nodes and import
   edges without summarizing implementation.
2. Writes `.cartograph/architecture.json`, `site.json`, `tours.json`,
   `changelog.json`, and an overview page.
3. Builds a C4-style altitude ladder: Containers, Components, and per-directory
   drill-downs when the repo shape supports them.
4. Preserves human edits on re-runs with provenance, suppressions, rename
   detection, and frozen layout.
5. Bundles the result into `cartograph-site/index.html`, a single offline-capable
   viewer.

Optional refinement (`--refine`) uses the `claude` CLI to author node summaries
and `pages/**.md` docs from the manifest. Estimate first with:

```sh
node "$SKILL/assets/engine/cost.ts" --manifest "$REPO/.cartograph/architecture.json"
```

## Direct Workflow

For agents or maintainers running the engine directly:

```sh
npm install --prefix "$SKILL/assets/engine"

node "$SKILL/assets/engine/generate.ts" \
  --repo "$REPO" \
  --name "owner/name" \
  --ref "<default-branch>" \
  --out "$REPO/.cartograph"

node "$SKILL/assets/engine/bundle.ts" \
  --template "$SKILL/assets/viewer-template.html" \
  --data "$REPO/.cartograph" \
  --out "$REPO/cartograph-site/index.html"
```

`generate` replaces old LikeC4 artifacts by default: `likec4/`, `*.c4`,
`*.likec4`, `likec4.config.json`, and `.github/workflows/likec4-pages.yml`.
Pass `--keep-c4` if you intentionally want to preserve legacy LikeC4 files.

## Publishing

Cartograph publishes as static HTML. Copy the Pages workflow, commit the generated
site, and push:

```sh
mkdir -p "$REPO/.github/workflows"
cp "$SKILL/assets/workflows/cartograph-pages.yml" "$REPO/.github/workflows/"
```

Then set the repository's one-time GitHub Pages source to **GitHub Actions**.
After that, pushing updates to `cartograph-site/index.html` redeploys the site.

For always-fresh docs, see
[`skills/cartograph/references/publishing.md`](skills/cartograph/references/publishing.md)
and the opt-in CI rebuild workflow.

## What's Inside

```text
skills/cartograph/
  SKILL.md
  assets/
    engine/                         # recon -> model -> layout -> merge -> validate
    viewer-template.html             # prebuilt self-contained viewer shell
    workflows/
      cartograph-pages.yml           # deploy committed cartograph-site/
      cartograph-pages-rebuild.yml   # optional regenerate-on-push workflow
  references/
    publishing.md

cartograph/
  generate/                          # source + tests for the generator
  viewer/                            # React Flow viewer source + tests
  fixtures/

docs/
  decisions/                         # ADR, backlog, product direction
  design/
  research/

skills/repo-to-likec4/               # legacy redirect/reference only
extras/c4.md                         # optional Claude Code alias for Cartograph
```

## Legacy LikeC4

The LikeC4 workflow was superseded by ADR-0001 after the React Flow/Cartograph
spike passed. Legacy materials remain only to redirect old invocations and help
migration. New architecture maps should use `skills/cartograph`.

## License

MIT
