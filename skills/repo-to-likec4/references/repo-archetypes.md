# Repo archetypes — plan the diagrams that fit THIS repo

This is the skill's "intelligence" layer. It is a **reasoning aid, not a lookup
table.** The goal is to look at what the repo actually does and who would read
the diagrams, then choose the views that illuminate *this* system — rather than
emitting a fixed set every time.

## How to reason (do this in Phase 1, write the plan into the manifest)
1. **Start from the questions.** For this repo, what would a new engineer, a
   reviewer, or an operator most need to *see*? "What are the parts?" → structure.
   "What happens when X?" → a flow. "Where does state live / what could break?"
   → an overlay. Pick views that answer real questions, not to fill a checklist.
2. **Classify the repo** using the recon signals. A repo is usually **several**
   archetypes at once (e.g. a SaaS = web-app + API + stateful-domain). Take the
   union of their diagram ideas, then trim to what's genuinely useful.
3. **Always keep the backbone.** System Context + Container map + a Component
   view per significant container are the map; produce them regardless. They are
   what was missing when a run yields "only flows."
4. **Sequence/flows are near-universal.** Almost every repo benefits from 2–5
   dynamic views of its important interactions (authored at leaf level so they
   also render as sequence diagrams). Pick the flows that matter for the archetype.
5. **Add specialized + overlay views** from the archetype palette below, only
   where the signals are present.
6. **Write the plan down.** In `ARCHITECTURE-FACTS.md`, list the chosen diagrams
   with a one-line rationale each, so the human can adjust before you generate.
   Example: `Event choreography (async) — repo is Kafka-based; shows OrderPlaced
   fan-out`. Note any idea that LikeC4 can't express (see the wall at the bottom).

## Archetype palette
Each entry: **signals → what's worth showing → LikeC4 views to produce.**
⚠️ marks ideas that fall outside LikeC4 (state machines, ER, branching flowcharts).

### Web app + API (full-stack / SaaS) — *the common default*
Signals: a frontend framework **and** a server **and** a datastore.
Show: backbone; request lifecycle (browser→api→db) and **auth/login flow** as
dynamic views; Data & persistence; External integrations. ⚠️ if there are status
fields (order/subscription state), a state machine is the natural extra.

### HTTP API / microservice (no UI)
Signals: server framework + route definitions, no frontend.
Show: backbone; an **endpoint-group** component view (group routes by resource);
request lifecycle and **middleware/auth chain** flows; External integrations.

### Event-driven / messaging
Signals: Kafka/SQS/RabbitMQ/PubSub/EventBridge; producers & consumers.
Show: container view with queues/topics emphasized (amber); **event choreography**
— one async dynamic view per important event showing fan-out to consumers;
a **topic → consumer** map (filtered view). ⚠️ sagas / process managers → state machine.

### Data pipeline / ETL / streaming
Signals: Airflow/dbt/Spark/Flink/Beam, scheduled jobs, clear source→sink.
Show: a **left-to-right data-flow** view (`autoLayout LeftRight`) of stages;
per-job dynamic flow; **data lineage** (source → transforms → warehouse). ⚠️ a
branching DAG with conditionals reads better as a flowchart.

### CLI tool
Signals: `bin/`, argparse/commander/cobra/clap/oclif, subcommands.
Show: a **command-tree** component view (nested components = command → subcommands);
an **execution flow** dynamic view for the 1–2 headline commands; what it touches
(files, APIs, services) as externals. ⚠️ complex option/branch logic → flowchart.

### Library / SDK / package
Signals: published package, public API surface, no app entry point.
Show: a **public-API-surface** component view (exported modules only); a **module
dependency graph** using `dep` edges; a typical **usage flow** dynamic view.
⚠️ class hierarchies / inheritance → class diagram.

### Monorepo / multi-service platform
Signals: workspaces (pnpm/turbo/nx/go.work/cargo), many services.
Show: a **landscape** context; a **domain / bounded-context map** (groups, or one
LikeC4 project per domain); per-service container+component; **cross-service
flows** for the top journeys. Chunk by service per the SKILL's scale rule.

### Frontend SPA / component library
Signals: React/Vue/Svelte, router, component tree.
Show: a **component hierarchy** view (nested components); a **route/page map**
(group by route); a **data-fetch / render flow** dynamic view. ⚠️ UI state
machines (wizards, checkout steps) → state diagram.

### Infrastructure / IaC
Signals: Terraform/Pulumi/CloudFormation/k8s/Helm.
Show: the **deployment topology** using LikeC4's deployment model (environments,
zones, nodes, instances); **network/zone** groups; per-environment views. Keep
infra out of the logical model — put it in the `deployment` block.

### Workflow / orchestration
Signals: Temporal/Airflow/Step Functions/durable execution.
Show: each workflow as a **dynamic (sequence)** view of its activities, with
`par` for concurrent steps and `notes` for compensation/retry. ⚠️ the workflow's
own state machine → state diagram.

### ML / data science
Signals: training scripts, model artifacts/registry, feature/data prep, notebooks.
Show: a **training pipeline** flow; an **inference/serving** flow; a **feature /
data flow**; model lifecycle in the deployment view (registry → serving).

### Stateful domain (status-driven entities)
Signals: enums/`status` columns, explicit transitions (`pending→paid→shipped`).
Show: the dynamic flow that *drives* transitions (LikeC4 ✓). ⚠️ **the state
machine itself is the prime case LikeC4 cannot draw — flag it as a
recommendation; this skill won't generate it.**

## Cross-cutting lenses (apply by signal, on top of any archetype)
- **Hub detected** (one element nearly everything talks to — a platform host like
  GitHub, an API gateway, a shared DB, an event bus): plan the container map as
  lanes + a dedicated focused view *of the hub*, not a flat map. This is the
  single most common cause of an ugly diagram — see `view-recipes.md` §2b.
- **Auth present** (sessions, JWT, OAuth, Clerk/Auth0) → an auth/trust-boundary
  flow and tag the path `#pii`.
- **Stores present** → Data & persistence view.
- **Third parties present** → External-integrations (trust boundary) view.
- **Infra defined** → Deployment view.
- **Large/old codebase** → `#deprecated` overlay for migration planning.
- **Multiple teams/domains discoverable** → domain map + `#team-*` overlays.

## The wall: what LikeC4 cannot express
LikeC4 covers **architecture** — structure (context/container/component), behavior
(flow + sequence dynamic views), deployment, and filtered/grouped overlays. It is
**not** a general diagramming tool. These families have no LikeC4 representation:
- **State machines** (state→state transitions)
- **ER / data models** (entities + attributes + cardinality)
- **Branching flowcharts / decision logic** (if/else gateways)
- **Class diagrams** (UML classes, methods, inheritance)

This skill is **C4-only** — it does not produce these (no Mermaid or other
formats). When the repo would genuinely benefit from one, **name it in the plan
and flag it ⚠️ as a note to the human** (e.g. "an order state machine would help
here — outside C4's scope"), but don't generate it and don't force it into a
LikeC4 view where it would read poorly. Express what you can in C4: a status-driven
entity still gets the *dynamic flow* that drives its transitions, even though the
state machine itself stays a recommendation.
