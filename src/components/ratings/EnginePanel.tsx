import {useEffect, useRef} from 'react';
import Link from '@docusaurus/Link';
import ScoreChip from './ScoreChip';
import {rawPart} from './format';
import {AVERAGES, CATEGORIES, PICKS, average, part, score, type Engine, type PickId} from './score';
import {CLOUD, shareUrl} from '../landing/rating';
import {mapUrl} from '../conformity/data';

type Props = {
  engine: Engine;
  base: Engine | undefined;
  protocolName: string;
  awards: PickId[];
  onClose: () => void;
};

/** One engine, every part of every category with its raw number; Escape closes it. */
export default function EnginePanel({engine: e, base, protocolName, awards, onClose}: Props) {
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    close.current?.focus();
    const onKey = (ev: globalThis.KeyboardEvent) => ev.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [e.id, onClose]);

  return (
    <aside className="rt-panel" role="dialog" aria-modal="false" aria-labelledby="rt-panel-title">
      <button ref={close} type="button" className="rt-panel__close" aria-label="Close" onClick={onClose}>
        ✕
      </button>
      <h2 id="rt-panel-title">
        {e.name}
        {e === base ? <span className="rt-tag rt-tag--base">baseline</span> : e.original && <span className="rt-tag">original</span>}
      </h2>
      <p className="rt-panel__sub">
        Speaks {protocolName} · {e.version}
        {e !== base && base && <> · compared with {base.name}</>}
      </p>
      <div className="rt-panel__score">
        <ScoreChip score={score(e, base, AVERAGES)} />
        {awards.map((id) => (
          <span key={id} className={`rt-badge rt-badge--${id}`}>
            {PICKS.find((p) => p.id === id)?.title}
          </span>
        ))}
      </div>
      {CATEGORIES.map((c) => {
        const avg = average(c, e, base);
        return (
          <section key={c.id}>
            <h3>
              <span className={`rt-dot rt-dot--${c.id}`} /> {c.label}
              {avg !== undefined && <b>{avg.toFixed(1)}</b>}
            </h3>
            {c.parts.map((p) => {
              const v = part(p.id, e, base);
              return (
                <div key={p.id} className={`rt-part rt-cell--${c.id}`} title={p.how}>
                  <span>{p.label}</span>
                  {v === undefined ? (
                    <span className="rt-na">not run yet</span>
                  ) : (
                    <>
                      <span className="rt-cell__bar">
                        <i style={{width: `${v * 10}%`}} />
                      </span>
                      <span className="rt-part__score">{v.toFixed(1)}</span>
                      <span className="rt-part__raw">{rawPart(p.id, e, base)}</span>
                    </>
                  )}
                </div>
              );
            })}
            {c.id === 'compat' && e.findings.length > 0 && (
              <ul className="rt-findings">
                {e.findings.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
      <div className="rt-panel__links">
        {e.conf && <Link to={mapUrl({engine: e.original ? undefined : e.id, protocol: e.protocol})}>Every conformity check</Link>}
        {e.tx && <a href={shareUrl(e.tx)}>The TPC-C run</a>}
        {e.procs && <a href={shareUrl(e.procs)}>The run with procedures</a>}
        <a href={`${CLOUD}/register`}>Run it on your workload</a>
      </div>
    </aside>
  );
}
