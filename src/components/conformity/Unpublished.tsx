import type {Unpublished as Held} from './types';
import '../../css/notes.css';

// What the export measured and does not publish, each with its reason
// (compat.withheld and compat.not_measured): on /ratings and on the
// conformity map's tab for a protocol with nothing published.

export default function Unpublished({rows}: {rows: Held[]}) {
  if (rows.length === 0) return null;
  return (
    <ul className="notes">
      {rows.map((u) => (
        <li key={`${u.target}-${u.protocol}`}>
          <b>{u.target}</b> {u.reason}.
        </li>
      ))}
    </ul>
  );
}
