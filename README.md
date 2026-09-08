# Stroppy documentation

Docusaurus site for [Stroppy](https://github.com/stroppy-io/stroppy), published
at [stroppy.io](https://stroppy.io).

## Requirements

- Node.js 20 or newer (deployment uses Node 22)
- npm

## Local development

```bash
npm ci
npm run start
```

Development server runs at `http://localhost:3000`. Local search and generated
`llms.txt` files are available only in production builds.

## Production checks

```bash
npm run sync-changelog
npm run typecheck
npm run build
npm run serve
```

`npm run build` runs changelog synchronization first and writes output to
`build/`. Broken internal links fail the build.

## Deployment

Pull requests target `next`. Pushes to `next` trigger
`.github/workflows/deploy.yml`, which installs locked dependencies, builds the
site, and deploys `build/` to GitHub Pages. Scheduled builds refresh the
changelog from Stroppy main twice daily.

## Documentation versions

- `docs/` contains current development documentation and publishes at
  `/docs/next/`.
- `versioned_docs/version-X.Y.Z/` contains frozen release snapshots.
- `versions.json` orders published snapshots.
- `versioned_sidebars/` freezes navigation per release.
- `docusaurus.config.ts` selects `lastVersion`, which serves from `/docs/`.

Create a release snapshot only after current docs and sidebars are ready:

```bash
npm run sync-changelog
npm run docusaurus -- docs:version X.Y.Z
node scripts/slice-version-changelog.mjs X.Y.Z
```

Then set `lastVersion` in `docusaurus.config.ts`, run typecheck/build, and review
generated versioned files.

## Content layout

```text
docs/                    current product documentation
versioned_docs/          frozen product documentation
versioned_sidebars/      frozen navigation
blog/                    historical articles
src/pages/index.tsx      landing page
src/css/custom.css       site theme
static/                   logos and article images
scripts/                  changelog synchronization/version slicing
sidebars.ts               current navigation
docusaurus.config.ts      site, docs, navbar, footer, plugins
```

Blog prose is historical. When product/docs links need maintenance, point them
to the release corresponding to each article rather than rewriting past claims.
