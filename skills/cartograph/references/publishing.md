# Publishing the Cartograph viewer

The viewer is **one self-contained `index.html`** with its data inlined, so
"hosting" is just serving a static file. Default flow deploys the committed file;
an optional variant rebuilds it in CI on every push.

## GitHub Pages (default — deploy the committed viewer)

1. `assets/workflows/cartograph-pages.yml` → `<repo>/.github/workflows/`.
2. Commit `cartograph-site/index.html` + the workflow; push.
3. **One-time:** repo **Settings → Pages → Source = "GitHub Actions"**.
4. The workflow runs on push to the default branch (and via *Run workflow*). The
   live URL shows in the Actions run summary and under Settings → Pages, typically
   `https://<owner>.github.io/<repo>/`.

The deploy job uses `actions/configure-pages` → `upload-pages-artifact`
(`path: cartograph-site`) → `deploy-pages`. No Node, no secrets — it only uploads
the static file. Needs repo `pages: write` + `id-token: write` (already in the
workflow `permissions`).

**Refresh:** re-run the skill (generate → bundle), commit the new
`cartograph-site/index.html`, push. The three-way merge preserves human edits; the
push redeploys. Manual refresh is the chosen default (per the token-cost research:
manual `/map` + opt-in CI, not regenerate-on-every-push).

### Custom domain

Add `cartograph-site/CNAME` containing your domain (e.g. `arch.example.com`) and
point a DNS `CNAME` at `<owner>.github.io`. Settings → Pages → Custom domain.

## Optional: rebuild in CI on push (always-fresh)

If you'd rather regenerate from source on every push (architecture can never drift
from the code), commit the engine into the repo and use a build-then-deploy job:

```yaml
# .github/workflows/cartograph-pages.yml (rebuild variant)
name: Cartograph Pages
on:
  push: { branches: [main] }
  workflow_dispatch: {}
permissions: { contents: read, pages: write, id-token: write }
concurrency: { group: pages, cancel-in-progress: true }
jobs:
  build-deploy:
    runs-on: ubuntu-latest
    environment: { name: github-pages, url: "${{ steps.deploy.outputs.page_url }}" }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "24" }
      - run: npm install --prefix tools/cartograph-engine          # where you vendored assets/engine
      - run: |
          node tools/cartograph-engine/generate.ts --repo . --name "${{ github.repository }}" \
            --ref "${{ github.ref_name }}" --out .cartograph
          node tools/cartograph-engine/bundle.ts \
            --template tools/cartograph-engine/viewer-template.html \
            --data .cartograph --out cartograph-site/index.html
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with: { path: cartograph-site }
      - id: deploy
        uses: actions/deploy-pages@v4
```

Cost note: generation is currently **deterministic** (no LLM), so CI rebuilds are
cheap. Once the LLM-authored prose / view-refine stage lands, prefer Batch API +
a daily spend cap (see the project's Phase-0 token-cost findings) before enabling
rebuild-on-every-push on a busy repo.

## GitLab Pages

Equivalent `.gitlab-ci.yml` serving the same static dir:

```yaml
pages:
  stage: deploy
  script: [ "mkdir -p public", "cp cartograph-site/index.html public/index.html" ]
  artifacts: { paths: [ public ] }
  rules: [ { if: "$CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH" } ]
```

GitLab Pages publishes the `public/` artifact automatically; the URL appears under
**Deploy → Pages**.

## Any static host

`cartograph-site/index.html` works on Netlify, Vercel (static), S3+CloudFront, or a
plain web server — it's a single file. It also opens directly via `file://` for
offline review.
