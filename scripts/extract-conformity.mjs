#!/usr/bin/env node
// Takes the wire-protocol conformity data out of a stroppy-conformity
// report.html (`conformity reports export --format html`) and writes it the
// way the site export lays it out (docs/site-export.md there):
//
//   static/data/conformity/compat.json            the table
//   static/data/conformity/details/<row id>.json  one row's evidence
//
// The report carries both, gzipped, in #report-data. This is an interim
// source until Stroppy Cloud serves audited datasets (plans/site-redesign.md,
// Backlog); it refuses a draft, as the export's publishing rules do.
//
//   node scripts/extract-conformity.mjs path/to/report.html

import {mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {gunzipSync} from 'node:zlib';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'static/data/conformity');

const file = process.argv[2];
if (!file) {
  console.error('usage: node scripts/extract-conformity.mjs path/to/report.html');
  process.exit(2);
}

const html = await readFile(file, 'utf8');
const m = html.match(/id="report-data"[^>]*data-gz="([^"]+)"/);
if (!m) {
  console.error(`${file}: no #report-data block; is it a conformity report.html?`);
  process.exit(1);
}
const data = JSON.parse(gunzipSync(Buffer.from(m[1], 'base64url')).toString('utf8'));
const compat = data.compat;
if (compat?.kind !== 'conformity_site' || compat.schema !== 1) {
  console.error(`${file}: unexpected data (kind ${compat?.kind}, schema ${compat?.schema})`);
  process.exit(1);
}
if (compat.dataset?.status !== 'audited') {
  console.error(`${file}: dataset ${compat.dataset?.id} is a ${compat.dataset?.status ?? 'draft'}, not audited; refusing it`);
  process.exit(1);
}

// One dataset at a time: the old one goes whole.
await rm(out, {recursive: true, force: true});
await mkdir(path.join(out, 'details'), {recursive: true});
await writeFile(path.join(out, 'compat.json'), JSON.stringify(compat));
for (const d of data.details) {
  await writeFile(path.join(out, 'details', `${d.id}.json`), JSON.stringify(d));
}
console.log(
  `conformity: dataset ${compat.dataset.id}, ${compat.rows.length} rows, ${data.details.length} details → ${path.relative(root, out)}`,
);
