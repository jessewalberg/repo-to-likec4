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
>    semantic colors, legend) and generate views from the catalog: System
>    Context + Container map always, a Component view per significant service
>    with drill-down, 3–5 key flow (sequence) views, plus data / external /
>    deployment / tag-overlay views where they apply.
> 4. Run `likec4 validate` until clean, then `likec4 build -o dist` and
>    `likec4 export png -o diagrams --theme dark`.
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
- Docs embed: *"Also `likec4 gen mermaid` so I can paste diagrams into the
  README."*
