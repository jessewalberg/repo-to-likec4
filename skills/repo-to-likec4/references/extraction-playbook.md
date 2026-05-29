# Extraction playbook (Phase 1 recon)

Goal: produce `likec4/ARCHITECTURE-FACTS.md` — a small, deterministic manifest
of the repo's *structure and edges*, discarding implementation. Build the model
from this, not from source. Prefer cheap shell tools over reading files; only
read a file when you need a name or a purpose.

## Contents
1. Universal first pass (any repo)
2. High-signal files (always check)
3. Per-language edge extraction
4. Signal → LikeC4 element/relationship mapping
5. The manifest template

---

## 1. Universal first pass
```sh
# Skeleton (tracked files only — ignores build artifacts/node_modules)
git ls-files | head -300
git ls-files | sed 's#/[^/]*$##' | sort -u        # directories = candidate modules
# Stack fingerprint
ls package.json go.mod pyproject.toml requirements.txt Cargo.toml pom.xml build.gradle* composer.json Gemfile 2>/dev/null
# Entry points & boundaries (fast, language-agnostic greps)
rg -n --no-heading -g '!**/{node_modules,dist,build,vendor,.next,target}/**' \
   -e 'listen\(' -e 'createServer' -e '@(Get|Post|Put|Delete|Patch)Mapping' \
   -e 'app\.(get|post|put|delete|patch)\(' -e 'router\.' -e 'addEventListener' \
   -e '@app\.(route|get|post)' -e 'func main\(' -e 'cron|schedule|@Scheduled' | head -80
# External integrations / stores via env + SDKs
[ -f .env.example ] && cat .env.example
rg -n -e 'DATABASE_URL|REDIS_URL|KAFKA|RABBIT|S3_|AWS_|STRIPE|TWILIO|SENDGRID|OPENAI|SUPABASE|CLERK|CONVEX' \
   --no-heading -g '!**/node_modules/**' | head -60
```

**Compute the source-link base now** (this is what makes nodes clickable — see §4b).
For every element you'll record the file/dir it maps to and turn it into an
ABSOLUTE blob URL (relative paths render dead on the published site):
```sh
REMOTE=$(git remote get-url origin)                 # e.g. git@github.com:org/repo.git
REF=$(git rev-parse --abbrev-ref HEAD)              # or a tag/SHA for stable links
# Normalise to an https base, then per element append the path (+ #L start-end):
#   GitHub:  https://github.com/<org>/<repo>/blob/<ref>/<path>#L1-L40
#   GitLab:  https://gitlab.com/<org>/<repo>/-/blob/<ref>/<path>#L1-40   (note /-/ and single-dash anchor)
echo "$REMOTE" "$REF"
```

## 2. High-signal files (read these — they often hand you the diagram)
- **`docker-compose.yml` / `compose.yaml`** — services + `depends_on` + ports = a ready-made container map and edges.
- **`k8s/`, `*.yaml` manifests, `helm/`** — Deployments, Services, Ingress = deployment topology.
- **`terraform/`, `*.tf`, `serverless.yml`, `template.yaml` (SAM)** — managed resources (DBs, queues, buckets, functions) and wiring.
- **`.env.example`** — every external dependency the app expects.
- **Workspace manifests** — `package.json` (`workspaces`), `pnpm-workspace.yaml`, `turbo.json`, `nx.json`, `go.work`, Cargo `[workspace]`, Gradle settings = the service list for a monorepo.
- **`README` / `docs/`, `openapi.*`/`swagger`, `*.proto`, `schema.prisma`/`schema.sql`** — names, purposes, API surface, data model.

## 3. Per-language edge extraction
Use a real dependency-graph tool when available; fall back to import greps.

| Stack | Module/dep graph | Import grep fallback |
|---|---|---|
| JS/TS | `npx madge --json src` (or `--image graph.svg`); `npx depcruise --output-type json src` | `rg -n "^import .* from ['\"]" ` , `require(` |
| Python | `pipx run grimp` / `pydeps pkg --show-deps --no-output`; `import-linter` | `rg -n "^(from|import) "` |
| Go | `go list -deps -json ./...`; `go mod graph` | `rg -n "\t\"[a-z0-9./-]+\"" *.go` (import blocks) |
| Rust | `cargo modules structure`; `cargo tree -e normal` | `rg -n "^use "` |
| Java/Kotlin | `jdeps -verbose:class build/libs/*.jar`; Gradle `dependencies` | `rg -n "^import "` |
| C# | `dotnet list reference`; project `<ProjectReference>` | `rg -n "^using "` |
| Ruby | `bundle list`; `rg -n "require(_relative)?"` | — |
| PHP | `composer show --tree` | `rg -n "^use "` |

Keep only **cross-module / cross-service / external** edges — intra-file calls
are noise. Collapse a directory of files into the one component it represents.

## 4. Signal → LikeC4 mapping
Translate findings to the pre-styled kinds in `assets/specification.c4`.

| You find… | Element kind | Notes / icon hint |
|---|---|---|
| SPA / SSR frontend (React/Vue/Svelte/Next) | `webapp` | `icon tech:react` etc., `shape browser` |
| iOS/Android/React-Native/Flutter app | `mobileapp` | `icon tech:flutter` … |
| HTTP/REST/GraphQL/gRPC server | `service` | `icon tech:nodejs`/`tech:go`/`tech:python` … |
| Background consumer / job runner / cron | `worker` | label what it processes |
| Lambda / Cloud Function / serverless handler | `function` | `icon aws:lambda`, `multiple true` |
| API gateway / reverse proxy / edge (Kong, Nginx, ALB, tRPC edge) | `gateway` | — |
| Internal package/module (no own runtime) | `component` | for Component-level views |
| Relational/NoSQL DB (Postgres, Mongo, DynamoDB) | `database` | `icon tech:postgresql` / `aws:dynamo-db` |
| Redis / Memcached / in-mem cache | `cache` | `icon tech:redis` |
| S3 / GCS / blob storage | `bucket` | `icon aws:simple-storage-service` |
| Kafka / SQS / RabbitMQ / PubSub / EventBridge | `queue` | `icon tech:kafka` / `aws:simple-queue-service` |
| Stripe, Twilio, SendGrid, OpenAI, Auth0, any 3rd-party API | `externalSystem` | `#external`; vendor icon if available |
| Human role from auth/roles/README | `person` | `shape person` |

| Edge signal | Relationship kind |
|---|---|
| HTTP/RPC/GraphQL client call, `fetch`, SDK request | `sync` |
| Publishes/subscribes event, enqueues job, emits to topic | `async` |
| SELECT / find / get from a store | `reads` |
| INSERT/UPDATE/write/put to a store | `writes` |
| Library/package build dependency (only if architecturally meaningful) | `dep` |

Tag rules: internet-facing entry points `#public`; third parties `#external`;
anything on an auth / personal-data path `#pii`; legacy `#deprecated`; in-flight
work `#new`. Add `#team-*` / `#domain-*` if ownership is discoverable.

## 4b. Capture source links + metadata + verify icons (makes nodes clickable)
The recon already located each element's files — don't throw the paths away.
For every element record three extra things so the model becomes a clickable map,
not just a picture:

- **`source`** → one or more ABSOLUTE blob URLs (`<base>/<path>#L<start>-L<end>`),
  emitted as `link <url> 'Source'` (plus labelled links for the workflow YAML,
  Dockerfile, `package.json`, OpenAPI, README where they exist). Point at the
  *definition* — the route file, the worker entry, the migration. Never relative.
- **`metadata`** → deterministic facts you already have: `path`, `language`,
  `package`, `loc`, `owner` (from CODEOWNERS), and for CI/workflow nodes
  `workflow`, `triggers`, `runner`. These render (alphabetised) in the click panel.
- **`summary`** → the one-liner for the node face; keep the longer prose for
  `description` (markdown). The LLM writes summary/description; the recon owns the
  paths, links, icon ids, and metadata facts.

**Verify every icon id before emitting it** — don't guess and don't reach for a
same-named glyph in another pack (that's how `bootstrap:cursor`, a mouse-pointer,
ended up labelling the Cursor editor):
```sh
npx likec4@1.57.0 list-icons --format json --group tech | rg -i 'postgres|redis|react'
# brand has no pack icon? use its official SVG by ABSOLUTE url:  icon https://brand.com/favicon.svg
# still nothing sensible?  icon none   — never a wrong-meaning glyph
```

## 5. Manifest template
Write this to `likec4/ARCHITECTURE-FACTS.md`. Keep it terse — it's an
intermediate artifact, but a human should be able to skim and correct it.

```md
# Architecture facts — <repo>

## Stack
<languages, frameworks, package manager, runtime; monorepo? services count>

## Scale decision
single-app | monorepo-one-project | multi-project   (per SKILL.md table)

## Actors / personas
- <name> — <what they do>

## Elements
`summary` = the short node-face line; `path` becomes the absolute source `link`;
`facts` become `metadata`. Verify every `icon` id with `list-icons`.

| id | kind | title | summary (face) | technology | icon | path → source link | facts (→ metadata) | tags |
|----|------|-------|----------------|-----------|------|--------------------|--------------------|------|
| api | service | API | REST API for the web client | Node/Express | tech:nodejs | apps/api/src/index.ts#L1-L40 | language=TS, package=@org/api | #public |
| db  | database | Postgres | primary datastore | PostgreSQL | tech:postgresql | infra/db/schema.sql | engine=postgres, pii=profiles | #pii |
| ...

## Edges
| source | target | kind | label |
|--------|--------|------|-------|
| webapp | api | sync | fetches data (HTTPS) |
| api | db | writes | persists orders |
| api | queue | async | emits OrderPlaced |
| ...

## External systems
- Stripe — payments (api -> stripe, sync)
- ...

## Key runtime flows (pick the 3–5 that matter most)
1. **Signup**: customer -> webapp -> api -> db; api -> email (async)
2. **Checkout**: ...
3. ...

## Diagram plan (from references/repo-archetypes.md)
Repo archetype(s): <e.g. web-app + API + stateful-domain>
Diagrams to produce (each with a one-line rationale):
- System Context — orientation for newcomers
- Container map — the runnable parts + drill-down
- Component: api — routes → services → repos
- Flow (sequence): checkout — the core revenue path
- Data & persistence — shared-DB coupling check
- ⚠️ Order state machine — outside C4 scope; recommend to human (not generated)

## Deployment (only if compose/k8s/terraform present)
<environments, nodes, what runs where>

## Open questions / assumptions
- <anything inferred rather than confirmed — flag for the human>
```

When the repo is unfamiliar or large, **stop after writing the manifest** and
ask the human to confirm before modeling. Cheap to fix here, expensive later.
