# Invocation prompt

Copy-paste this to kick off diagram generation in a repo (Claude Code, with the
`repo-to-likec4` skill installed). The skill carries the method; this just aims
it.

---

> Generate architecture diagrams for this repository using LikeC4, following the
> `repo-to-likec4` skill.
>
> 1. Do the recon pass first and write `likec4/ARCHITECTURE-FACTS.md`. Extract
>    structure and edges (entry points, service boundaries, datastores, queues,
>    third-party integrations) — don't read implementation. Check
>    docker-compose / k8s / terraform / .env.example and use a dependency-graph
>    tool for my stack if one exists.
> 2. Show me the manifest and pause for confirmation before modeling.
> 3. Then build the model (reuse the provided `specification.c4` — icons,
>    semantic colors, legend). **Reason about what this repo actually is**
>    (CLI, event-driven, data pipeline, monorepo, frontend, infra, stateful
>    domain — often several at once) and produce the diagram set that fits it:
>    always the backbone (System Context + Container map + a Component view per
>    significant service with drill-down), plus the flows/sequences and
>    specialized/overlay views the repo calls for. Write the plan with a
>    one-line rationale per diagram into `ARCHITECTURE-FACTS.md` first. If
>    something useful is outside C4's reach (state machine, ER, branching
>    flowchart), flag it as a ⚠️ recommendation in the plan — this skill is
>    C4-only and doesn't generate other formats.
> 4. Run `likec4 validate` until clean, then set up publishing: copy
>    `likec4-pages.yml` into `.github/workflows/` so the interactive diagrams
>    site deploys to GitHub Pages on push (no image files — hosted site only).
>    Remind me to set Settings → Pages → Source = "GitHub Actions" once.
>
> Hold the quality bar: every element gets an icon, a description, and a
> technology; keep each view at its altitude (no giant everything-diagram);
> drill down with navigateTo instead of cramming.

---

**Variations**
- Big monorepo: add *"Treat each service in `<dir>` as its own `.c4` file merged
  into one model; if there are 15+ services, split into LikeC4 projects per
  domain and add a landscape view."*
- Just one thing: *"Only the Container map and the checkout flow for now."*
- Keep it live: *"After generating, wire up the LikeC4 MCP server so I can query
  and extend the model in chat."*
