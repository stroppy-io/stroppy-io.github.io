# Security policy

## Reporting a vulnerability

Report suspected vulnerabilities through [GitHub private vulnerability
reporting](https://github.com/stroppy-io/stroppy-io.github.io/security/advisories/new).
Include affected versions, reproduction steps, and expected impact. Please do not
open a public issue before maintainers have assessed the report.

## Accepted build-time dependency risk

As of 2026-10-07, the production dependency tree resolves three packages with
transitive critical advisories, all reached through Docusaurus's build and dev
server rather than through anything the generated site executes:

| Package | Resolved | Advisory | Reached through |
|---|---|---|---|
| `proxy-addr` | 2.0.7 → **2.0.8** | [GHSA-jqcg-44mw-7w3h](https://github.com/advisories/GHSA-jqcg-44mw-7w3h) (IP spoofing) | `@docusaurus/core` → `webpack-dev-server` → `express` |
| `shell-quote` | 1.10.0 → **1.12.0** | [GHSA-pqg4-j6r4-53mv](https://github.com/advisories/GHSA-pqg4-j6r4-53mv) (command injection) | `@docusaurus/core` → `webpack-dev-server` → `launch-editor` |
| `tinypool` | 1.1.1 → **2.2.0** | [GHSA-5gmw-xhrv-c9v3](https://github.com/advisories/GHSA-5gmw-xhrv-c9v3), [GHSA-85c8-ppgw-ccpr](https://github.com/advisories/GHSA-85c8-ppgw-ccpr) (prototype pollution to RCE) | `@docusaurus/core` |

`proxy-addr` and `shell-quote` are pinned within the ranges their parents already
allow (`~2.0.7` and `^1.8.4`). `tinypool` is the exception: Docusaurus requires
`^1.0.2` and the patched release is 2.x, so the pin crosses a major version. That
is a deliberate exception, not an oversight — the build is the only path that
loads it, and the site's static output does not include it. It was verified by
running the deployment's own gate and build with these pins: `npm audit --omit=dev
--audit-level=critical` exits 0 and `npm run build` succeeds.

Exposure is limited to build and development: the dev server is loopback-local
while developing and never deployed, and the generated site is static files. The
advisories' exploit paths need attacker-controlled input — a request to the local
dev server, crafted shell tokens, or polluted worker options — none of which this
repository provides to them.

Reassess when Docusaurus moves to a `tinypool` 2.x requirement, at which point the
override should be removed rather than kept.

As of 2026-09-10, `@docusaurus/mdx-loader@3.10.2` resolves
`image-size@2.0.2`, which has known denial-of-service advisories for malformed
images. Docusaurus invokes this parser during static builds to determine local
Markdown image dimensions. The generated site does not ship or execute it.

This site has no image upload or other external image-ingestion path. Build
inputs are reviewed, repository-controlled assets, and pull requests do not run
the deployment build automatically. A malicious image would need to be accepted
into the repository or processed during a maintainer's local build. The accepted
impact is therefore limited to build availability.

Builds install the committed lockfile with `npm ci`, disable persisted checkout
credentials before dependency scripts run, and reject critical production
dependency advisories before deployment. These controls limit exposure but do
not fix the parser.

No compatible fixed release is currently available. Replacement work is tracked
upstream in [facebook/docusaurus#12235](https://github.com/facebook/docusaurus/pull/12235).
Reassess this exception by 2026-12-10 and whenever Docusaurus or its image parser
is upgraded. Once a compatible fixed parser path ships, upgrade Docusaurus in
lockstep, regenerate the lockfile, verify the vulnerable path is absent, run the
dependency audit and production build, and remove this exception.
