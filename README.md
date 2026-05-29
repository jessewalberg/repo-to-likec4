# repo-to-likec4

A cross-agent **Agent Skill** that turns any code repository into beautiful,
accurate [LikeC4](https://likec4.dev) architecture diagrams — system context,
service maps, component breakdowns, request/sequence flows, data flow,
deployment topology, and cheap tag overlays — all projected from one model so
they never drift.

Every box is **clickable through to the real code**: each element carries a short
on-face summary, a rich markdown description, structured metadata, and absolute
source links (the route file, the workflow YAML, the migration) — so the diagram
is a navigable map of the repo, not just a picture. Hub-and-spoke topologies are
grouped into lanes with focused drill-downs instead of collapsing into hairballs.

Works in **Claude Code**, **Cursor**, **Codex**, and 50+ other agents that
support the [Agent Skills](https://agentskills.io) standard.

## Install

One command (auto-detects the agents you have installed):

```sh
npx skills add jessewalberg/repo-to-likec4
```

Target specific agents, install globally (available in every project), and skip
prompts:

```sh
npx skills add jessewalberg/repo-to-likec4 -a claude-code -a cursor -a codex -g -y
```

> Scope: omit `-g` to install into the **current project** (`.claude/skills/`,
> `.agents/skills/` …, committed with your repo); add `-g` for **global**
> (`~/.claude/skills/`, `~/.cursor/skills/`, `~/.codex/skills/` …).

Try it locally before publishing:

```sh
git clone https://github.com/jessewalberg/repo-to-likec4 && npx skills add ./repo-to-likec4
```

Manage it later:

```sh
npx skills list                     # see what's installed
npx skills update repo-to-likec4    # pull the latest
npx skills remove repo-to-likec4
```

## Use

In any repo, ask your agent:

> Generate architecture diagrams for this repository using the `repo-to-likec4` skill.

The skill runs a cheap recon pass (it extracts *structure and edges* — entry
points, services, datastores, queues, third-party integrations — never reading
implementation), writes a reviewable `ARCHITECTURE-FACTS.md`, builds a LikeC4
model from a pre-styled vocabulary (icons, semantic colors, legend), then
**reasons about what the repo actually is** (CLI, event-driven, data pipeline,
monorepo, frontend, infra, stateful domain — often several) and produces the
diagram set that fits it: the backbone plus the flows/sequences and specialized
views that archetype makes useful. It validates them and publishes an
**interactive site to GitHub Pages or GitLab Pages** — detected from your git
remote (no image files; the diagrams are the hosted, live site). Run it inside an
agent with the host's CLI authenticated (`gh` or `glab` — e.g. Claude Code) and it
handles publishing too: creates the repo if needed, sets up the CI (GitHub Actions
workflow, or a GitLab `.gitlab-ci.yml` `pages` job), **enables Pages on GitHub via
`gh` with no manual Settings click** (GitLab needs no enable step), and pushes. It
falls back to printing the one manual step if no CLI is present.
Full copy-paste prompt and variations: [`skills/repo-to-likec4/PROMPT.md`](skills/repo-to-likec4/PROMPT.md).

## Updating

The skill updates like any other: re-pull the latest from this repo into all your
agents with one command.

```sh
npx skills update repo-to-likec4     # this skill
npx skills update                    # everything you've installed
```

(That fetches from wherever you installed it. If you maintain this repo, push your
changes first; installs from a local path refresh with `npx skills add ./repo-to-likec4 --copy -y`.)

**Optional `/c4` command (Claude Code).** In Claude Code, the skill is already
invokable as `/repo-to-likec4`. For a shorter command with an `update`
subcommand, copy [`extras/c4.md`](extras/c4.md) to `~/.claude/commands/c4.md`
(global) or `.claude/commands/c4.md` (project):

```
/c4                # generate / refresh diagrams for the current repo
/c4 update         # pull the latest version of the skill
```

In Cursor and Codex there's no `/c4` (slash commands aren't part of the skills
standard) — just ask "generate architecture diagrams" and the skill triggers.

## Refreshing a repo's diagrams

Diagrams are a model, so there's nothing to re-render by hand: change the `.c4`
(or re-run the skill / `/c4`), commit, and push — GitHub or GitLab Pages rebuilds the
interactive site automatically.

## What's inside

```
skills/repo-to-likec4/
  SKILL.md                      # workflow: recon → model → views → validate → publish
  PROMPT.md                     # copy-paste invocation + variations
  references/
    extraction-playbook.md      # per-language recon commands + signal→element mapping
    repo-archetypes.md          # adaptive planning: classify the repo → the diagrams that fit it
    view-recipes.md             # the diagram-type catalog (predicate patterns)
    dsl-cheatsheet.md           # condensed, gotcha-annotated LikeC4 syntax
    styling-conventions.md      # the rules that make output beautiful
    publishing.md               # deploy the interactive site to GitHub or GitLab Pages
    EXAMPLE.c4                  # a complete, validated spec+model+views reference
  assets/
    specification.c4            # reusable pre-styled element kinds + legend
    likec4.config.json          # theme/project config starter
    workflows/
      likec4-pages.yml          # GitHub Actions: build + deploy the site on push
      gitlab-pages.yml          # GitLab CI (.gitlab-ci.yml): pages job, build + deploy on push
extras/
  c4.md                         # optional Claude Code /c4 slash command
```

Pairs well with LikeC4's official syntax skill (`npx skills add https://likec4.dev/`)
and its [MCP server](https://likec4.dev/tooling/ai-tools/) for querying the model
in natural language after generation.

## License

MIT
