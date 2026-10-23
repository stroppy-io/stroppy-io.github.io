import type {CSSProperties} from 'react';
import clsx from 'clsx';
import {STATES, percent, stateInfo, stateOfCode, type Cell} from './data';
import '../../css/compat-map.css';

// The compatibility map's visual language, shared by /conformity's map and
// the landing's preview so both draw identically: a cell (a state's tint,
// its glyph and the share of checks that matched), the five-state legend
// and a score with its bar. Styles: src/css/compat-map.css.

/** One map cell, as a table cell. `where` names it for the tooltip and screen readers. */
export function StateCell({cell, where}: {cell: Cell; where: string}) {
  if (!cell) {
    return (
      <td className="c c--blank" title={`${where}: not measured`}>
        <span className="sr">not measured</span>
      </td>
    );
  }
  const state = stateOfCode(cell.code);
  const info = stateInfo(state);
  // Rounded down, so a cell that is not all matches never reads 100%.
  const share = cell.total > 0 ? Math.floor((cell.matched / cell.total) * 100) : null;
  const counts = cell.total > 0 ? `, ${cell.matched} of ${cell.total} checks matched` : '';
  const showShare = (state === 'differs' || state === 'refused' || state === 'breaks') && share !== null;
  return (
    <td className={clsx('c', `c--${state}`)} title={`${where}: ${info.label}${counts}`}>
      <span className="c__glyph" aria-hidden="true">
        {info.glyph}
      </span>
      {showShare && (
        <span className="c__share" aria-hidden="true">
          {share}%
        </span>
      )}
      <span className="sr">
        {info.label}
        {counts}
      </span>
    </td>
  );
}

/** The five states in plain words, each with its swatch and glyph. */
export function StatesLegend({className}: {className?: string}) {
  return (
    <ul className={clsx('states', className)} aria-label="What a cell means">
      {STATES.map((s) => (
        <li key={s.id} title={s.meaning}>
          <span className={clsx('c', 'states__swatch', `c--${s.id}`)} aria-hidden="true">
            {s.glyph}
          </span>
          {s.label}
        </li>
      ))}
    </ul>
  );
}

/** A score: its number and a bar as long. */
export function ScoreBar({value, big}: {value: number; big?: boolean}) {
  return (
    <span className={clsx('bar', big && 'bar--big')} style={{'--v': value} as CSSProperties}>
      <b>{percent(value)}</b>
      <span className="bar__track" aria-hidden="true" />
    </span>
  );
}
