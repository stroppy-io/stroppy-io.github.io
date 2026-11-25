#!/usr/bin/env node
// Takes an audited dataset from a stroppy-conformity site export (the
// `site/` directory of its archive, docs/site-export.md there) into the site:
//
//   static/data/conformity/compat.json            the table, its legend, clients, forks, families
//   static/data/conformity/errata.json            what published results got wrong
//   static/data/conformity/details/<row id>.json  one row's evidence
//
// The export's api/ and report.html are not used by any page and stay out.
// It refuses a draft, as the export's publishing rules do. One dataset at a
// time: the old one goes whole.
//
//   tar --zstd -xf rolling-<id>.tar.zst -C /tmp/conformity
//   node scripts/import-conformity.mjs /tmp/conformity/site

import {cp, mkdir, readFile, readdir, rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'static/data/conformity');

const src = process.argv[2];
if (!src) {
  console.error('usage: node scripts/import-conformity.mjs path/to/export/site');
  process.exit(2);
}

const compat = JSON.parse(await readFile(path.join(src, 'compat.json'), 'utf8'));
if (compat.kind !== 'conformity_site' || compat.schema !== 1) {
  console.error(`${src}: unexpected compat.json (kind ${compat.kind}, schema ${compat.schema})`);
  process.exit(1);
}
if (compat.dataset?.status !== 'audited') {
  console.error(`${src}: dataset ${compat.dataset?.id} is a ${compat.dataset?.status ?? 'draft'}, not audited; refusing it`);
  process.exit(1);
}
const errata = JSON.parse(await readFile(path.join(src, 'errata.json'), 'utf8'));
if (errata.kind !== 'conformity_site_errata') {
  console.error(`${src}: unexpected errata.json (kind ${errata.kind})`);
  process.exit(1);
}

await rm(out, {recursive: true, force: true});
await mkdir(out, {recursive: true});
await cp(path.join(src, 'compat.json'), path.join(out, 'compat.json'));
await cp(path.join(src, 'errata.json'), path.join(out, 'errata.json'));
await cp(path.join(src, 'details'), path.join(out, 'details'), {recursive: true});
const details = (await readdir(path.join(out, 'details'))).length;
console.log(
  `conformity: dataset ${compat.dataset.id}, ${compat.rows.length} rows, ${details} details, ${errata.entries.length} errata → ${path.relative(root, out)}`,
);
