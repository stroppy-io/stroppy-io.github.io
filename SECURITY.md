# Security policy

## Reporting a vulnerability

Report suspected vulnerabilities through [GitHub private vulnerability
reporting](https://github.com/stroppy-io/stroppy-io.github.io/security/advisories/new).
Include affected versions, reproduction steps, and expected impact. Please do not
open a public issue before maintainers have assessed the report.

## Accepted build-time dependency risk

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
