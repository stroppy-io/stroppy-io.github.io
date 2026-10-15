#!/usr/bin/env node
// Fetches the Stroppy UI kit pinned in kit.json from the stroppy-cloud release
// and unpacks it into src/kit/ (tokens, fonts, base.css, logo, chart). Also
// writes static/kit/: the mark as light and dark SVG files with the kit
// variables resolved, for places that load it as an image (navbar, favicon).
// src/kit/mark.json carries the mark's paths for the landing's animated logo,
// and static/kit/favicon.svg is Stroppy Cloud's favicon at the same tag, so
// both sites show the same icon. Both directories are generated and gitignored.
//
//   node scripts/sync-kit.mjs                  skip when src/kit has the pinned version
//   node scripts/sync-kit.mjs --force          fetch again regardless
//   KIT_SOURCE=path/to/stroppy-kit-X.tar.gz    a local bundle instead of the release
//                                              (a kit not released yet; no hash check)
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const KIT_DIR = join(root, 'src/kit');
const STATIC_DIR = join(root, 'static/kit');
const pin = JSON.parse(readFileSync(join(root, 'kit.json'), 'utf8'));
const local = process.env.KIT_SOURCE;
const force = process.argv.includes('--force');

const installed = () => {
  try {
    return readFileSync(join(KIT_DIR, 'VERSION'), 'utf8').trim();
  } catch {
    return null;
  }
};

const generated = [join(STATIC_DIR, 'favicon.svg'), join(KIT_DIR, 'mark.json')];
if (!local && !force && installed() === pin.version && generated.every((f) => existsSync(f))) {
  console.log(`sync-kit: src/kit is ${pin.version}, up to date`);
  process.exit(0);
}

const fetchPinned = async (from, sha) => {
  const res = await fetch(from);
  if (!res.ok) throw new Error(`sync-kit: ${from}: HTTP ${res.status}`);
  const body = Buffer.from(await res.arrayBuffer());
  const got = createHash('sha256').update(body).digest('hex');
  if (got !== sha) throw new Error(`sync-kit: ${from}: sha256 ${got}, kit.json pins ${sha}`);
  return body;
};

const url = `https://github.com/stroppy-io/stroppy-cloud/releases/download/v${pin.version}/stroppy-kit-${pin.version}.tar.gz`;
let archive;
if (local) {
  archive = readFileSync(resolve(local));
} else {
  archive = await fetchPinned(url, pin.sha256);
}
const faviconUrl = `https://raw.githubusercontent.com/stroppy-io/stroppy-cloud/v${pin.version}/web/public/org-logo.svg`;
const favicon = await fetchPinned(faviconUrl, pin.faviconSha256);

const tmp = mkdtempSync(join(tmpdir(), 'stroppy-kit-'));
try {
  writeFileSync(join(tmp, 'kit.tar.gz'), archive);
  execFileSync('tar', ['-xzf', 'kit.tar.gz'], {cwd: tmp});
  const unpacked = join(tmp, 'stroppy-kit');
  const version = readFileSync(join(unpacked, 'VERSION'), 'utf8').trim();
  if (!local && version !== pin.version) {
    throw new Error(`sync-kit: archive says ${version}, kit.json pins ${pin.version}`);
  }
  rmSync(KIT_DIR, {recursive: true, force: true});
  cpSync(unpacked, KIT_DIR, {recursive: true});
  writeMarks();
  writeFileSync(join(STATIC_DIR, 'favicon.svg'), favicon);
  console.log(`sync-kit: src/kit is ${version} from ${local ?? url}`);
} finally {
  rmSync(tmp, {recursive: true, force: true});
}

// An <img> does not see the page's CSS variables, so the mark falls back to
// its built-in colours there. Resolve --st-* from tokens.json per theme.
function writeMarks() {
  const tokens = JSON.parse(readFileSync(join(KIT_DIR, 'tokens.json'), 'utf8'));
  const svg = readFileSync(join(KIT_DIR, 'logo/mark.svg'), 'utf8').replace(/<!--[\s\S]*?-->\s*/g, '');
  // The first group is the orange (five rays, then the band), the second the cylinder.
  const groups = [...svg.matchAll(/<g[^>]*>([\s\S]*?)<\/g>/g)].map((g) => [...g[1].matchAll(/ d="([^"]+)"/g)].map((m) => m[1]));
  if (groups.length !== 2 || groups[0].length !== 6 || groups[1].length !== 3) {
    throw new Error('sync-kit: logo/mark.svg is not five rays, a band and three body parts');
  }
  const viewBox = /viewBox="([^"]+)"/.exec(svg)[1];
  const mark = {viewBox, rays: groups[0].slice(0, 5), band: groups[0][5], body: groups[1]};
  writeFileSync(join(KIT_DIR, 'mark.json'), `${JSON.stringify(mark, null, 2)}\n`);
  rmSync(STATIC_DIR, {recursive: true, force: true});
  mkdirSync(STATIC_DIR, {recursive: true});
  for (const theme of ['light', 'dark']) {
    const vars = {mark: tokens.mark, ...tokens.color[theme]};
    const resolved = svg.replace(/var\(--st-([a-z-]+),[^)]*\)/g, (whole, name) => {
      const key = name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      if (!(key in vars)) throw new Error(`sync-kit: mark.svg uses --st-${name}, not in tokens.json`);
      return vars[key];
    });
    writeFileSync(join(STATIC_DIR, `mark-${theme}.svg`), resolved);
  }
}
