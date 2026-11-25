import type {CSSProperties} from 'react';
import Link from '@docusaurus/Link';
import {mapUrl, percent} from '../conformity/data';
import type {AccessMethodRow, FamilyRow} from '../conformity/types';

// Two of /ratings' views, each from the export as it is: forks against the
// product they forked, and storage engines against their own default.

const pct = (v: number) => `${percent(Math.round(v * 10) / 10)}%`;

/** A share out of 100 as a bar; the number beside it. */
function Share({value, label}: {value: number; label: string}) {
  return (
    <span className="rp-share" style={{'--v': value} as CSSProperties}>
      <span className="rp-share__track" aria-hidden="true" />
      <b>{label}</b>
    </span>
  );
}

/** Each fork against its family's baseline: of the checks both answered, how many alike. */
export function Families({rows}: {rows: FamilyRow[]}) {
  if (rows.length === 0) return null;
  return (
    <ul className="rp-list">
      {rows.map((f) => (
        <li key={f.row}>
          <span className="rp-list__what">
            <b>{f.target}</b> against {f.baseline}
            <span className="rp-list__note">
              {f.family} · {f.cells.toLocaleString('en-US')} checks, {f.differ.toLocaleString('en-US')} answered differently
            </span>
          </span>
          <Share value={f.same_share} label={pct(f.same_share)} />
        </li>
      ))}
    </ul>
  );
}

/** Storage engines and extensions, each against the same build on its default. */
export function StorageEngines({rows}: {rows: AccessMethodRow[]}) {
  const subjects = rows.filter((r) => r.role === 'subject' && typeof r.scores.overall === 'number');
  if (subjects.length === 0) return null;
  const what = (r: AccessMethodRow) => {
    const am = r.access_method;
    if (am.index?.length) return `${am.index.join(', ')} index`;
    return `${am.table} tables`;
  };
  return (
    <ul className="rp-list">
      {subjects
        .sort((a, b) => (b.scores.overall ?? 0) - (a.scores.overall ?? 0))
        .map((r) => (
          <li key={r.id}>
            <span className="rp-list__what">
              <Link to={mapUrl({protocol: r.protocol, engine: r.id})}>
                <b>{r.target}</b>
              </Link>{' '}
              {what(r)}
              <span className="rp-list__note">
                against {r.baseline.reference}
                {typeof r.access_method.recall === 'number' && ` · search recall ${Math.round(r.access_method.recall * 100)}%`}
              </span>
            </span>
            <Share value={r.scores.overall ?? 0} label={percent(r.scores.overall)} />
          </li>
        ))}
    </ul>
  );
}
