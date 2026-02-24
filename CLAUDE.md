# Stroppy Docs

Documentation site for [Stroppy](https://github.com/stroppy-io/stroppy) — a database stress testing CLI built as a k6 extension. Docusaurus 3.9.2, React 19, TypeScript.

## Running

```bash
npm run start          # Dev server on localhost:3000 (no search, no llms.txt)
npm run build          # Production build → ./build/
npm run serve          # Serve production build on localhost:3000
npm run typecheck      # TypeScript check
```

Search and llms.txt only work in production builds (`build && serve`), not dev mode.

## Deployment

Push to `next` branch triggers GitHub Actions (`.github/workflows/deploy.yml`) which runs `npm ci && npm run build` and deploys `./build/` to GitHub Pages. Live at https://stroppy-io.github.io.

## Versioning

`versions.json` lists released versions (currently `["2.2.3"]`). The `docs/` directory is the "Next" (unreleased) version. Snapshots live in `versioned_docs/version-X.X.X/` with corresponding `versioned_sidebars/`.

- `/docs/` routes to latest stable (2.2.3)
- `/docs/next/` routes to current development
- To cut a new version: `npx docusaurus docs:version X.X.X`
- Config in `docusaurus.config.ts` → `presets[0].docs.versions`

## Docs Structure

4 main docs + 4 legacy docs, two sidebars (`docsSidebar`, `legacySidebar`) defined in `sidebars.ts`:

- `introduction.md` — install, config, quick start
- `sql-and-generators.md` — SQL files, named params, data generators
- `extensibility.md` — custom drivers, Go interface, helpers
- `reports-workflow.md` — k6 reports, thresholds, CI workflows
- `legacy/` — historical benchmarks (FDB, MongoDB) from pre-k6 era

## Theme

Nanos-world-inspired neutral palette. Key colors:

- Primary: `#5fa0ff` (both modes)
- Dark background: `#1e1e1e`, surfaces: `#272727`, borders: `#353535`
- Code blocks: `#f6f8fa` light / `#222` dark
- Prism: vsLight + vsDark
- SVG logos use the same neutral grays with amber lightning bolt as contrast

CSS custom properties are in `src/css/custom.css`. Hero section, feature cards, and workflow steps are styled there too.

## Plugins

- **@easyops-cn/docusaurus-search-local** — client-side full-text search, indexes docs only, configured in `docusaurus.config.ts` `themes` array
- **docusaurus-plugin-llms** — generates `llms.txt` (links) and `llms-full.txt` (full content) at build time, configured in `plugins` array

## Key Files

```
docusaurus.config.ts    # Site config, plugins, navbar, footer, prism
sidebars.ts             # Sidebar navigation structure
src/css/custom.css      # All custom styling
src/pages/index.tsx     # Landing page (hero, features, quick start)
static/img/logo.svg     # Navbar logo
static/img/hero-logo.svg # Hero section logo
```
