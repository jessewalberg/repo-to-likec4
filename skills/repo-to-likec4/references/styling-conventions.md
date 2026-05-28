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
element an icon.** Use the bundled packs (5,000+ icons), no downloads:
`tech:` (postgresql, redis, nodejs, react, go, python, kafka, docker, nginx…),
`aws:` (lambda, dynamodb, simple-storage-service, simple-queue-service…),
`gcp:`, `azure:`, and `bootstrap:` for generic UI glyphs. A bundled icon also
auto-fills `technology` (e.g. `icon tech:docker` → "Docker"). Use VS Code
completion to find exact names. Fallback: a URL or `../local.svg`.

> Icon ids must match the bundled set **exactly** — `likec4 validate` rejects
> unknown ones (e.g. it's `tech:kafka` not `tech:apache-kafka`, and
> `aws:dynamo-db` not `aws:dynamodb`). After adding icons, run `validate`; if an
> id fails, check the real filename in `@likec4/icons/<pack>/` or VS Code
> completion rather than guessing.

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

## 6. Populate text — empty boxes look unfinished
Every element gets a `title`, a one-line `description` (or `summary`, which is
what shows on the node face), and a `technology`. Every relationship gets a
short verb-led `label` ("reads orders", "emits OrderPlaced", not "uses"). If a
merged edge shows `[...]`, give it an explicit `title` or set `multiple true`.

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
- ✅ Icon + semantic color + populated text on every element.
- ✅ Scope and filter to keep each view at its altitude.
- ✅ Reuse `specification.c4` across repos so output is consistent and on-brand.
- ✅ Drill down with `navigateTo`; present with `extends` slides.
- ❌ One giant "everything" diagram. ❌ Colors used decoratively. ❌ Bare boxes
  with no tech/description. ❌ Vague edge labels ("uses", "calls" everywhere).
  ❌ Overriding shapes/colors ad hoc so views disagree with each other.
