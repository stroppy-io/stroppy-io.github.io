#!/usr/bin/env node
// Compare the toolchain actually installed against what this repository
// prescribes, so drift shows up here rather than as a confusing build failure.
//
// Checked:
//   - the running node against `engines.node` in package.json
//   - the running node against the `node-version` the deploy workflow pins
//   - npm's own declared engine range, where the lockfile records one
//
// Deliberately dependency-free: it is meant to run inside a fresh VM before
// `npm ci`, where there is nothing installed to check with.

import {readFileSync} from 'node:fs';

const parse = (version) => {
    const match = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?$/.exec(String(version).trim());
    if (!match) return null;
    return [Number(match[1]), Number(match[2] ?? 0), Number(match[3] ?? 0)];
};

const compare = (left, right) => {
    for (let i = 0; i < 3; i++) {
        if (left[i] !== right[i]) return left[i] < right[i] ? -1 : 1;
    }
    return 0;
};

// Supports the shapes this repository and its dependencies actually use:
// `^1.2.3`, `~1.2.3`, `>=1.2.3`, `>1.2.3`, `<2.0.0`, `<=2.0.0`, `1.2.3`, `*`,
// any of them joined by ` || `.
const satisfies = (version, range) =>
    String(range)
        .split('||')
        .some((alternative) => {
            const parts = alternative.trim().split(/\s+/).filter(Boolean);
            if (parts.length === 0 || parts[0] === '*') return true;
            return parts.every((part) => {
                const operator = /^(>=|<=|>|<|\^|~)?(.*)$/.exec(part);
                const wanted = parse(operator[2]);
                if (!wanted) return true;
                switch (operator[1]) {
                    case '>=': return compare(version, wanted) >= 0;
                    case '>': return compare(version, wanted) > 0;
                    case '<=': return compare(version, wanted) <= 0;
                    case '<': return compare(version, wanted) < 0;
                    case '^': return compare(version, wanted) >= 0 && version[0] === wanted[0];
                    case '~': return compare(version, wanted) >= 0
                        && version[0] === wanted[0] && version[1] === wanted[1];
                    default: return compare(version, wanted) === 0;
                }
            });
        });

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const engines = JSON.parse(read('package.json')).engines?.node;
const workflow = read('.github/workflows/deploy.yml');
const pinned = /node-version:\s*['"]?([0-9.]+)['"]?/.exec(workflow)?.[1];
const lock = JSON.parse(read('package-lock.json'));
const rootEngines = lock.packages?.['']?.engines?.node;

const installed = process.version;
const parsed = parse(installed);
if (!parsed) {
    console.error(`cannot parse the running node version: ${installed}`);
    process.exit(1);
}

const checks = [
    {what: 'package.json engines.node', range: engines},
    {what: 'package-lock.json root engines.node', range: rootEngines},
    {what: 'deploy.yml node-version', range: pinned ? `^${pinned}` : undefined},
];

let failed = 0;
console.log(`node ${installed}   npm ${process.env.npm_config_user_agent?.split(' ')[0] ?? 'unknown'}`);
for (const check of checks) {
    if (!check.range) {
        console.log(`  ?  ${check.what}: not declared`);
        continue;
    }
    const ok = satisfies(parsed, check.range);
    if (!ok) failed += 1;
    console.log(`  ${ok ? 'ok' : 'FAIL'}  ${check.what}: ${check.range}`);
}

if (failed > 0) {
    console.error(`\n${failed} mismatch(es): the installed toolchain is not one this repository supports.`);
    console.error('Rebuild the VM base image with a matching toolchain, e.g.');
    console.error('  firecode prepare --in-vm --with "node@' + String(pinned ?? 22) + '"');
    process.exit(1);
}

console.log('\ntoolchain matches what this repository prescribes.');
