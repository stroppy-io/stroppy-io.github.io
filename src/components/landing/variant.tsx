import {machineTags, metricLabel, SCENARIOS, type Group, type Metric} from './rating';

// The variant picker of the published rating: a workload, then where it ran
// (topology, CPU, disk, scale), each a segmented control of every option the
// workload has; the options the choices above rule out stay in place, struck
// out. Shared by the landing's board (Leaderboard.tsx) and the benchmarks
// table on /ratings.

export type Option = {id: string; name: string; available: boolean};
export type Attribute = {label: string; options: Option[]; value: string; onPick: (id: string) => void};

/** An attribute: its name and the chosen value over its options, a segmented control. */
function Choice({attribute: a}: {attribute: Attribute}) {
  return (
    <fieldset className="picker__attr">
      <legend>
        {a.label}: <b>{a.options.find((o) => o.id === a.value)?.name}</b>
      </legend>
      <div className="picker__options">
        {a.options.map((o) => (
          <button
            key={o.id}
            type="button"
            className="picker__option"
            aria-pressed={o.id === a.value}
            disabled={!o.available}
            onClick={() => a.onPick(o.id)}>
            {o.name}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * The variant picker: the workload across the top, then where it ran, two
 * attributes a line (one on a phone). Every option of the workload stays in
 * place; the ones the choices above rule out are struck out and inactive, so
 * the picker never changes shape.
 */
export function Picker({workload, attributes}: {workload: Attribute; attributes: Attribute[]}) {
  return (
    <div className="picker">
      <Choice attribute={workload} />
      <div className="picker__grid">
        {attributes.map((a) => (
          <Choice key={a.label} attribute={a} />
        ))}
      </div>
    </div>
  );
}

/** Each distinct value in the groups' order (most runs first). */
const distinct = <T,>(xs: T[]) => [...new Set(xs)];

export type Workload = (typeof SCENARIOS)[number];

/** What a reader picks, top to bottom: each narrows the groups the next one chooses among. */
const FACETS = [
  {key: 'topology', label: 'Topology', of: (g: Group) => g.topology},
  {key: 'cpu', label: 'CPU', of: (g: Group) => g.cpu},
  {key: 'disk', label: 'Disk', of: (g: Group) => g.disk},
  {key: 'scale', label: 'Scale', of: (g: Group) => String(g.scaleFactor ?? '')},
] as const;

export type Picks = Partial<Record<(typeof FACETS)[number]['key'], string>>;

/**
 * A workload's picker and the group it lands on. Each facet lists every value
 * the workload has (scales in order, the rest most runs first); its choice
 * falls back to the first value left under the choices above it, and the
 * values those rule out stay listed but unavailable.
 */
export function variant(workload: Workload, groups: Group[], picks: Picks, onPick: (p: Picks) => void) {
  let left = groups;
  const attributes = FACETS.map((f): Attribute => {
    const all = distinct(groups.map(f.of));
    if (f.key === 'scale') all.sort((x, y) => Number(x) - Number(y));
    const here = distinct(left.map(f.of));
    const picked = picks[f.key];
    const value = picked !== undefined && here.includes(picked) ? picked : here[0];
    left = left.filter((g) => f.of(g) === value);
    const name = (v: string) => (f.key !== 'scale' ? v : v === '' ? 'any' : workload.scale(Number(v)));
    return {
      label: f.label,
      options: all.map((v) => ({id: v, name: name(v), available: here.includes(v)})),
      value,
      onPick: (id) => onPick({[f.key]: id}),
    };
  });
  return {group: left[0], attributes};
}

/** The machine and the metric in one line, less what the picker already names. */
export function summary(group: Group, metric: Metric | null): string {
  const row = group.rows[0];
  const named = [group.cpu, group.disk];
  return [...machineTags(row).filter((t) => !named.includes(t.replace(/ SSD$/, ''))), ...(metric ? [metricLabel(metric, row)] : [])].join(
    ' · ',
  );
}
