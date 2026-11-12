import ScoreChip from './ScoreChip';
import {pct, speed} from './format';
import {AVERAGES, PICKS, score, share, type Engine, type PickId} from './score';

type Props = {
  winners: Record<PickId, Engine | undefined>;
  base: Engine | undefined;
  onOpen: (id: string) => void;
};

const EMPTY: Record<PickId, string> = {
  top: 'no alternative passes the rule',
  runner: 'no second alternative passes the rule',
  fast: 'no alternative has a TPC-C run yet',
  warn: 'nothing broke',
};

function why(id: PickId, e: Engine, base: Engine | undefined): string {
  if (id === 'fast' && e.tx) {
    const s = share(e, base, 'tx');
    return `${speed(e.tx)}${s === undefined ? '' : ` · ${Math.round(s * 100)}% of the baseline`}`;
  }
  if (id === 'warn') return `${e.breaks} crashes, hangs or broken messages`;
  return `${typeof e.conf?.overall === 'number' ? pct(e.conf.overall) : '—'} like the original · nothing broke`;
}

/** The four picks for a protocol, each with the number behind it; the rules under them. */
export default function Picks({winners, base, onOpen}: Props) {
  return (
    <section className="rt-box" aria-labelledby="rt-picks">
      <h2 id="rt-picks" className="rt-box__title">
        Our picks <span>alternatives to the baseline</span>
      </h2>
      <div className="rt-picks">
        {PICKS.map((p) => {
          const e = winners[p.id];
          return e ? (
            <button key={p.id} type="button" className={`rt-pick rt-pick--${p.id}`} onClick={() => onOpen(e.id)}>
              <span className="rt-pick__award">{p.title}</span>
              <span className="rt-pick__who">{e.name}</span>
              <span className="rt-pick__line">
                <ScoreChip score={score(e, base, AVERAGES)} />
                <span className="rt-pick__why">{why(p.id, e, base)}</span>
              </span>
            </button>
          ) : (
            <div key={p.id} className={`rt-pick rt-pick--${p.id} rt-pick--empty`}>
              <span className="rt-pick__award">{p.title}</span>
              <span className="rt-pick__who">Nobody yet</span>
              <span className="rt-pick__why">{EMPTY[p.id]}</span>
            </div>
          );
        })}
      </div>
      <p className="rt-rules">
        How picks are made:{' '}
        {PICKS.map((p, i) => (
          <span key={p.id}>
            {i > 0 && '; '}
            <b>{p.title}</b>: {p.rule}
          </span>
        ))}
        .
      </p>
    </section>
  );
}
