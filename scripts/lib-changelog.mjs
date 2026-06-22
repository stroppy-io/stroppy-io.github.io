import {readFileSync} from 'node:fs';

// Matches "## [Unreleased]" and "## [5.3.4] - 2026-06-16" (any dash variant).
const SECTION_RE = /^##\s+\[([^\]]+)\](?:\s*[-–—]\s*(.+))?\s*$/;

/** Load changelog text from an http(s) URL or a local file path. */
export async function loadSource(source) {
  if (/^https?:\/\//.test(source)) {
    const res = await fetch(source);
    if (!res.ok) throw new Error(`fetch ${source} -> HTTP ${res.status}`);
    return res.text();
  }
  return readFileSync(source, 'utf8');
}

/**
 * Split a Keep-a-Changelog document into sections. The dev-facing header
 * preamble (everything before the first "## [" heading) is dropped.
 * Each section keeps its raw markdown verbatim, header line included.
 */
export function parseSections(text) {
  const lines = text.split('\n');
  const heads = [];
  lines.forEach((l, i) => { if (SECTION_RE.test(l)) heads.push(i); });
  return heads.map((start, k) => {
    const end = k + 1 < heads.length ? heads[k + 1] : lines.length;
    const m = lines[start].match(SECTION_RE);
    const raw = lines.slice(start, end).join('\n').replace(/\n+$/, '') + '\n';
    return {version: m[1], date: m[2] || null, raw};
  });
}

export const isUnreleased = (v) => /^unreleased$/i.test(v.trim());

/** Numeric semver-ish compare. Non-numeric suffixes are ignored. */
export function cmpVersion(a, b) {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
}

export const FRONTMATTER = (title, description) =>
  ['---', `title: ${title}`, `description: ${description}`, '---', ''].join('\n');

export const DEFAULT_SOURCE =
  process.env.CHANGELOG_SOURCE ||
  'https://raw.githubusercontent.com/stroppy-io/stroppy/main/CHANGELOG.md';
