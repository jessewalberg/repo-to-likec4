# LikeC4 DSL cheat-sheet

Condensed, correct syntax. Source files use `.c4` or `.likec4`. All files in a
project are merged into one model. A file has any of: `specification`, `model`,
`views`, `global`.

> **Gotchas that cause most failures (verified against the CLI, 1.57.0):**
> 1. **Tags come FIRST** inside any element block — before `summary`/`description`/
>    `icon`/etc. `service api { #public  description '...' }`, never after. Tags
>    after other properties is a hard parse error.
> 2. **Icon ids must be exact** — `validate` HARD-REJECTS a non-existent id
>    (`Could not resolve reference to LibIcon …`), e.g. `tech:cursor` does not
>    exist. But it does NOT catch a *valid-but-wrong* icon: `bootstrap:cursor` is
>    a real id (a mouse-pointer glyph), so it passes validate yet is the wrong
>    picture for the Cursor editor. **Never substitute a same-named glyph from
>    another pack** — a wrong icon is worse than none. Find real ids with
>    `likec4 list-icons --format json --group tech`; if no brand icon exists, use
>    an absolute SVG URL (`icon https://…`) or `icon none`.
> 3. **`navigateTo` is NOT an element-body property** — `api = service '…' {
>    navigateTo v }` fails to parse. It is valid ONLY (a) on a *relationship*
>    body, pointing at a **dynamic** view (`a -> b { navigateTo someFlow }`), or
>    (b) in a *view-level* customization block (`include api with { navigateTo
>    apiView }`). For element drill-down, define a scoped `view of api` (auto
>    click-target) or set it in the view's `with { }`.
> 4. **`summary` shows on the node FACE; `description` only in the click panel.**
>    Put a short one-liner in `summary` and the rich markdown in `description`,
>    or the whole description lands on the face → bulky boxes.
> 5. **Source `link`s must be ABSOLUTE URLs.** Relative paths (`../src/x.ts`)
>    resolve in VS Code but become dead `file://` links in the published site
>    (no base-for-links config exists). Emit `https://github.com/…/blob/<ref>/<path>#L1-L40`.
> 6. **Merged edges show a literal `[...]`** when a node pair has multiple
>    relationships. Give the edge a single explicit title, or expand it with
>    `include a -> b with { multiple true }` (1.57+), or don't pull many
>    low-level edges up into a high-altitude view.
> 7. **Tag colors are hex/rgb only** in the spec (`tag pii { color #E5484D }`),
>    not theme names like `red`. (Element/style colors *do* accept names.)
> 8. **Order is significant** in views: `exclude` only removes what an earlier
>    `include` added; and a `group` only ADOPTS an element if no parent of it is
>    already in the view — so put a group's own `include` BEFORE a broad
>    `include *`, or the group box renders EMPTY.
> 9. **Requires LikeC4 ≥ 1.57.0** — `summary` (1.41), `multiple` edge-expansion
>    (1.57), static-site relationship popovers (1.57), external-link click (1.56),
>    `list-icons` (1.54) are all version-gated. Pin it.
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
A rich element carries SIX things — the difference between a bare box and a
clickable, source-linked node:
```likec4
model {
  customer = person 'Customer'
  cloud = system 'Our System' {
    #public #pii                         // 1. tags — MUST come first inside the block
    summary 'One-line, shows on the node FACE'   // 2. summary — keep it SHORT
    description '''                       // 3. description — rich markdown, click-panel only
      Longer **markdown** with triple quotes: lists, `code`, and
      [links](https://github.com/org/repo/blob/main/docs/architecture.md).
    '''
    technology 'Kubernetes'              // 4. technology
    icon tech:kubernetes                 // 5. icon — bundled aws:/azure:/gcp:/tech:/bootstrap: OR https://…/logo.svg
    link https://github.com/org/repo 'Repo'      // 6. link(s) — ABSOLUTE; repeatable; quoted title = panel text
    link https://github.com/org/repo/blob/main/apps/api/index.ts#L1-L40 'Source'
    metadata {                           // structured facts → details panel (alphabetised)
      owner 'platform-team'
      path 'apps/api'
      loc '420'                          // quote ALL values, even numbers
    }

    ui = webapp 'Web UI' { summary 'React SPA'  icon tech:react }
    api = service 'API'  { summary 'REST API'   icon tech:nodejs }
    db  = database 'Postgres' { summary 'primary store'  icon tech:postgresql }

    ui -> api 'calls'                    // relationship, nested
    api -> db 'reads/writes'
  }
  customer -> ui 'uses' 'via browser' 'HTTPS'   // [title] [description] [technology]
}
```
Names: letters/digits/`-`/`_`, can't start with a digit, no `.`. Title defaults
to name. **`summary` shows on the node face; `description` (markdown) shows only
in the click-through details panel** — so give every element a short summary AND
a rich description. The panel also renders `technology`, all `link`s (each shown
by its quoted title), `metadata` (sorted), tags, and the element's in/out
relationships + the other views it appears in. Relationships take the same
`{ … }` body (`description`, `technology`, `link`, `metadata`, `navigateTo`).

### Relationships
```likec4
a -> b                       // basic
a -[async]-> b               // kinded   (or:  a .async b)
a -> b 'label' { #tag  technology 'gRPC'  link https://… 'Source' }
a -> b 'label' { navigateTo someDynamicView }   // navigateTo on a rel → a DYNAMIC view only
actor { -> b }               // "sourceless": source is the parent element
customer { it -> ui }        // 'it' / 'this' = parent
```
Give every edge a short verb-led title ("emits OrderPlaced", not "uses"). A
relationship's `{ }` body can carry `description`, `technology`, `link`, and
`metadata` — all surface in the edge's click panel.

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
- **color:** `primary`(default) `secondary` `muted` `amber` `gray` `green` `indigo` `red` — plus the extended 1.57 palette (`slate` `blue` `sky` and more) and any custom color from the spec
- **icon:** `<pack>:<id>` (bundled) · `https://…/logo.svg` (absolute URL — works in the published site) · `./icons/x.svg` (committed local, relative to the .c4 file) · `none`. `iconColor` recolors ONLY `bootstrap:` and inline-SVG icons — never `tech:`/`aws:`/`gcp:`/`azure:` brand logos (those keep brand color); fix low icon contrast by changing the node fill instead.
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
include api with { navigateTo apiComponents }                // element drill-down (NOT an element-body prop)
include a -> b with { multiple true }                        // expand merged edges → no '[...]' (1.57+)

include cloud.* where metadata.environment is "production"   // metadata filter

style * { color muted  opacity 15% }                         // style predicate (cascades)
style element.tag = #deprecated { color muted }

group 'Backend' { color amber  opacity 20%  include backend.* }   // boundary box — its include must come
                                                                  // BEFORE a broad `include *` or it's EMPTY

rank same { a, b }    // also: min max source sink — align peers / pin a hub (element views only, not dynamic)
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
    variant sequence                    // render as classic lifelines (default is the spatial 'diagram')
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
Render as `diagram` (the spatial default) or classic lifelines. To get lifelines:
add `variant sequence` to the view body (the hosted viewer then defaults that
view to sequence and offers a toggle), and for PNG export pass `--seq`
(`likec4 export png --seq`). The sequence layout supports **leaf** elements only
— a step that references a parent container with children silently falls back, so
author flows between leaf `component`/`service` nodes. `include a, b, c` sets the
actor order.

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
npx likec4@1.57.0 serve              # dev server, hot reload (alias: start, dev) — local preview
npx likec4@1.57.0 build -o ./dist    # build the static interactive site (this is what Pages serves)
npx likec4@1.57.0 validate           # CI: non-zero on errors / unknown icons / layout drift — run before publishing
npx likec4@1.57.0 format             # CI: --check
npx likec4@1.57.0 list-icons --format json --group tech   # find EXACT bundled icon ids (don't guess)
npx likec4@1.57.0 export png --seq -o ./png   # PNG with dynamic views as sequence lifelines (verification only)
```
Pin the version (`likec4@1.57.0`): the clickable-detail panel, static-site
relationship popovers, and `multiple` edge-expansion are version-gated.
This skill publishes the **hosted site** (see `references/publishing.md` and
`assets/workflows/likec4-pages.yml`); it does not export image files. The CLI can
also `export png|jpg|json|drawio` and `gen mermaid|dot|d2|plantuml|react` if ever
needed, but that's outside this skill's flow.

MCP server (query the model in natural language): `npx -y @likec4/mcp`
(env `LIKEC4_WORKSPACE`), or `likec4 mcp --http`, or the VS Code extension's
built-in server. Official syntax skill: `npx skills add https://likec4.dev/`.
