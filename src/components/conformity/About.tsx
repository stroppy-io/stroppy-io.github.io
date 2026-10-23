import {useEffect, useRef} from 'react';
import {DATA_BASE, day} from './data';
import type {Compat} from './types';

// "About this data" on /conformity: a button under the map that opens a side
// panel, like an engine's, with the export's own legend (scoring, weights,
// baselines, every caveat, every outcome, roles, layers) and the dataset's
// provenance. Nothing here is written again by the site; it is the legend in
// compat.json as published. `#about` opens it too.

/** The way in: a plain button, so it reads as something to press. */
export function AboutButton({onOpen}: {onOpen: () => void}) {
  return (
    <button type="button" className="about-button" onClick={onOpen}>
      <span className="about-button__icon" aria-hidden="true">
        i
      </span>
      About this data
      <small>how scores are counted, every caveat and outcome, where the data comes from</small>
      <span className="about-button__arrow" aria-hidden="true">
        →
      </span>
    </button>
  );
}

export default function About({data, onClose}: {data: Compat; onClose: () => void}) {
  const close = useRef<HTMLButtonElement>(null);

  // Focus moves into the panel, Escape closes it, focus goes back after.
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

  const L = data.legend;
  const d = data.dataset;
  const weights = Object.entries(data.defaults.weights)
    .filter(([, w]) => w > 0)
    .sort((a, b) => b[1] - a[1]);
  const label = (role: string) => data.columns.find((c) => c.id === role)?.label ?? role;
  const outcomes = Object.entries(L.outcomes).sort((a, b) => b[1].severity - a[1].severity);
  return (
    <div className="drawer" role="presentation">
      <button type="button" className="drawer__backdrop" aria-label="Close" tabIndex={-1} onClick={onClose} />
      <aside className="drawer__panel about" role="dialog" aria-modal="true" aria-labelledby="about-title">
        <header className="drawer__head">
          <div>
            <h2 id="about-title">About this data</h2>
            <p>How the scores are counted, what they do not say, and where the data comes from.</p>
          </div>
          <button ref={close} type="button" className="drawer__close" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </header>
      <div className="drawer__body about__body">
        <section>
          <h3>How scores are counted</h3>
          <p>{L.scoring}</p>
          <table className="about__weights">
            <caption>Default weights</caption>
            <tbody>
              {weights.map(([role, w]) => (
                <tr key={role}>
                  <th scope="row">{label(role)}</th>
                  <td>{w}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3>Baselines</h3>
          <p>{L.baselines}</p>
        </section>

        <section>
          <h3>Caveats</h3>
          <ul className="about__caveats">
            {L.caveats.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </section>

        <section>
          <h3>Outcomes</h3>
          <dl className="about__list">
            {outcomes.map(([k, o]) => (
              <div key={k}>
                <dt>{o.label}</dt>
                <dd>
                  {o.meaning}
                  <small>{o.counted}</small>
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section>
          <h3>Roles</h3>
          <dl className="about__list">
            {Object.entries(L.roles).map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          <h3>Layers</h3>
          <dl className="about__list">
            {Object.entries(L.layers).map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          <h3>The dataset</h3>
          <dl className="about__list">
            <div>
              <dt>Dataset</dt>
              <dd>
                <code>{d.id}</code>, {d.status}
                {d.audited_at && `, audited ${day(d.audited_at)}`}
                {d.audit && `, verdict ${d.audit.verdict}`}
              </dd>
            </div>
            <div>
              <dt>Measured</dt>
              <dd>
                {day(data.campaign.started)}, {data.campaign.runs} runs, conformity {data.tool_version}
              </dd>
            </div>
            <div>
              <dt>Data</dt>
              <dd>
                <a href={`${DATA_BASE}compat.json`}>compat.json</a>, and each engine’s findings in{' '}
                <code>details/&lt;engine&gt;.json</code> next to it
              </dd>
            </div>
          </dl>
        </section>
      </div>
      </aside>
    </div>
  );
}
