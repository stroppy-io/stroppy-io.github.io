import {REPOS} from '../tools/tools';

// /vendors: where a vendor's request goes, and the published corrections. The
// Vendors menu (src/components/nav/menu.ts) links to the page's sections and
// to these issues.

export const VENDORS = '/vendors';

/**
 * A request is an issue in Stroppy's public repository, opened with its text
 * filled in: a field per line, its hint to be replaced. The page shows the same
 * fields.
 */
export type IssueForm = {title: string; fields: {name: string; hint: string}[]};

export const ADD_DATABASE: IssueForm = {
  title: 'Add <database> to the ratings',
  fields: [
    {name: 'Database', hint: 'name and version'},
    {name: 'Protocol it claims', hint: 'e.g. PostgreSQL 17, MySQL 8.4, MongoDB 8.0'},
    {name: 'How to run it', hint: 'a container image, or install steps on Linux'},
    {name: 'Settings for one 32 vCPU · 128 GB node', hint: 'what you would set'},
    {name: 'Contact', hint: 'who answers our questions'},
  ],
};

export const REPORT_ERROR: IssueForm = {
  title: 'Wrong result: <database>',
  fields: [
    {name: 'Result', hint: 'a link to the rating row, the run report or the conformity finding'},
    {name: 'What is wrong', hint: 'what we published and what it should be'},
    {name: 'How to see it', hint: 'the commands, settings or version that show it'},
  ],
};

export const issueUrl = (f: IssueForm) => {
  const body = f.fields.map((x) => `**${x.name}:** ${x.hint}`).join('\n');
  return `${REPOS.stroppy}/issues/new?${new URLSearchParams({title: f.title, body}).toString()}`;
};

/** A published result we got wrong and changed. Newest first. */
export type Correction = {
  /** ISO date the correction was published. */
  date: string;
  /** The result, as a reader finds it: "CockroachDB · pgwire · Types". */
  result: string;
  /** What was published, what it is now, and why. */
  change: string;
  /** The issue that reported it. */
  issue: string;
};

export const CORRECTIONS: Correction[] = [];
