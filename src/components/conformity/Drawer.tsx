import {useEffect, useRef, useState, type CSSProperties} from 'react';
import clsx from 'clsx';
import {DATA_BASE, SCORED_ROLES, percent, protocolShort, stateInfo, stateOfOutcome} from './data';
import type {Compat, Details, RootCause, Row} from './types';

// One engine, on demand: a side drawer with its score by role and what
// differs from the original, worst first. The row's top findings show at
// once from compat.json; its root causes (with the diff and the command
// that re-runs each) are fetched from details/<id>.json only now. Escape,
// the backdrop or ✕ closes it; the page keeps the URL hash in step.

const cache = new Map<string, Promise<Details>>();

function load(row: Row): Promise<Details> {
  const url = DATA_BASE + row.details;
  let p = cache.get(url);
  if (!p) {
    p = fetch(url).then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<Details>;
    });
    p.catch(() => cache.delete(url));
    cache.set(url, p);
  }
  return p;
}

const FIRST = 8;

function StateTag({outcome}: {outcome: string}) {
  const s = stateOfOutcome(outcome);
  const info = stateInfo(s);
  return (
    <span className={clsx('tag', `tag--${s}`)}>
      <span aria-hidden="true">{info.glyph} </span>
      {info.label}
    </span>
  );
}

function Finding({c}: {c: RootCause}) {
  const ex = c.example;
  return (
    <li className="finding">
      <div className="finding__head">
        <StateTag outcome={c.outcome} />
        <span className="finding__n">
          {c.cells} {c.cells === 1 ? 'check' : 'checks'}
        </span>
      </div>
      <p className="finding__text">{c.summary}</p>
      {ex && (
        <details className="finding__more">
          <summary>Evidence</summary>
          <p className="finding__title">
            {ex.title} <code>{ex.check_id}</code>
          </p>
          {ex.diff && ex.diff.length > 0 && <pre className="code code--diff">{ex.diff.join('\n')}</pre>}
          {ex.expected && (
            <>
              <h4>Expected, from the original</h4>
              <pre className="code">{ex.expected}</pre>
            </>
          )}
          {ex.observed && (
            <>
              <h4>Observed</h4>
              <pre className="code">{ex.observed}</pre>
            </>
          )}
          {ex.command && (
            <>
              <h4>Re-run this check</h4>
              <pre className="code">{ex.command}</pre>
            </>
          )}
        </details>
      )}
    </li>
  );
}

export default function Drawer({data, row, onClose}: {data: Compat; row: Row; onClose: () => void}) {
  const [details, setDetails] = useState<Details | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  const close = useRef<HTMLButtonElement>(null);
  const label = (role: string) => data.columns.find((c) => c.id === role)?.label ?? role;

  useEffect(() => {
    let live = true;
    setDetails(null);
    setError(null);
    setAll(false);
    load(row).then(
      (d) => live && setDetails(d),
      (e: Error) => live && setError(e.message),
    );
    return () => {
      live = false;
    };
  }, [row]);

  // Focus moves into the drawer, Escape closes it, focus goes back after.
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    close.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.documentElement.classList.add('cf-drawer-open');
    return () => {
      document.removeEventListener('keydown', onKey);
      document.documentElement.classList.remove('cf-drawer-open');
      before?.focus?.();
    };
  }, [onClose]);

  const roles = SCORED_ROLES.filter((r) => r in row.scores);
  const causes = details?.root_causes ?? [];
  const shown = all ? causes : causes.slice(0, FIRST);

  return (
    <div className="drawer" role="presentation">
      <button type="button" className="drawer__backdrop" aria-label="Close" tabIndex={-1} onClick={onClose} />
      <aside className="drawer__panel" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
        <header className="drawer__head">
          <div>
            <h2 id="drawer-title">{row.target}</h2>
            <p>
              {protocolShort(row.protocol)} protocol, compared with <b>{row.baseline.reference}</b>. Reports version{' '}
              {row.claims}.
            </p>
          </div>
          <button ref={close} type="button" className="drawer__close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>

        <div className="drawer__body">
          <dl className="roles">
            <div className="roles__overall">
              <dt>{label('overall')}</dt>
              <dd>
                <span className="bar bar--big" style={{'--v': row.scores.overall ?? 0} as CSSProperties}>
                  <b>{percent(row.scores.overall)}</b>
                  <span className="bar__track" aria-hidden="true" />
                </span>
              </dd>
            </div>
            {roles.map((r) => (
              <div key={r} title={row.explain?.[r]}>
                <dt>{label(r)}</dt>
                <dd>
                  <span className="bar" style={{'--v': row.scores[r] ?? 0} as CSSProperties}>
                    <b>{percent(row.scores[r])}</b>
                    <span className="bar__track" aria-hidden="true" />
                  </span>
                </dd>
              </div>
            ))}
          </dl>
          {row.note && <p className="drawer__note">{row.note}</p>}

          <h3>What differs from the original</h3>
          {error && (
            <p className="drawer__error" role="alert">
              The findings did not load ({error}). Close and open the engine again to retry.
            </p>
          )}
          {!details && !error && row.top_findings.length > 0 && (
            <ol className="findings findings--top">
              {row.top_findings.map((f) => (
                <li key={f.id} className="finding">
                  <div className="finding__head">
                    <StateTag outcome={f.outcome} />
                    <span className="finding__n">
                      {f.cells} {f.cells === 1 ? 'check' : 'checks'}
                    </span>
                  </div>
                  <p className="finding__text">{f.summary}</p>
                </li>
              ))}
            </ol>
          )}
          {!details && !error && (
            <p className="drawer__loading" aria-live="polite">
              Loading every finding…
            </p>
          )}
          {details && causes.length === 0 && <p>Every judged check matched the original.</p>}
          {details && causes.length > 0 && (
            <>
              <p className="drawer__count">
                {causes.length} {causes.length === 1 ? 'finding' : 'findings'}, worst first.
              </p>
              <ol className="findings">
                {shown.map((c) => (
                  <Finding key={c.id} c={c} />
                ))}
              </ol>
              {causes.length > FIRST && (
                <button type="button" className="drawer__all" onClick={() => setAll((v) => !v)}>
                  {all ? `Show the first ${FIRST}` : `Show all ${causes.length}`}
                </button>
              )}
            </>
          )}

          {details && (
            <>
              <h3>Reproduce</h3>
              <pre className="code">{details.reproduce.command}</pre>
              <p className="drawer__hint">
                One check: <code>{details.reproduce.check_command}</code>. Tool {details.reproduce.tool_version}, run{' '}
                <code>{details.reproduce.run_id}</code>.
              </p>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
