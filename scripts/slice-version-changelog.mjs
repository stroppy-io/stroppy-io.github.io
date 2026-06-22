#!/usr/bin/env node
// Freezes a per-version changelog into a versioned_docs snapshot.
// Run AFTER `npm run docusaurus docs:version <X>`: that copies the full
// current changelog into the snapshot; this trims it to the slice
// (previousDocumentedVersion, X] and drops the Unreleased section.
//
//   npm run docusaurus docs:version 5.4.0
//   node scripts/slice-version-changelog.mjs 5.4.0
import {writeFileSync, readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, resolve} from 'node:path';
import {loadSource, parseSections, isUnreleased, cmpVersion, FRONTMATTER, DEFAULT_SOURCE}
  from './lib-changelog.mjs';

const version = process.argv[2];
if (!version) {
  console.error('usage: slice-version-changelog.mjs <version>');
  process.exit(1);
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const versions = JSON.parse(readFileSync(resolve(root, 'versions.json'), 'utf8'));
const idx = versions.indexOf(version);
if (idx === -1) {
  throw new Error(`${version} not in versions.json — run "docusaurus docs:version ${version}" first`);
}
const prev = versions[idx + 1] || null; // previous documented version, if any

const sections = parseSections(await loadSource(DEFAULT_SOURCE));
const inRange = sections.filter((s) => {
  if (isUnreleased(s.version)) return false;                 // frozen pages omit Unreleased
  if (cmpVersion(s.version, version) > 0) return false;      // not newer than this version
  if (prev && cmpVersion(s.version, prev) <= 0) return false; // strictly after previous doc version
  return true;
});

const intro = prev
  ? `Changes in ${version}, since the previous documented release (${prev}).\n`
  : `Changes up to and including ${version}.\n`;
const body = inRange.length
  ? inRange.map((s) => s.raw).join('\n')
  : '_No recorded changes for this version._\n';

const OUT = resolve(root, `versioned_docs/version-${version}/changelog.md`);
writeFileSync(OUT, FRONTMATTER('Changelog', `Changes in Stroppy ${version}.`) + '\n' + intro + '\n' + body);
console.log(`slice-version-changelog: wrote ${OUT} (${inRange.length} sections, ${prev ?? 'start'} < v <= ${version})`);
