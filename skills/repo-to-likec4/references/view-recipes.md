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
  include cloud.api with { navigateTo apiComponents }   // drill-down
  style cloud { color muted  opacity 10% }              // de-emphasize the boundary
  autoLayout LeftRight
}
```

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
Tips: `include a, b, c` fixes actor order; `notes '...'` documents a step;
`navigateTo` links a flow to a deeper flow. Export sequence form with
`likec4 export png --seq`.

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
  include *
  exclude * where tag is not #external and kind is not service and kind is not gateway
  group 'Third parties' {
    color gray  opacity 15%
    include * where tag is #external
  }
}
```

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
- **Drill-down, not sprawl:** Context → (navigateTo) → Container → (navigateTo) → Component → (navigateTo) → flow. Build the chain with `navigateTo` so a reader can dive in.
- **Name views by what they answer**, set a clear `title`, and keep `index` as the entry point.
- **One layout direction per intent:** `TopBottom` for hierarchy/context, `LeftRight` for request and data flows.
- **`extends` for slides:** if presenting, `view slide2 extends containers { style someElement { color green } }` to progressively reveal/highlight.
