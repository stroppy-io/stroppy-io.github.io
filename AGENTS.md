# Stroppy Docs

Documentation site for [Stroppy](https://github.com/stroppy-io/stroppy), a
Go-native database stress-testing CLI. Docusaurus 3.10.2, React 19, TypeScript.

## Commands

**Run every npm command inside `firecode`, never on the host.** The site's
dependencies are build tooling; installing them on a developer machine is what
this avoids. The VM is over the current directory and never writes the host
project:

```bash
firecode exec npm ci          # one-shot, result copied out to a sibling dir
firecode up                   # or: a persistent VM for a dev server
firecode in npm run build     # …run commands in that VM
firecode down                 # …and stop it
```

Inside the VM (or in CI, where it is a normal `npm ci`):

```bash
npm ci
npm run check-toolchain # compare installed node/npm against what this repo prescribes
npm run start          # development server, no local search/llms output
npm run sync-changelog
npm run typecheck
npm run build          # production build under ./build
npm run serve
```

`prestart` and `prebuild` refresh `docs/changelog.md` from Stroppy main.
Search and `llms.txt`/`llms-full.txt` are generated only by production builds.

See [The firecode VM](#the-firecode-vm) for the base image, what persists
between runs, and how to preview the site from a browser.

## The firecode VM

npm work for this site runs inside a
[firecode](https://github.com/deadtrickster/firecode) Firecracker microVM over
the current directory. The host project is never
written to: the VM mirrors it, and copies its result out to a sibling directory
as it stops, which is where build output and `node_modules` land.

### The base image

The image already carries the toolchain, so a run never waits for a Node
install. Currently baked in:

| Tool | Version |
|---|---|
| node | 24.21.0 (installed with `mise`, on `PATH` at `/opt/mise/shims`) |
| npm | 11.19.0 |

The node version must stay inside the range this repository declares
(`engines.node` in `package.json`, which mirrors what the pinned `tinypool`
allows, and the `node-version` the deploy workflow pins). Check that rather than
assuming it:

```bash
firecode in npm run check-toolchain
```

Rebuild the image when the required toolchain moves — `prepare` builds from
scratch and keeps the image it replaced as `agent-firecode.ext4.previous`:

```bash
firecode prepare --in-vm --with "node@24"     # no docker needed on macOS
```

### What persists between runs, and what does not

- **The base image persists**, so node and npm are there every run.
- **`$HOME` does not.** `~/.npm` is writable during a run and empty again next
time, so npm's cache does not carry over. The image ships a populated
`~/.npm/_cacache`, which is why `npm ci` is quick, but it is not a cache you can
grow.
- **`node_modules` does not, by default.** Gitignored files are left out of the
  mirror, so a run starts without them and `npm ci` reinstalls. `--all-files`
  includes them, and the flag is worth it only for a *persistent* VM — see below.
- **`/var/lib/firecode`** is the VM's state mount and is not writable by the
unprivileged user, so it is not a place to put a cache.

### The fast loop: `up --all-files`

Measured on this repository, with `node_modules` (790 packages) present on the
host. `in` reuses the VM's established mirror, so the cost is paid once:

| | wall time |
|---|---|
| `exec` default (no `node_modules`; `npm ci` inside) | 5.1s + install |
| `exec --all-files` (copies the tree each run) | 24.5s, then 27.3s — not cached across `exec` runs |
| `up --all-files`, once | ~25s |
| then `in 'ls node_modules \| wc -l'` | 0.53s → 790 packages |
| then `in 'npm run build'` | 5.9s, no install |

So for one-shot work the flag is a wash, and for iterative work it is the
difference between a six-second loop and one that reinstalls every time:

```bash
firecode up --all-files       # pay the mirror once
firecode in npm run build     # seconds, with the tree already there
firecode down
```

### Preview the site in a browser

A dev server started in the VM is reachable from the host at the guest's
address. It must bind all interfaces — the host is not on the guest's loopback:

```bash
firecode up                                          # persistent VM
firecode in sh -c 'npm ci && npm run start -- --host 0.0.0.0' &
firecode in sh -c 'hostname -I'                      # the address to open
# → http://<guest-ip>:3000/
firecode down
```

Open the URL **with the `http://` scheme**. The server speaks plain HTTP, and
Chrome's HTTPS-first behaviour will otherwise attempt TLS on that port and fail.
The guest address is DHCP-assigned on macOS, so read it from `hostname -I` rather
than bookmarking it; it is host-local, so it is not reachable from a phone or
another machine.

## Deployment

Pushes to `next` run `.github/workflows/deploy.yml` and deploy `build/` to
GitHub Pages at https://stroppy.io. Scheduled builds refresh the upstream
changelog twice daily.

## Versioning

- `docs/` is current development (`/docs/next/`).
- `versioned_docs/version-X.Y.Z/` stores frozen releases.
- `versioned_sidebars/version-X.Y.Z-sidebars.json` stores frozen navigation.
- `versions.json` orders released documentation.
- `docusaurus.config.ts` `lastVersion` serves the default `/docs/` route.

Cut a version after current docs and `sidebars.ts` are final:

```bash
npm run sync-changelog
npm run docusaurus -- docs:version X.Y.Z
node scripts/slice-version-changelog.mjs X.Y.Z
```

Then update `lastVersion`, run typecheck/build, and verify older snapshots have
no diff. Never edit generated `docs/changelog.md` or a frozen changelog by hand.

## Current docs

- `introduction.md` — install, architecture, first run
- `migration-v6.md` — v5-to-v6 migration
- `sql-and-generators.md` — SQL grammar and typed Go generation
- `drivers.md` — drivers, pools, TLS, insert capabilities, errors
- `config-file.md` — strict JSON envelope and precedence
- `transactions.md` — isolation, retry, terminal errors
- `presets.md` — built-in workloads and typed parameters
- `probe.md` — catalog/schema discovery
- `baseline.md` — Noop and pg-noop machine ceilings
- `reports-workflow.md` — native summary, OTLP, benchmarking workflow
- `extensibility.md` — source-level Go extension points
- `custom-workloads.md` — build, test, register, and package a Go workload
- `cli-reference.md` — v6 commands and flags
- `tests/` — TPC-B/C/H/DS details
- `legacy/` — historical pre-CLI material

`docs/changelog.md` is generated by `scripts/sync-changelog.mjs`.

## Content policy

- Current and newest-version docs must match released Stroppy behavior.
- Pin source links in frozen release docs to the corresponding Stroppy tag.
- Keep old versioned docs and benchmark prose historical.
- Blog prose is historical; only repair links, pinning product/docs targets to
  the release discussed by the article.
- Do not advertise a companion integration as v6-compatible until its own code
  supports v6.

## Site files

```text
docusaurus.config.ts     site metadata, plugins, navbar, footer, versions
sidebars.ts               current navigation
src/css/custom.css        site styling
src/pages/index.tsx       landing page
static/img/logo.svg       navbar logo
static/img/hero-logo.svg  hero/social image
scripts/                  changelog synchronization and slicing
```

Theme uses a neutral blue palette with light/dark modes. Preserve existing
visual system unless a task explicitly requests redesign.
