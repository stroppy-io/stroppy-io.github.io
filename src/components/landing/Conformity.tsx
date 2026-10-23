import {useState, type CSSProperties} from 'react';
import Link from '@docusaurus/Link';
import {usePluginData} from '@docusaurus/useGlobalData';
import {bands, protocolShort, shortGroup} from '@site/src/components/conformity/data';
import {ScoreBar, StateCell, StatesLegend} from '@site/src/components/conformity/Cell';
import type {ConformitySummary} from '@site/plugins/conformity';

// The landing's preview of /conformity's compatibility map, drawn with the
// same cells (conformity/Cell.tsx): tabs switch the protocol in place, the
// rows are the references and the five best engines, the columns the same
// feature groups. An engine opens its drawer on /conformity (#<row id>), the
// button and the protocol's name its tab (#pgwire …). The cells come
// aggregated from plugins/conformity.ts, so the landing does not carry the
// whole dataset.

function refNames(t: string[]) {
  return t.length <= 2 ? t.join(' and ') : `${t[0]} to ${t[t.length - 1]}`;
}

export default function ConformityTeaser() {
  const {summary} = usePluginData('conformity') as {summary: ConformitySummary | null};
  const [pick, setPick] = useState(0);
  if (!summary || summary.protocols.length === 0) return null;
  const p = summary.protocols[pick] ?? summary.protocols[0];
  const bandRow = bands(p.groups);
  return (
    <div className="conf">
      <div className="conf__bar">
        <div className="conf__tabs" role="tablist" aria-label="Protocol">
          {summary.protocols.map((x, i) => (
            <button key={x.protocol} type="button" role="tab" aria-selected={i === pick} onClick={() => setPick(i)}>
              {protocolShort(x.protocol)}
              <span>{x.engines}</span>
            </button>
          ))}
        </div>
        <StatesLegend className="conf__legend" />
      </div>

      <div className="cmap cmap--mini" role="tabpanel" aria-label={`${protocolShort(p.protocol)}, the best engines`}>
        <table className="cmap__table" style={{'--cols': p.groups.length} as CSSProperties}>
          <colgroup>
            <col className="cmap__col-engine" />
            <col className="cmap__col-score" />
            {p.groups.map((g) => (
              <col key={g} />
            ))}
          </colgroup>
          <thead>
            <tr className="cmap__bands">
              <td colSpan={2} />
              {bandRow.map((b, i) =>
                b.label ? (
                  <th key={i} scope="colgroup" colSpan={b.span}>
                    {b.label}
                  </th>
                ) : (
                  <td key={i} colSpan={b.span} />
                ),
              )}
            </tr>
            <tr>
              <th scope="col">
                <Link to={`/conformity#${p.protocol}`}>{protocolShort(p.protocol)}</Link>
              </th>
              <th scope="col">Score</th>
              {p.groups.map((g) => (
                <th key={g} scope="col" title={g}>
                  {shortGroup(g)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="cmap__ref">
              <th scope="row" title={p.ref.targets.join(', ')}>
                Reference
                <small>{refNames(p.ref.targets)}</small>
              </th>
              <td className="cmap__score">
                <span className="cmap__refnote">the original</span>
              </td>
              {p.ref.cells.map((c, i) => (
                <StateCell key={p.groups[i]} cell={c} where={`Reference, ${p.groups[i]}`} />
              ))}
            </tr>
            {p.rows.map((r) => (
              <tr key={r.id}>
                <th scope="row">
                  <Link className="cmap__name" to={`/conformity#${r.id}`}>
                    {r.target}
                  </Link>
                </th>
                <td className="cmap__score">
                  <ScoreBar value={r.score} />
                </td>
                {r.cells.map((c, i) => (
                  <StateCell key={p.groups[i]} cell={c} where={`${r.target}, ${p.groups[i]}`} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="conf__foot">
        <Link className="button button--primary button--lg" to={`/conformity#${p.protocol}`}>
          Open the compatibility map
        </Link>
        <span className="conf__provenance">
          The five best of {p.engines} {protocolShort(p.protocol)} engines. Dataset <code>{summary.dataset}</code>.
        </span>
      </div>
    </div>
  );
}
