import type {KeyboardEvent} from 'react';
import ScoreChip from './ScoreChip';
import {rawCell, rawPart} from './format';
import {CATEGORIES, PICKS, category, score, type CategoryId, type Engine, type PickId, type View} from './score';
import type {Sort} from './state';

type Props = {
  base: Engine | undefined;
  /** Other versions of the original, shown when `showRefs`. */
  others: Engine[];
  showRefs: boolean;
  /** The alternatives, filtered and in order. */
  rows: Engine[];
  views: Record<CategoryId, View>;
  sort: Sort;
  dir: 1 | -1;
  awards: Map<string, PickId[]>;
  selected: string | null;
  onSort: (s: Sort) => void;
  onView: (c: CategoryId, v: View) => void;
  onToggleRefs: () => void;
  onOpen: (id: string) => void;
};

const title = (id: PickId) => PICKS.find((p) => p.id === id)?.title ?? id;

/** The baseline on top, its other versions on demand, then the alternatives ranked. */
export default function RatingsTable(props: Props) {
  const {base, others, showRefs, rows, views, sort, dir, awards, selected, onSort, onView, onToggleRefs, onOpen} = props;
  const arrow = (s: Sort) => (sort === s ? (dir < 0 ? ' ↓' : ' ↑') : '');
  const span = CATEGORIES.length + 2;

  const row = (e: Engine, rank: number | null) => {
    const open = () => onOpen(e.id);
    const key = (ev: KeyboardEvent) => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        open();
      }
    };
    return (
      <tr
        key={e.id}
        className={`rt-row${e.original ? ' rt-row--original' : ''}${selected === e.id ? ' rt-row--sel' : ''}`}
        tabIndex={0}
        onClick={open}
        onKeyDown={key}>
        <td className="rt-rank">{rank ?? ''}</td>
        <td>
          <span className="rt-name">{e.name}</span>
          {e === base ? <span className="rt-tag rt-tag--base">baseline</span> : e.original && <span className="rt-tag">original</span>}
          {(awards.get(e.id) ?? []).map((id) => (
            <span key={id} className={`rt-badge rt-badge--${id}`}>
              {title(id)}
            </span>
          ))}
        </td>
        <td>
          <ScoreChip score={score(e, base, views)} />
        </td>
        {CATEGORIES.map((c) => {
          const v = category(c, e, base, views[c.id]);
          const parts = c.parts.map((p) => `${p.label}: ${rawPart(p.id, e, base) || 'not run'}`).join('\n');
          const raw = rawCell(c.id, views[c.id], e, base);
          return (
            <td key={c.id} className="rt-sep">
              {v === undefined ? (
                <span className="rt-na">not run</span>
              ) : (
                <span className={`rt-cell rt-cell--${c.id}${raw ? '' : ' rt-cell--bare'}`} title={parts}>
                  {raw && <span className="rt-cell__raw">{raw}</span>}
                  <span className="rt-cell__bar">
                    <i style={{width: `${v * 10}%`}} />
                  </span>
                  <span className="rt-cell__score">{v.toFixed(1)}</span>
                </span>
              )}
            </td>
          );
        })}
      </tr>
    );
  };

  return (
    <div className="rt-scroll">
      <table className="rt-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Database</th>
            <th>
              <button type="button" onClick={() => onSort('score')}>
                Score{arrow('score')}
              </button>
            </th>
            {CATEGORIES.map((c) => (
              <th key={c.id} className="rt-sep" title={`${c.label}: ${c.how}`}>
                <button type="button" onClick={() => onSort(c.id)}>
                  <span className={`rt-dot rt-dot--${c.id}`} /> {c.label}
                  {arrow(c.id)}
                </button>
                <select
                  aria-label={`${c.label}: what to show`}
                  value={views[c.id]}
                  onChange={(ev) => {
                    const v = ev.target.value;
                    onView(c.id, v === 'avg' ? 'avg' : (c.parts.find((p) => p.id === v)?.id ?? 'avg'));
                  }}>
                  <option value="avg">Average</option>
                  {c.parts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {base && row(base, null)}
          {showRefs && others.map((e) => row(e, null))}
          {others.length > 0 && (
            <tr className="rt-more">
              <td />
              <td colSpan={span}>
                <button type="button" onClick={onToggleRefs}>
                  {showRefs ? 'Hide other versions of the original' : `Show ${others.length} other versions of the original`}
                </button>
              </td>
            </tr>
          )}
          <tr className="rt-band">
            <td />
            <td colSpan={span}>Compared with {base?.name ?? 'the original'}</td>
          </tr>
          {rows.map((e, i) => row(e, i + 1))}
          {rows.length === 0 && (
            <tr>
              <td />
              <td colSpan={span} className="rt-na">
                No engine passes the filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
