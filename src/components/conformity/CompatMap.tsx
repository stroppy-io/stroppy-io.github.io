import {useEffect, useRef, useState, type CSSProperties} from 'react';
import clsx from 'clsx';
import {bands, cellOf, groupCell, groupsOf, mergeCells, rowsOf, shortGroup, type Cell, type Group} from './data';
import {ScoreBar, StateCell} from './Cell';
import type {Compat, Row} from './types';

// The compatibility map of one protocol: its engines, best first, each with
// its overall score, against the protocol's feature groups. A cell is the
// group's worst outcome as one of five plain states, with a glyph, and the
// share of its checks that matched (Cell.tsx, shared with the landing's
// preview). The references are one row on top. A group's header opens it
// into its features. Styles: src/css/compat-map.css.

function names(refs: Row[]): string {
  const t = refs.map((r) => r.target);
  if (t.length <= 2) return t.join(' and ');
  return `${t[0]} to ${t[t.length - 1]}`;
}

export default function CompatMap({data, protocol, onOpen}: {data: Compat; protocol: string; onOpen: (id: string) => void}) {
  const groups = groupsOf(data, protocol);
  const {refs, subjects} = rowsOf(data, protocol);
  const [open, setOpen] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);

  // An opened group's features come into view next to the engine names.
  useEffect(() => {
    const el = box.current;
    const first = el?.querySelector<HTMLElement>('.cmap__feature');
    const names = el?.querySelector<HTMLElement>('tbody th');
    if (!el) return;
    el.scrollLeft = first && names ? first.offsetLeft - names.offsetWidth - 8 : 0;
  }, [open]);
  const scoreLabel = data.columns.find((c) => c.id === 'overall')?.label ?? 'Score';

  // Columns: a group, or the features of the one group opened.
  type Col = {key: string; group: Group; label: string; title: string; k?: number};
  const cols: Col[] = groups.flatMap((g): Col[] =>
    g.name === open
      ? g.features.map(({feature, k}) => ({key: feature.id, group: g, label: feature.label, title: `${g.name}: ${feature.label}`, k}))
      : [{key: g.name, group: g, label: shortGroup(g.name), title: g.name}],
  );
  const cellFor = (row: Row, col: Col): Cell => (col.k === undefined ? groupCell(row, col.group) : cellOf(row.feature_cells[col.k]));

  // The band over the type groups.
  const bandRow = bands(cols.map((c) => c.group.name));

  return (
    <div ref={box} className="cmap" role="region" aria-label="Compatibility map, scrolls sideways" tabIndex={0}>
      <table className={clsx('cmap__table', open && 'is-open')} style={{'--cols': cols.length} as CSSProperties}>
        {/* Widths for the fixed layout: the band row above spans columns. */}
        <colgroup>
          <col className="cmap__col-engine" />
          <col className="cmap__col-score" />
          {cols.map((col) => (
            <col key={col.key} className={col.k === undefined ? undefined : 'cmap__col-feature'} />
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
            <th scope="col" className="cmap__engine">
              Engine
            </th>
            <th scope="col" className="cmap__score">
              {scoreLabel}
            </th>
            {cols.map((col) =>
              col.k === undefined ? (
                <th key={col.key} scope="col" className="cmap__group">
                  <button
                    type="button"
                    title={`${col.title}: show its ${col.group.features.length} features`}
                    aria-expanded={false}
                    onClick={() => setOpen(col.group.name)}>
                    {col.label}
                  </button>
                </th>
              ) : (
                <th key={col.key} scope="col" className="cmap__feature" title={col.title}>
                  {col.k === col.group.features[0].k ? (
                    <button
                      type="button"
                      className="cmap__close"
                      aria-expanded
                      title={`Fold ${col.group.name} back into one column`}
                      onClick={() => setOpen(null)}>
                      <span aria-hidden="true">‹ </span>
                      {col.label}
                    </button>
                  ) : (
                    col.label
                  )}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {refs.length > 0 && (
            <tr className="cmap__ref">
              <th scope="row" title={refs.map((r) => r.target).join(', ')}>
                Reference
                <small>{names(refs)}</small>
              </th>
              <td className="cmap__score">
                <span className="cmap__refnote">the original</span>
              </td>
              {cols.map((col) => (
                <StateCell key={col.key} cell={mergeCells(refs.map((r) => cellFor(r, col)))} where={`Reference, ${col.title}`} />
              ))}
            </tr>
          )}
          {subjects.map((row) => {
            const v = row.scores.overall;
            return (
              <tr key={row.id} className={clsx(row.severe.flagged && 'is-severe')}>
                <th scope="row">
                  <button type="button" className="cmap__name" onClick={() => onOpen(row.id)}>
                    {row.target}
                  </button>
                </th>
                <td className="cmap__score">
                  {typeof v === 'number' ? (
                    <ScoreBar value={v} />
                  ) : (
                    <span className="nil" title={row.note}>
                      no score
                    </span>
                  )}
                </td>
                {cols.map((col) => (
                  <StateCell key={col.key} cell={cellFor(row, col)} where={`${row.target}, ${col.title}`} />
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
