# Publish to Pages (GitHub or GitLab)

This skill renders one way: an **interactive site hosted on the code host's
Pages** — full pan/zoom, icons, drill-down via `navigateTo`, and a per-view
"Share" link. No image files are generated or committed; the diagrams are the
live site, built from the model in CI on every change. (Neither host renders
`.c4` inline, which is why the diagrams are served as a site.)

**Pick the flow by where the user's code lives:**
```sh
git remote get-url origin    # github.com/… → GitHub;  gitlab.com / gitlab.* → GitLab
```
or by which CLI is authenticated (`gh auth status` vs `glab auth status`). Then
follow the matching section below.

## GitHub Pages (`gh`)
If the GitHub CLI is authenticated (e.g. Claude Code after `gh auth login`),
automate the whole publish — including enabling Pages, the one step that used to
be a manual click:

```sh
# 0. (only if the repo isn't on GitHub yet) create it and push
gh repo create <owner>/<repo> --public --source=. --push

# 1. workflow in place (copy from assets/workflows/)
mkdir -p .github/workflows && cp <skill>/assets/workflows/likec4-pages.yml .github/workflows/

# 2. enable Pages with GitHub Actions as the source (no manual Settings click)
gh api --method POST repos/<owner>/<repo>/pages -f build_type=workflow \
  || gh api --method PUT repos/<owner>/<repo>/pages -f build_type=workflow
#  POST creates it; if it already exists POST returns 409 and the PUT updates it.

# 3. commit + push → the workflow builds and deploys
git add -A && git commit -m "architecture diagrams (LikeC4 + Pages)" && git push
```

Why this works without a PAT: your `gh` user token (you own the repo) is allowed
to call the Pages API. Note the *in-workflow* auto-enable (`configure-pages`
`enablement: true`) is **not** used — that one needs a PAT because the workflow's
`GITHUB_TOKEN` can't enable Pages. Enabling it out-of-band with `gh` avoids that.

**Fallback (no `gh`, or the token lacks permission):** copy the workflow in, then
do it by hand — Repo → **Settings → Pages → Build and deployment → Source =
"GitHub Actions"** — and push. If `gh api` returns 403 ("Resource not accessible"),
fall back to this and tell the user.

If the `.c4` sources aren't in `./likec4`, edit the `path:` in the workflow.

## GitLab Pages (`glab`)
GitLab is simpler — **no enable step**. A job named `pages` that publishes a
`public/` artifact deploys automatically on the default branch. `likec4 build`
produces a static site (no headless browser — that's only for PNG export), so a
plain Node image suffices.

```sh
# 0. (only if not on GitLab yet) create the project and push
glab repo create <namespace>/<project> --public        # self-managed: GITLAB_HOST=<host> glab repo create …
git remote add origin <url> && git branch -M main && git push -u origin main

# 1. CI config at the repo ROOT, named exactly .gitlab-ci.yml
cp <skill>/assets/workflows/gitlab-pages.yml .gitlab-ci.yml
#  if the repo already has a .gitlab-ci.yml, merge in the `pages` job instead.

# 2. commit + push → the `pages` job runs and deploys automatically
git add -A && git commit -m "architecture diagrams (LikeC4 + Pages)" && git push
```

The CI job derives the **base path** from `$CI_PAGES_URL` at build time, so it
works whether the project uses GitLab's path-based URL
(`https://<group>.gitlab.io/<project>/`) or a unique domain
(`https://<project>-<hash>.gitlab.io/`) — no hardcoding.

Getting the URL for the README: it often isn't known until the first deploy
(unique domains include a random hash). After the pipeline's `pages` job runs,
read it from **Settings → Pages**, the `pages` environment on the pipeline, or
`glab api projects/:id/pages`. It's the value of `CI_PAGES_URL`.

## Result and the README link
On every push to the default branch, CI builds and deploys the site:
- **GitHub:** `https://<owner>.github.io/<repo>/` (project) or `<owner>.github.io`
  (user/org root), or a custom domain via `CNAME`.
- **GitLab:** the value of `CI_PAGES_URL` — path-based or a unique domain.

**The skill adds this link to the repo's README** near the top:
```md
**[📐 Architecture diagrams](<pages-url>)** — interactive, auto-updated
```
On GitHub the URL is derivable from the remote, so insert it before pushing. On
GitLab (unique domains especially) it may be unknown until the first deploy —
leave a `<!-- TODO: Pages URL -->` placeholder and fill it from `CI_PAGES_URL`.

## Local preview while iterating
```sh
cd likec4 && npx likec4 serve     # http://localhost:5173, hot reload
```

## Gotchas
- **GitHub: Pages must use the "GitHub Actions" source** — the skill sets this via
  `gh api`; skip it and the deploy job errors on the missing `github-pages`
  environment. **GitLab needs no enable step** — the `pages` job is enough.
- **GitLab: the job must be named `pages` and publish `public/`** — any other name
  or output dir is ignored. Only the default branch deploys (the `rules:` enforce
  this).
- **`base` path**: GitHub uses the action's `base_path` output (the repo
  sub-path); GitLab derives it from `$CI_PAGES_URL`. Both resolve assets under the
  served sub-path automatically.
- The built site is a CI artifact (`dist/` on GitHub, `public/` on GitLab) — not
  committed (both are in `.gitignore`). The repo tracks only the `.c4` sources and
  the CI config.
