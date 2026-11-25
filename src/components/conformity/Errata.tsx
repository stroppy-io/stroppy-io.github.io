import type {Erratum} from './types';
import '../../css/notes.css';

// What a published conformity result got wrong and what was done, from the
// export's errata.json, newest first; on /ratings for one protocol, on
// /vendors whole.

/** The first sentence of a long text: the line a reader scans; the rest opens on demand. */
const firstSentence = (t: string) => /^.*?[.!?](?=\s|$)/.exec(t)?.[0] ?? t;

export default function Errata({entries}: {entries: Erratum[]}) {
  if (entries.length === 0) return null;
  return (
    <ol className="notes">
      {[...entries]
        .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id, undefined, {numeric: true}))
        .map((e) => (
          <li key={e.id}>
            <span className="notes__when">
              {e.date} · {e.cause === 'ours' ? 'our error' : 'the engine’s'} ·{' '}
              {e.targets.length === 1 ? e.targets[0] : `${e.targets.length} engines`}
            </span>
            {firstSentence(e.what)}
            <details className="notes__more">
              <summary>What happened and what we changed</summary>
              <p>{e.what}</p>
              <p>{e.cause_detail}</p>
              <p className="notes__fix">
                Corrected in dataset {e.corrected_in}
                {e.fix_title && `: ${e.fix_title}`}.
              </p>
            </details>
          </li>
        ))}
    </ol>
  );
}
