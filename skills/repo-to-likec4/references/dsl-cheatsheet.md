# LikeC4 DSL cheat-sheet

Condensed, correct syntax. Source files use `.c4` or `.likec4`. All files in a
project are merged into one model. A file has any of: `specification`, `model`,
`views`, `global`.

> **Gotchas that cause most failures (verified against the CLI):**
> 1. **Tags come FIRST** inside any element block — before `title`/`description`/
>    `icon`/etc. `service api { #public  description '...' }`, never after. Tags
>    after other properties is a hard parse error.
> 2. **Icon ids must be exact** — `validate` rejects unknown ones (`tech:kafka`
>    not `tech:apache-kafka`; `aws:dynamo-db` not `aws:dynamodb`).
> 3. **Tag colors are hex/rgb only** in the spec (`tag pii { color #E5484D }`),
>    not theme names like `red`. (Element/style colors *do* accept names.)
> 4. **Order is significant** in views: `exclude` only removes what an earlier
>    `include` added.
> Run `likec4 validate` after each edit; it pinpoints the line.


## Contents
1. Specification (vocabulary)
2. Model (elements + relationships)
3. References & scope
4. Extending across files / monorepos
5. Styling values
6. Views & predicates
7. Dynamic (sequence) views
8. Deployment model
9. CLI & tooling

---

## 1. Specification
Defines the *kinds* you may use. (See `assets/specification.c4` for a styled set.)
```likec4
specification {
  element service {              // an element kind
    notation 'Service'           // legend label
    technology 'REST'            // default, overridable per element
    style { shape rectangle  color primary }
  }
  relationship async {           // a relationship kind
    line dotted  color amber  head vee  tail none
  }
  tag deprecated { color #FF0000 }
  color brandblue #2563EB        // optional custom colors (3/6/8-hex or rgb()/rgba())
}
```

## 2. Model
```likec4
model {
  // <name> = <kind> 'Title' 'summary' { ... }     OR     <kind> name 'Title'
  customer = person 'Customer'
  cloud = system 'Our System' {
    description 'Longer markdown ok with triple quotes'
    technology 'Kubernetes'
    icon tech:kubernetes                 // bundled: aws: azure: gcp: tech: bootstrap:  (or URL / ../local.svg)
    #public #pii                         // tags MUST come first inside the block

    ui = webapp 'Web UI' { icon tech:react  shape browser }
    api = service 'API'   { icon tech:nodejs }
    db  = database 'Postgres' { icon tech:postgresql }

    ui -> api 'calls'                    // relationship, nested
    api -> db 'reads/writes'
  }
  customer -> ui 'uses' 'via browser' 'HTTPS'   // [title] [description] [technology]

  link https://github.com/org/repo 'Repo'        // elements/rels can carry links
  metadata { owner 'platform-team' }              // string values; arrays allowed: tags ['a','b']
}
```
Names: letters/digits/`-`/`_`, can't start with a digit, no `.`. Title defaults
to name. `summary` shows on the diagram; full `description` shows in the details
dialog.

### Relationships
```likec4
a -> b                       // basic
a -[async]-> b               // kinded   (or:  a .async b)
a -> b 'label' { #tag  navigateTo someDynamicView  technology 'gRPC' }
actor { -> b }               // "sourceless": source is the parent element
customer { it -> ui }        // 'it' / 'this' = parent
```

## 3. References & scope
Lexical scope with hoisting (like JS). An element is unique within its parent's
`{}`; it "bubbles up" to outer scopes while it stays unambiguous. If ambiguous,
qualify it: `service1.api`. Top-level model elements are global.

## 4. Extending across files (key for monorepos)
```likec4
// landscape.c4
model { cloud = system 'Cloud' }
// services/billing.c4 — re-open 'cloud' and add to it
model {
  extend cloud {
    billing = service 'Billing' { icon tech:go }
    billing -> api               // 'api' resolvable inside cloud's scope
  }
}
```
Extended elements must be referenced by fully-qualified name. Metadata/tags
merge across `extend`s. For truly separate domains, give each folder a
`likec4.config.json` (a *project*) and use `import { x } from 'other-project'`.

## 5. Styling values
- **shape:** `rectangle`(default) `component` `storage` `cylinder` `browser` `mobile` `person` `queue` `bucket` `document`
- **color:** `primary`(default) `secondary` `muted` `amber` `gray` `green` `indigo` `red` (+ custom from spec)
- **size / padding / textSize / iconSize:** `xs sm md lg xl` (default `md`)
- **border:** `dashed`(default) `dotted` `solid` `none`
- **line:** `dashed`(default) `solid` `dotted`
- **arrow head/tail:** `normal onormal diamond odiamond crow vee open none`
- **opacity:** e.g. `opacity 25%`  • **multiple true** (stacked look)  • **iconPosition** `left right top bottom`  • **iconColor** (for `bootstrap:` icons)

## 6. Views & predicates
```likec4
views {
  view index {                         // 'index' renders by default
    title 'Landscape'
    include *                          // unscoped: top-level elements only
    autoLayout LeftRight 120 110       // TopBottom(default) BottomTop LeftRight RightLeft  [rankSep nodeSep]
  }

  view ofApi of cloud.api {            // scoped: '*' = this element + its children
    include *
  }
}
```
**Element predicates** (order matters; exclude only removes things already included):
```likec4
include backend, frontend            // explicit, brings their mutual relationships
include cloud.*                      // children
include cloud.**                     // all descendants that relate to visible elements
include cloud._                      // element + only children that have relationships
exclude cloud.legacy
```
**Relationship predicates:**
```likec4
include a -> b           // directed
include a <-> b          // any direction
include -> backend       // incoming to backend (from visible)
include backend ->       // outgoing from backend
include -> cloud.* ->    // nested of cloud that relate to visible
```
**Filter / override / group / rank:**
```likec4
include cloud.* where kind is service and tag != #deprecated
include cloud.* with { color amber  textSize sm }            // override props in this view
include api with { navigateTo apiComponents }                // drill-down link

include cloud.* where metadata.environment is "production"   // metadata filter

style * { color muted  opacity 15% }                         // style predicate (cascades)
style element.tag = #deprecated { color muted }

group 'Backend' { color amber  opacity 20%  include backend.* }   // boundary box

rank same { a, b }    // also: min max source sink  — align/anchor for layout
```
Reusable predicates/styles live in `global { predicateGroup ... }` /
`global { style name * {...} }` and are applied with `global predicate name` /
`global style name`. `view v2 extends v1 { ... }` inherits predicates+styles
(good for presentation "slides").

## 7. Dynamic (sequence) views
Describe a scenario without touching the model.
```likec4
views {
  dynamic view checkout {
    title 'Checkout flow'
    customer -> web 'clicks buy'
    web -> api 'POST /orders'
    api -> db 'insert order'
    web <- api 'returns 201'           // backward step = response
    // continuous form:  customer -> web -> api -> web
    parallel {                          // or 'par' — no nesting
      api -> queue 'emit OrderPlaced'
      api -> cache 'warm'
    }
    api -> auth { notes 'validates JWT (markdown ok)' }
    include cloud, ui                   // optional: show non-participating context
  }
}
```
Render as `diagram` (default) or classic `sequence` (CLI `--seq`). Sequence
variant supports **leaf** elements only. `include a, b, c` sets actor order.

## 8. Deployment model (physical topology)
```likec4
specification { deploymentNode environment ; deploymentNode zone ; deploymentNode k8s { style { icon tech:kubernetes } } }
deployment {
  environment prod {
    zone eu {
      k8s cluster {
        instanceOf cloud.api           // deploy a logical element here
        api2 = instanceOf cloud.api    // named instance
      }
      db = instanceOf cloud.db
    }
  }
}
```
Deployment views: `deployment view prod { include * }`. Relationships are
inherited from the logical model; you can add deployment-only ones.

## 9. CLI & tooling
```sh
npx likec4 serve                 # dev server, hot reload (alias: start, dev)
npx likec4 build -o ./dist       # static interactive site;  --output-single-file for one html
npx likec4 export png -o ./out   # PNG via Playwright;  also: jpg --quality 90 ;  --theme dark ;  --seq
npx likec4 export json -o m.json
npx likec4 export drawio -o ./out --uncompressed
npx likec4 gen mermaid|dot|d2|plantuml|react
npx likec4 validate              # CI: non-zero on errors / layout drift
npx likec4 format                # CI: --check
```
MCP server (query the model in natural language): `npx -y @likec4/mcp`
(env `LIKEC4_WORKSPACE`), or `likec4 mcp --http`, or the VS Code extension's
built-in server. Official syntax skill: `npx skills add https://likec4.dev/`.
