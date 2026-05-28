# repo-to-likec4

A cross-agent **Agent Skill** that turns any code repository into beautiful,
accurate [LikeC4](https://likec4.dev) architecture diagrams — system context,
service maps, component breakdowns, request/sequence flows, data flow,
deployment topology, and cheap tag overlays — all projected from one model so
they never drift.

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
model from a pre-styled vocabulary (icons, semantic colors, legend), generates
the right views from a catalog, and validates + renders with the LikeC4 CLI.
Full copy-paste prompt and variations: [`skills/repo-to-likec4/PROMPT.md`](skills/repo-to-likec4/PROMPT.md).

## What's inside

```
skills/repo-to-likec4/
  SKILL.md                      # workflow: recon → model → views → validate/render
  PROMPT.md                     # copy-paste invocation + variations
  references/
    extraction-playbook.md      # per-language recon commands + signal→element mapping
    view-recipes.md             # the diagram-type catalog (predicate patterns)
    dsl-cheatsheet.md           # condensed, gotcha-annotated LikeC4 syntax
    styling-conventions.md      # the rules that make output beautiful
    EXAMPLE.c4                  # a complete, validated spec+model+views reference
  assets/
    specification.c4            # reusable pre-styled element kinds + legend
    likec4.config.json          # theme/project config starter
```

Pairs well with LikeC4's official syntax skill (`npx skills add https://likec4.dev/`)
and its [MCP server](https://likec4.dev/tooling/ai-tools/) for querying the model
in natural language after generation.

## License

MIT
