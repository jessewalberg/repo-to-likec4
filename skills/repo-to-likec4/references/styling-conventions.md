# Styling conventions — make it beautiful, not generic

LikeC4 auto-lays-out, so "beautiful" is not about nudging pixels. It comes from
a few disciplined choices applied *consistently across every view*. Follow
these; they are the difference between a designed system and a default one.

## 1. Color = meaning (never decoration)
Use the palette baked into `assets/specification.c4` and never repurpose a color
per view. Consistency is what the eye reads as "intentional".

| Color | Reserved for |
|---|---|
| `primary` | your code / the system under study |
| `secondary` | human actors & personas |
| `gray` | third-party / external systems you don't own |
| `indigo` | stateful stores — db, cache, bucket |
| `amber` | async transport — queues, topics, buses |
| `green` | highlight: new, healthy, the focus of a view |
| `red` | risk: deprecated, PII/auth path (apply per-view via tag) |
| `muted` | the de-emphasized boundary/context in a given view |

The most common "designed" move: in a scoped view, set the parent boundary to
`color muted  opacity 10%` so the children pop.

## 2. Icons are the biggest single quality lever
A diagram with a Postgres elephant, a React atom, and a Redis cube looks 10×
more finished than gray boxes — for near-zero effort. **Give every technical
element an icon.** Use the bundled packs (thousands of icons), no downloads:
`tech:` (postgresql, redis, nodejs, react, go, python, kafka, docker, nginx…),
`aws:` (lambda, dynamo-db, simple-storage-service, simple-queue-service…),
`gcp:`, `azure:`, and `bootstrap:` for generic UI glyphs. A bundled icon also
auto-fills `technology` (e.g. `icon tech:docker` → "Docker").

**Find the EXACT id — never guess.** `likec4 list-icons --format json --group
tech` lists every real id; grep it for the brand. `likec4 validate` HARD-FAILS
on a non-existent id (`Could not resolve reference to LibIcon …`), so a typo
can't reach the site — but it also can't save you from a *valid-but-wrong* icon.

> **The wrong-icon trap (this is what made a real run look bad).** Some brands
> have no icon in any pack — e.g. there is **no `tech:cursor`**. Do NOT reach for
> a same-named glyph in another pack: `bootstrap:cursor` is a valid id, so it
> passes `validate`, but it's a *mouse-pointer* — the wrong picture. A wrong logo
> reads worse than none. When no real brand icon exists, use the vendor's
> official SVG by **absolute URL** (`icon https://www.cursor.com/favicon.svg` —
> verified to render on the published site) or a committed `./icons/<brand>.svg`,
> or `icon none`. Never substitute a wrong-meaning glyph.

Keep icons high-contrast: `iconColor` recolors only `bootstrap:`/inline-SVG
icons, NOT `tech:`/`aws:`/`gcp:`/`azure:` brand logos — so if a logo disappears
into a colored node, change the node fill, don't try to recolor the logo.

## 3. Shape = category (it carries semantics at a glance)
Set by kind in the spec; don't override casually.
`person` actors · `browser` web UIs · `mobile` apps · `cylinder` databases ·
`storage` caches · `bucket` object storage · `queue` brokers ·
`component` internal modules · `rectangle` services/externals ·
`document` where a doc/spec is the thing. Use `multiple true` for things that
are inherently many (serverless functions, replicas, sharded stores).

## 4. Altitude — the #1 cause of ugly diagrams is too many nodes
Respect a node budget per view and push the rest into drill-downs.

| View | Target nodes |
|---|---|
| System Context | 5–9 |
| Container / Service | ≤ 15 |
| Component (per service) | ≤ 15 |
| Dynamic flow | as many steps as needed, but only the actors in *that* scenario |

If you're over budget: scope the view (`view of X`), filter (`where`/`exclude`),
or split into a parent + `navigateTo` child. Never solve crowding by shrinking
nodes.

## 5. Layout direction matches intent
`autoLayout TopBottom` for hierarchy/context; `autoLayout LeftRight` for request
and data flows. Tune spacing only if needed: `autoLayout LeftRight 120 110`
(rank sep, node sep). Use `rank same { a, b }` to align a row of peers (e.g. all
datastores), and `rank source`/`rank sink` to anchor ingress/egress — sparingly.

## 6. Clean faces, rich on click — `summary` vs `description`
This is the single biggest readability lever after icons, and the one the first
runs missed. LikeC4 shows **`summary` on the node FACE** and **`description`
(markdown) only in the click-through details panel.** If you put a long
description and no summary, the whole wall of text lands on the face → bulky,
ugly boxes (exactly what went wrong). So for every element:
- `summary` — ONE short line for the face ("Receives & validates worker results").
- `description` — rich triple-quoted **markdown** for the panel (headings,
  bullets, inline `code`, and an inline source link all render).
- `technology` — keep it.
Every relationship gets a short verb-led title ("emits OrderPlaced", not "uses").
If a merged edge shows `[...]`, fix it by altitude: at Context, collapse it to one
clean label with `include a -> b with { title 'triggers workflows' }` (NOT
`multiple true`, which over-expands at high altitude); at Container/Component,
expand distinct edges with `include a -> b with { multiple true }`; or don't pull
many low-level edges up into a high-altitude view. Both render-verified.

## 6b. Make it clickable — links + metadata (the "right links")
The details panel is where a diagram becomes a *map you can navigate*. Populate
it on every element (and important relationships):
- **`link <absolute-url> 'Title'`** — one or more. This is how a reader jumps
  from a box to the actual code. Point at the real source: a GitHub/GitLab
  **blob URL with a line range** (`…/blob/main/apps/api/index.ts#L1-L40`), the
  workflow YAML, the Dockerfile, the OpenAPI/README. The quoted title is the
  clickable label. **Always absolute** — relative paths render dead `file://`
  links on the published site.
- **`metadata { key 'value' }`** — deterministic structured facts (language,
  path, package, loc, owner; for CI nodes: workflow, triggers, runner). Renders
  alphabetised in the panel. Quote every value, even numbers.
The recon pass already located each element's files — capture them and emit
`link`s + `metadata`. A node with a summary, a markdown description, two source
links, and five metadata facts is the difference between "a picture" and "a
clickable architecture".

## 7. A legend makes it look professional — and it's automatic
Because every kind in the spec has a `notation`, LikeC4 renders a key. Keep
notations accurate. For per-view emphasis you can attach a `notation` inside a
`style`/`with` block (e.g. a `#deprecated` style → "Deprecated"). Export with
`--notation` to bake the legend into PNGs.

## 8. Boundaries (groups) for structure without clutter
Wrap related elements in a `group 'Name' { color … opacity 10–20% … }` to show
a domain, zone, or service bus as a soft container. Remember a child only joins
a group if its parent isn't already in the view, and for elements the *first*
group wins.

## 9. Naming & coherence
- View ids/titles say what they answer ("Checkout flow", not "view3").
- Keep `index` as the landing view; chain depth with `navigateTo`.
- One vocabulary: reuse the same element kinds and labels everywhere.
- For light/dark parity, prefer SVG icons with baked `prefers-color-scheme`; export both `--theme light` and `--theme dark` if both will be used.

## Do / Don't
- ✅ Every element: icon + semantic color + short `summary` (face) + markdown
  `description` (panel) + `technology` + at least one source `link` + `metadata`.
- ✅ Scope and filter to keep each view at its altitude; tame hub fan-in with
  lanes + a dedicated hub view (see `view-recipes.md`).
- ✅ Reuse `specification.c4` across repos so output is consistent and on-brand.
- ✅ Drill down with `navigateTo` (on a relationship → a dynamic view, or in a
  view's `with { }` → a view id — never on an element body).
- ✅ Verify every icon id with `list-icons`; use an absolute SVG URL for brands
  with no pack icon.
- ❌ One giant "everything" diagram or a hub with 15 spokes in one view.
- ❌ The full description dumped on the node face (use `summary`).
- ❌ A valid-but-wrong icon (`bootstrap:cursor` for the Cursor editor).
- ❌ Relative source links (dead on the published site).
- ❌ Bare boxes, vague edge labels ("uses"/"calls"), `[...]` edges left as-is,
  empty group boxes, colors used decoratively, ad-hoc shape/color overrides.
