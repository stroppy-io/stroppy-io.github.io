# Site redesign: one product with Stroppy Cloud

Decided 2026-10-23 with the stroppy-cloud side. This file is the site's part;
the console's part lives in stroppy-cloud.

Goal: a new visitor understands the value in one screen, sees reasons to
trust it, and goes to sign up and a trial run. Order of work is outside in:
hero and menu first, onboarding and free tier later.

## Architecture

- stroppy.io (this Docusaurus site) is the public face: landing, menu, docs,
  blog. cloud.stroppy.io is the console. Two deploys on subdomains, no proxy
  under one origin: the console is mounted at its root and its share and
  embed links are already out.
- The console has no landing of its own. A guest on cloud.stroppy.io/ goes to
  stroppy.io; its /land and /how are removed and redirected here.
- The kit (stroppy-kit from stroppy-cloud releases) stays tokens, CSS, fonts,
  logo and the chart script. No components, no data in the kit.
- The mega menu exists only on this site, in our own Navbar. The console's
  sign-in screens get a plain bar on kit tokens: logo to stroppy.io and
  "Back to site". So the menu is edited in one place, here.
- Sign-in state: once the console sets its Kratos session cookie on
  `.stroppy.io` and allows stroppy.io by CORS, the site's header asks
  `cloud.stroppy.io/v1/sessions/whoami` with credentials and shows
  "Sign in" or "Open console".
- Theme follows the system, with a shared theme cookie on `.stroppy.io`.

## Hero

- Tagline, two lines, no full stop:
  "Load-test your database / without building or tuning the bench"
- Caption, at most two lines: "Point Stroppy at your database, or let
  Stroppy Cloud bring up a fresh one, tune it, run the test and hand you a
  report you can share."
- Primary CTA: create an account on cloud.stroppy.io (see Open: registration
  is closed today). Secondary: "See results". Under them a text link
  "or run it locally →" to the CLI.
- Proof: the live leaderboard (every row opens the full report) and a line
  "N engines · M versions · K topologies — every result reproducible",
  counted from `/api/v1/public/catalog`.
- Less empty space above the hero.
- No shortcomings in landing copy: no provider names, no "today only", no
  caveats. Caveats belong in the docs. No customer logos.
- External database ("point Stroppy at your database") is promised only
  after the console side confirms it with a live run.

## Menu

Mega menu on hover (reference: Aerospike — columns, each item a title and a
one-line description, a promo card on the right). Items named by what the
visitor wants to do (reference: CockroachDB).

- Product: Stroppy Cloud (stand, run, report) · Stroppy CLI (open source) ·
  Auto tuning · Suites & schedules · Compare & share · API & CI.
  Promo: How it works (the console's /how, rewritten as text).
- Databases: PostgreSQL (Patroni, PgBouncer, OrioleDB) · MySQL · MariaDB ·
  CockroachDB · YDB · Picodata. Each links to the leaderboard filtered by
  engine until engines have pages. Promo: top of the rating.
- Results: Leaderboard · Public reports · Case studies (blog).
- Resources: Docs · Getting started · Workloads (TPC-B/C/H/DS) · Changelog ·
  Blog · Community.
- Right: Docs, Sign in / Open console, the primary CTA. GitHub stars here or
  in the footer, not in the hero.
- Pricing is hidden until the free tier exists. Cloud is not a separate item.
  Legacy docs only in the footer.
- The Workloads page notes what each engine does not support (CockroachDB:
  no TPC-H/TPC-DS; Picodata TPC-DS: load only; YDB TPC-DS: built-in queries
  only). Not in the menu.

## CLI

A screen of its own below the hero: "Prefer the terminal? Stroppy CLI is
open source and runs against any database it has a driver for", an install
snippet, a link into Product.

## Docs versions

- The switcher shows three: LTS (default), Milestone, Next.
- LTS is a line set by one value in the config (now `6.0`); its snapshot is
  refreshed by every patch tag of that line. Milestone is the latest stroppy
  tag (now `v6.2.0`). Next is `main`.
- Only two snapshots are kept. Cutting them is automated in the deploy: on a
  stroppy release (or on the schedule) a tag in the LTS line refreshes LTS,
  any other tag replaces Milestone.
- Older versions (2.x–5.x) leave the switcher for an archive page.
- Docs today stop at 6.0.0 while tags reach v6.2.0; the automation closes the
  gap.

## Cloud docs

- A separate "Cloud" docs plugin here, without versions, visible from any
  docs version. The console links to it from "?" marks.
- It describes concepts and scenarios (provider, database, workload, test,
  suite, schedule, run, report, compare, share, API tokens, CI and webhooks,
  auto tuning), not form fields.
- References (engine parameters, versions, API) are generated from the
  console's `openapi.yaml` and schema export.
- It is new text: the console has almost no user docs. Its
  `docs/tuning/README.md` is the base for the Auto tuning page.

## Phases (site)

1. Hero, mega menu, Legacy to the footer, the /how content, CLI screen, proof
   line from the catalog. No dependency on the console.
2. Docs versions: three-way switcher, two snapshots, cutting automation,
   archive page.
3. Header sign-in state, once the console ships the Kratos cookie domain and
   CORS.
4. Cloud docs section.

## Open

- Registration is closed (`registration.enabled: false` in Kratos). The
  hero's primary CTA waits for sign-up through GitHub (Kratos OIDC, password
  sign-up stays closed), planned on the console side for 1–2 days after its
  stage 1. It needs a GitHub OAuth App in the stroppy-io org.

## Wire-protocol conformity

A page on the site for the stroppy-conformity dataset (how well engines that
claim PostgreSQL, MySQL, Mongo or Elastic compatibility behave on the wire),
from the export described in stroppy-conformity `docs/site-export.md`.

- Now: our own Docusaurus page built from `compat.json` (and the row details),
  read at build time the way the hero's rating is. The sealed export of the
  current dataset is vendored into this repository until the cloud serves it.
- Follow the export's consuming rules: default-visible columns and default
  sort from `compat.json`, the legend and its caveats wherever the table
  shows, details loaded when a row opens, only audited datasets, one dataset
  at a time.
- Menu: Results → Protocol conformity.

## Backlog

- Conformity data from Stroppy Cloud: the cloud is the publication gate
  (`conformity reports verify` before publishing), so it serves the audited
  datasets and the site build fetches the current one from there, as it does
  the rating, instead of a copy in this repository. Old dataset ids stay
  resolvable.

- Funnel analytics (tool, anonymous id across `.stroppy.io`, server events).
