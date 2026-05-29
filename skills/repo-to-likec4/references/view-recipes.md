# View recipes — the diagram catalog

The useful diagram *types* for a codebase, ordered by how often they earn their
place. Each is just a predicate pattern over the one model, so generating many
is cheap and they stay mutually consistent. Pick based on what the repo has;
don't generate empty or redundant views.

Selection at a glance:

| # | View | Always? | Needs |
|---|------|---------|-------|
| 1 | System Context | ✅ | any repo |
| 2 | Container / Service map | ✅ | any repo |
| 3 | Component (per service) | per significant service | a service with internal structure |
| 4 | Key flow (dynamic/sequence) | 3–5 | identifiable use cases |
| 5 | Data flow / pipeline | if data-centric | ETL / streaming / event-driven |
| 6 | Data & persistence | if it has stores | DBs / caches / buckets |
| 7 | External integrations (trust boundary) | if 3rd parties | external systems |
| 8 | Deployment topology | if infra defined | compose / k8s / terraform |
| 9 | Domain / bounded-context map | for DDD / big monorepos | discoverable domains |
| 10 | Tag overlays | cheap extras | tags present (#deprecated/#pii/#team) |

The altitude rule applies everywhere: **Context ≈ 5–9 nodes, Container ≈ ≤15,
Component ≈ ≤15.** If a view is crowded, split it or push detail into a
drill-down (`navigateTo`) rather than cramming.

> **Structural-first.** Views 1–3 are the backbone and are required for every
> repo (Component per significant container); flows (4) come *after*, not
> instead. Shipping only flow diagrams is the most common failure — it leaves
> the reader with no map of what the parts are. Always produce 1 + 2 + (3 per
> service) + 4, then add 5–10 where they apply.

---

## 1. System Context — "what is this and what does it touch?"
Top-level. The system as one box, surrounded by people and external systems.
Best first diagram for stakeholders/onboarding.
```likec4
view index {
  title 'System Context'
  include *                         // unscoped → top-level elements + derived edges
  style cloud { color primary }
  autoLayout TopBottom
}
```
Keep the *internals* hidden here — that's the next view's job.

## 2. Container / Service map — "what are the moving parts?"
The single most useful diagram for most repos. The deployable/runnable units
inside the system and how they connect. Wire each container to its component
view for drill-down.
```likec4
view containers of cloud {
  title 'Containers'
  include *                         // scoped → cloud + its children
  include cloud.api with { navigateTo apiComponents }   // drill-down (view-level, NOT element body)
  style cloud { color muted  opacity 10% }              // de-emphasize the boundary
  autoLayout LeftRight 120 130
}
```
**Before you ship this view, check for hub fan-in** (see 2b). If one element
(a `github`, a gateway, a shared DB, an event bus) has more than ~5 edges in/out,
a flat `include *` here produces an unreadable hairball — apply the recipe below.

## 2b. Taming hub-and-spoke / fan-in — the #1 cause of an ugly map
This is the failure mode that made a real run look bad: 11 sibling workers all
pointing at one `github` hub → ~20 near-parallel edges crammed into one channel,
extreme aspect ratio, overlapping label pills. **No single autoLayout knob fixes
it** — re-orienting just turns a tall hairball into a wide one. It's an
*altitude* problem; fix it with curation, in roughly this order:

1. **Group the spokes into named lanes** so the map reads as a few clusters
   instead of N loose boxes. Put each group's own `include` FIRST (a preceding
   `include *` steals the elements and the group renders empty):
   ```likec4
   view containers of cloud {
     title 'Containers'
     group 'Intake & planning' { color indigo  opacity 12%
       include cloud.intake, cloud.planning, cloud.childIssues }
     group 'Implementation'    { color green   opacity 12%
       include cloud.codexDispatch, cloud.cursorDispatch }
     group 'Checking'          { color amber   opacity 12%
       include cloud.codexCheck, cloud.cursorCheck }
     group 'Governance'        { color gray    opacity 12%
       include cloud.reconcile, cloud.prTriage, cloud.policyGate, cloud.ci }
     include github, cloud.cli            // the shared substrate + engine
     style cloud { color muted  opacity 10% }
     style github { color muted  opacity 25% }   // mute the hub so lanes lead
     autoLayout LeftRight 140 110
   }
   ```
   (Lane grouping was render-verified to convert the tall spaghetti column into a
   structured, readable map — the strongest single fix.)
2. **Give the hub its own focused view** and keep it OUT of (or muted in) the
   main map. A `view of <hub>` auto-scopes to the hub + its neighbours, so the
   dense fan-in lives in one diagram instead of polluting the container map:
   ```likec4
   view githubSurface of github {
     title 'GitHub integration surface'
     include *
     autoLayout LeftRight
   }
   ```
   Reach it via `navigateTo` from the muted hub in the container map.
3. **Anchor with `rank`** (a secondary assist, not a cure): `rank same { …spokes }`
   aligns the peer row and `rank sink { hub }` (or `rank source` for ingress)
   pins the hub to one end — a cleaner bipartite shape. Element views only.
4. **Split by lane** if it's still crowded: one container view per lane
   (`view implementationLane of cloud { include cloud.codexDispatch, … }`),
   linked from a sparse top map. Honour the ≤15-node budget.

Manual saved layouts (`.likec4/<view>.snap`, committed) are a last-resort polish
for 1–3 hero views only — they drift when the model changes, so scope them tight.

## 3. Component view (per service) — "how is this service built?"
Generate one per significant container. Internal modules/layers
(routes → controllers → services → repositories) and their datastore/queue
edges. Scope to the container so `*` means "this + its children".
```likec4
view apiComponents of cloud.api {
  title 'API — components'
  include *
  include -> cloud.db, -> cloud.queue        // pull in the stores it touches
  style cloud.api { color muted  opacity 10% }
}
```

## 4. Key flow — dynamic / sequence — "what actually happens when X?"
Often the most illuminating views: the system in motion. Do the 3–5 most
important use cases (signup, checkout, ingest, etc.). Render as `sequence` for
leaf-level step-by-step, or `diagram` for a spatial flow.
```likec4
dynamic view checkoutFlow {
  title 'Checkout'
  variant sequence                      // render as lifelines by default (see below)
  customer -> web 'clicks Buy'
  web -> api  'POST /orders'
  api -> db   'insert order'
  par {
    api -> payments 'charge'            // external system
    api -> queue    'emit OrderPlaced'
  }
  web <- api 'returns 201'              // backward = response
  queue -> worker 'OrderPlaced'
  worker -> email 'send receipt'
}
```
Tips: `include a, b, c` fixes actor order; `notes '...'` documents a step; a
relationship `navigateTo someFlow` links a flow to a deeper flow.

**These flows double as sequence diagrams — but you must opt in.** A dynamic view
renders two ways: `diagram` (the spatial default) and `sequence` (classic
lifelines, render-verified). To actually get lifelines: (1) add **`variant
sequence`** to the view body so the hosted viewer defaults that view to the
sequence layout (and still offers the toggle); (2) **use leaf elements only** in
the steps — reference a `service`/`component`, never a parent container that has
children (the sequence layout silently can't lay out non-leaf nodes); (3) for an
embed, pin it with the web-component attribute `dynamic-variant="sequence"`, and
for a PNG export pass `likec4 export png --seq`. The original skill mandated
leaf-level (good) but never emitted `variant sequence`, so the flows only ever
rendered spatially. Author every flow at leaf level **with `variant sequence`**
and you get both renderings from one definition.

## 5. Data flow / pipeline — "how does data move and transform?"
For ETL, streaming, or event-driven systems. Left-to-right reads naturally.
Either a directed dynamic view, or a filtered structural view following the
data path.
```likec4
view dataPipeline {
  title 'Ingestion pipeline'
  include source -> *, * -> warehouse        // the path, end to end
  autoLayout LeftRight
}
```

## 6. Data & persistence — "where does state live?"
Filter the model to stores and who reads/writes them. Great for DBAs and for
spotting shared-database coupling.
```likec4
view dataStores {
  title 'Data & persistence'
  include *
    where kind is database or kind is cache or kind is bucket
  include -> cloud.db, -> cloud.cache          // bring in the writers/readers
  style element.tag = #pii { color red }       // highlight sensitive stores
}
```

## 7. External integrations — trust boundary — "vendor exposure / blast radius"
Filter to third parties and the edges crossing the boundary. Security/vendor
review and incident blast-radius.
```likec4
view externals {
  title 'External integrations'
  // group's own include comes FIRST so it ADOPTS the externals. A preceding
  // `include *` would claim them at top level → the group box renders EMPTY
  // (the exact bug in the first run).
  group 'Third parties' {
    color gray  opacity 15%
    include * where tag is #external
  }
  include cloud.* where kind is service or kind is gateway   // the callers, after
}
```
> **The empty-group rule:** an element joins a `group` only if no parent of it is
> already in the view. So always put a group's `include` before any broad
> `include *`. Render-verified: group-first populates the box; `*`-first leaves
> it empty.

## 8. Deployment topology — "what runs where?"
Only if `docker-compose` / `k8s` / `terraform` exists. Uses LikeC4's deployment
model (define `deploymentNode` kinds in the spec). Shows environments, nodes,
and which logical elements are instantiated where.
```likec4
deployment view prod {
  title 'Production topology'
  include *
}
```

## 9. Domain / bounded-context map — "the business shape"
For DDD codebases and large monorepos: group by business domain instead of
technical layer, using boundary boxes.
```likec4
view domains of cloud {
  title 'Domains'
  group 'Billing'   { color indigo  opacity 12%  include * where tag is #domain-billing }
  group 'Identity'  { color green   opacity 12%  include * where tag is #domain-identity }
  group 'Catalog'   { color amber   opacity 12%  include * where tag is #domain-catalog }
}
```

## 10. Tag overlays — cheap, high-value extras
Once the model is tagged, these are nearly free and showcase the value of a
*model* over static pictures. Use `exclude * where tag is not #x` to keep only
the tagged subset.
```likec4
view deprecated {                      // migration / cleanup planning
  title 'Deprecated surface'
  include *
  exclude * where tag is not #deprecated
  style * { color muted }
}

view security {                        // compliance / PII review
  title 'PII & auth paths'
  include *
  exclude * where tag is not #pii
  style * { color red }
}

view teamPayments {                    // ownership
  title 'Owned by Payments'
  include * where tag is #team-payments
}
```
Define a "baseline" once and filter many ways:
```likec4
global {
  predicateGroup everything { include * }
}
// then in each overlay:  global predicate everything  +  exclude * where tag is not #x
```

---

### Cross-view conventions
- **Drill-down, not sprawl:** Context → (navigateTo) → Container → (navigateTo) → Component → (navigateTo) → flow. Build the chain so a reader can dive in. **`navigateTo` placement:** in a view, `include x with { navigateTo someView }` (element → view); on a relationship, `a -> b { navigateTo someFlow }` (edge → *dynamic* view). It is **never** an element-body property — that fails to parse. Defining a scoped `view of x` also makes `x` click-navigable automatically.
- **Make every node clickable:** the value of a *model* over a picture is the details panel — give each element a `summary`, a markdown `description`, source `link`s (absolute), and `metadata`. A reader should be able to click any box and land on the real code.
- **Name views by what they answer**, set a clear `title`, and keep `index` as the entry point.
- **One layout direction per intent:** `TopBottom` for hierarchy/context, `LeftRight` for request and data flows; add numeric spacing (`LeftRight 120 130`) to spread a dense view.
- **`extends` for slides:** if presenting, `view slide2 extends containers { style someElement { color green } }` to progressively reveal/highlight.
