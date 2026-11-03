import {KIND_LABELS, type Kind} from './score';
import {MIN_OPTIONS} from './state';

export type FilterValue = {kind: Kind | null; min: number; clean: boolean; bench: boolean};

type Props = FilterValue & {
  /** The kinds the protocol's engines are, so the list offers no empty choice. */
  kinds: Kind[];
  shown: number;
  total: number;
  onChange: (next: Partial<FilterValue>) => void;
};

/** The table's filters. The kind also sets who the picks choose from; the rest only thin the table. */
export default function Filters({kind, kinds, min, clean, bench, shown, total, onChange}: Props) {
  const active = kind !== null || min > 0 || clean || bench;
  return (
    <div className="rt-filters" role="group" aria-label="Filter the table">
      {kinds.length > 1 && (
        <label>
          Kind{' '}
          <select value={kind ?? ''} onChange={(ev) => onChange({kind: kinds.find((k) => k === ev.target.value) ?? null})}>
            <option value="">every kind</option>
            {kinds.map((k) => (
              <option key={k} value={k}>
                {KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </label>
      )}
      <label>
        Compatibility at least{' '}
        <select value={min} onChange={(ev) => onChange({min: Number(ev.target.value)})}>
          {MIN_OPTIONS.map((v) => (
            <option key={v} value={v}>
              {v ? v.toFixed(1) : 'any'}
            </option>
          ))}
        </select>
      </label>
      <label>
        <input type="checkbox" checked={clean} onChange={(ev) => onChange({clean: ev.target.checked})} /> nothing broken
      </label>
      <label>
        <input type="checkbox" checked={bench} onChange={(ev) => onChange({bench: ev.target.checked})} /> benchmarked
      </label>
      <span className="rt-filters__count" aria-live="polite">
        Showing {shown} of {total}
        {active && (
          <>
            {' · '}
            <button type="button" onClick={() => onChange({kind: null, min: 0, clean: false, bench: false})}>
              reset
            </button>
          </>
        )}
      </span>
    </div>
  );
}
