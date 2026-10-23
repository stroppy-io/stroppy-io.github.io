import {useEffect, useState, type CSSProperties, type ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useBrokenLinks from '@docusaurus/useBrokenLinks';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import Diagram from '@site/src/components/how/Diagram';
import RunStrip, {STAGES, TOTAL, clock, type Pin} from '@site/src/components/how/RunStrip';
import TuneChart from '@site/src/components/how/TuneChart';
import Clock, {HOOKS, clockText} from '@site/src/components/how/Clock';
import {
  ARCH_EDGES,
  ARCH_GROUPS,
  ARCH_STEPS,
  PRODUCT_EDGES,
  PRODUCT_GROUPS,
  PRODUCT_STEPS,
  type Step,
} from '@site/src/components/how/data';
import '../css/how.css';

// How Stroppy Cloud works, told along one run's clock, where scrolling is
// the clock running. The hero strip draws a run's stages as wide as the time
// they take; past it, the clock pins under the navbar
// (components/how/Clock.tsx). Each chapter sits at its minute on a time axis
// down the left and runs the clock from its start to its end as it scrolls
// past (useRunClock below). The diagrams stay in the flow at full size; their
// stories switch by the chips next to them. The menu links to chapters by id:
// #tuning, #suites, #share, #api.

const REGISTER = 'https://cloud.stroppy.io/register';
const EMBED = 'https://cloud.stroppy.io/embed/leaderboard';

const stage = (id: string) => STAGES.find((s) => s.id === id)!;

/** A chapter of the run: its minute and stage on the axis, its content beside. */
function Chapter({
  id,
  time,
  label,
  color,
  span,
  className,
  children,
}: {
  id: string;
  time?: string;
  label: string;
  color?: string;
  /** The minutes of the run this chapter covers: the clock runs from one to the other across it. */
  span: [number, number];
  className?: string;
  children: ReactNode;
}) {
  useBrokenLinks().collectAnchor(id);
  return (
    <section
      id={id}
      className={clsx('ch', !color && 'ch--off', className)}
      data-t0={span[0]}
      data-t1={span[1]}
      data-label={label}
      data-color={color ?? ''}
      style={color ? ({'--c': color} as CSSProperties) : undefined}>
      <div className="ch__rail">
        {color && (
          <>
            <span className="ch__track" />
            <span className="ch__fill" />
          </>
        )}
        <div className="ch__when">
          {time && <span className="ch__time">{time}</span>}
          <span className="ch__label">{label}</span>
        </div>
      </div>
      <div className="ch__body">{children}</div>
    </section>
  );
}

/** A diagram's story: chips for its steps and the caption of the chosen one. */
function Story({steps, step, onStep, label}: {steps: Step[]; step: number; onStep: (i: number) => void; label: string}) {
  const s = steps[step];
  return (
    <div className="how-story">
      <div className="how-chips" role="tablist" aria-label={label}>
        {steps.map((x, i) => (
          <button
            key={x.id}
            type="button"
            role="tab"
            aria-selected={i === step}
            className="how-chips__chip"
            onClick={() => onStep(i)}>
            {i > 0 && <span className="how-chips__num">{i}</span>}
            {x.title}
          </button>
        ))}
      </div>
      <div className="how-caption" aria-live="polite">
        <h3>{s.title}</h3>
        <p>{s.body}</p>
      </div>
    </div>
  );
}

/* ---------- After the run: suites and schedules ---------- */

const VERSIONS = ['PostgreSQL 16', 'PostgreSQL 17', 'PostgreSQL 18'];
const SIZES = ['S', 'M'];

function SuiteGrid() {
  return (
    <div className="suite" aria-hidden="true">
      <span />
      {SIZES.map((s) => (
        <span key={s} className="suite__head">
          size {s}
        </span>
      ))}
      {VERSIONS.map((v) => (
        <div key={v} className="suite__row">
          <span className="suite__head suite__head--row">{v}</span>
          {SIZES.map((s) => (
            <span key={s} className="suite__cell">
              <RunStrip compact />
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

// A schematic history: one point a night, one of them slower.
const NIGHTS = [44, 40, 46, 42, 45, 41, 43, 47, 42, 44, 78, 45, 41, 43];

function History() {
  const x = (i: number) => 8 + i * (304 / (NIGHTS.length - 1));
  return (
    <svg className="history" viewBox="0 0 320 110" aria-hidden="true">
      <line x1="0" y1="102" x2="320" y2="102" className="history__axis" />
      <polyline className="history__line" points={NIGHTS.map((y, i) => `${x(i)},${y}`).join(' ')} />
      {NIGHTS.map((y, i) => (
        <circle key={i} cx={x(i)} cy={y} r={y > 60 ? 4.5 : 3} className={clsx('history__dot', y > 60 && 'history__dot--bad')} />
      ))}
    </svg>
  );
}

/* ---------- The API: webhooks on the run's clock ---------- */

const PINS: Pin[] = [
  {name: 'run.started', at: [0], row: 1, edge: 'start'},
  {name: 'run.stage', at: STAGES.slice(1).map((s) => s.at), row: 2, edge: 'start'},
  {name: 'run.finished', at: [TOTAL], row: 1, edge: 'end'},
];

/**
 * The run clock: on every scroll, which chapter the reading line (just under
 * the pinned clock) is in and how far through it, so the minute of the run.
 * It sets `--t` and the readouts, fills each chapter's stretch of the axis
 * down to where the eye is (`--p`), lights the webhooks sent so far, shows
 * the pinned clock once it sticks under the navbar, and lets the tuning bars
 * grow as their rows come in.
 */
function useRunClock() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>('.how');
    if (!root) return undefined;
    const navbar = document.querySelector<HTMLElement>('.navbar');
    const bar = root.querySelector<HTMLElement>('.how-clock')!;
    const run = root.querySelector<HTMLElement>('.how-run')!;
    const time = bar.querySelector<HTMLElement>('.how-clock__time')!;
    const stageName = bar.querySelector<HTMLElement>('.how-clock__stage')!;
    const event = bar.querySelector<HTMLElement>('.how-clock__event code')!;
    const hooks = Array.from(bar.querySelectorAll<HTMLElement>('.how-clock__hook'));
    const chapters = Array.from(root.querySelectorAll<HTMLElement>('[data-t0]'));
    const loadClock = root.querySelector<HTMLElement>('[data-load-clock]');
    const tune = root.querySelector<HTMLElement>('.tune');
    const rows = Array.from(root.querySelectorAll<HTMLElement>('.tune__table tbody tr'));
    const still = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (tune && !still.matches) tune.classList.add('tune--armed');

    const update = () => {
      const vh = window.innerHeight;
      // The reading line sits just under the pinned clock: a chapter's time
      // starts when its top reaches the clock, so an anchor lands on it.
      const line = (navbar?.offsetHeight ?? 0) + bar.offsetHeight + 24;
      let t = 0;
      let label = 'Before launch';
      let color = '';
      let launched = false;
      for (const ch of chapters) {
        const r = ch.getBoundingClientRect();
        const p = Math.max(0, Math.min(1, (line - r.top) / r.height));
        // The axis fills down to where the eye is, 40% down the screen.
        const fill = Math.max(0, Math.min(1, (vh * 0.4 - r.top) / r.height));
        ch.style.setProperty('--p', fill.toFixed(4));
        if (r.top <= line) {
          const t0 = Number(ch.dataset.t0);
          const t1 = Number(ch.dataset.t1);
          t = t0 + (t1 - t0) * p;
          label = ch.dataset.label ?? '';
          color = ch.dataset.color ?? '';
          if (ch.id !== 'product') launched = true;
        }
      }
      root.style.setProperty('--t', t.toFixed(4));
      time.textContent = clockText(t);
      stageName.textContent = label;
      bar.style.setProperty('--c', color || 'var(--st-muted)');
      let last = 'none yet';
      HOOKS.forEach((h, i) => {
        const sent = launched && t >= h.at - 1e-6;
        hooks[i]?.classList.toggle('is-sent', sent);
        if (sent) last = h.name;
      });
      event.textContent = last;
      // Shown once it is stuck under the navbar, so never floating mid-page,
      // and gone with the chapters, so nothing covers the call to action.
      const top = (navbar?.offsetHeight ?? 0) + 1;
      bar.classList.toggle(
        'is-on',
        bar.getBoundingClientRect().top <= top && run.getBoundingClientRect().bottom > top + bar.offsetHeight,
      );
      if (loadClock) loadClock.textContent = clockText(Math.max(0, Math.min(12, t - 5)));
      for (const row of rows) row.classList.toggle('is-in', row.getBoundingClientRect().top < vh * 0.9);
    };
    update();
    window.addEventListener('scroll', update, {passive: true});
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);
}

/**
 * The site footer's height as `--how-footer-h`, so the last block and the
 * footer fill the screen together: scrolled to the bottom, nothing of the
 * chapters shows above the call to action.
 */
function useFooterHeight() {
  useEffect(() => {
    const footer = document.querySelector<HTMLElement>('.footer');
    if (!footer) return undefined;
    const html = document.documentElement;
    const ro = new ResizeObserver(() => html.style.setProperty('--how-footer-h', `${footer.offsetHeight}px`));
    ro.observe(footer);
    return () => {
      ro.disconnect();
      html.style.removeProperty('--how-footer-h');
    };
  }, []);
}

function HowPage() {
  useRunClock();
  useFooterHeight();
  const [productStep, setProductStep] = useState(0);
  const [archStep, setArchStep] = useState(0);
  const stand = stage('stand');
  const deploy = stage('tuning');
  const load = stage('load');
  const collect = stage('share');
  const teardown = stage('teardown');

  return (
    <main className="how">
      <header className="how-hero">
        <Heading as="h1" className="how-hero__title">
          How Stroppy Cloud works
        </Heading>
        <div className="how-hero__intro">
          <p className="how-lead">
            You describe a database and a workload and press Launch. Stroppy Cloud brings up machines in your cloud,
            installs and tunes the database, drives the load and takes the machines down again. A 10-minute TPC-C run on
            one PostgreSQL machine takes about {TOTAL} minutes from launch to report. This page follows one.
          </p>
          <div className="how-actions">
            <a className="button button--primary" href={REGISTER}>
              Create account
            </a>
            <Link className="button button--secondary button--outline" to="/#results">
              See results
            </Link>
          </div>
        </div>
        <RunStrip />
        <p className="how-hero__note">Typical times for a 10-minute TPC-C run on one PostgreSQL machine. Pick a stage to jump to it.</p>
      </header>

      <div className="how-run">
        <Clock />
        <div className="how-run__chapters">
          <Chapter id="product" label="Before launch" span={[0, 0]}>
            <div className="ch__head">
              <div>
                <Heading as="h2">What you describe</Heading>
                <p className="how-lead">
                  A database, a workload and machine sizes make a test. Describe each part once and reuse it; launch the
                  test on its own, as a suite of variants or on a schedule. Hover a block for an example.
                </p>
              </div>
              <Story steps={PRODUCT_STEPS} step={productStep} onStep={setProductStep} label="What people come to do" />
            </div>
            <div className="ch__figure">
              <Diagram groups={PRODUCT_GROUPS} edges={PRODUCT_EDGES} focus={PRODUCT_STEPS[productStep].focus} />
            </div>
          </Chapter>

          <Chapter id="stand" time={clock(stand.at)} label={stand.title} color={stand.color} span={[stand.at, stand.at + stand.min]}>
            <div className="ch__head">
              <div>
                <Heading as="h2">Machines come up in your cloud</Heading>
                <p className="how-lead">
                  {stand.body} The diagram shows where every part runs while the benchmark is on: Stroppy Cloud, Graphene
                  and your cloud. Pick a step to follow a run through it.
                </p>
              </div>
              <Story steps={ARCH_STEPS} step={archStep} onStep={setArchStep} label="A run, step by step" />
            </div>
            <div className="ch__figure">
              <Diagram groups={ARCH_GROUPS} edges={ARCH_EDGES} focus={ARCH_STEPS[archStep].focus} />
            </div>
          </Chapter>

          <Chapter id="tuning" time={clock(deploy.at)} label={deploy.title} color={deploy.color} span={[deploy.at, deploy.at + deploy.min]}>
            <div className="ch__head ch__head--wide">
              <div>
                <Heading as="h2">The database is tuned for its machine</Heading>
                <p className="how-lead">{deploy.body}</p>
              </div>
              <ul className="how-points">
                <li>
                  Every engine it deploys: PostgreSQL, OrioleDB, MySQL, MariaDB, CockroachDB, YDB and Picodata. On by
                  default.
                </li>
                <li>Tuned for the CPUs, memory and disk, the node’s role, the topology and the load.</li>
                <li>A key you set yourself wins, key by key.</li>
                <li>The values a run used are in its report.</li>
                <li>
                  Set the database to <code>stock</code> to measure the engine’s own defaults.
                </li>
              </ul>
            </div>
            <div className="ch__figure">
              <TuneChart />
            </div>
          </Chapter>

          <Chapter id="load" time={clock(load.at)} label={load.title} color={load.color} span={[load.at, load.at + load.min]} className="ch--load">
            <div className="load-pin">
              <Heading as="h2">The load runs while you watch</Heading>
              <p className="how-statement">
                The stroppy runner drives the workload segment by segment: data load, warmup, then the load itself. You
                watch QPS, latency and logs in the console as it goes.
              </p>
              <p className="load-clock" aria-hidden="true">
                <span data-load-clock>0:00</span>
                <span className="load-clock__of">into about {load.min} minutes of load</span>
              </p>
              <p className="how-aside">
                The longest stage: about {load.min} of the run’s {TOTAL} minutes. Keep scrolling and the clock runs
                through it.
              </p>
            </div>
          </Chapter>

          <Chapter id="share" time={clock(collect.at)} label={collect.title} color={collect.color} span={[collect.at, collect.at + collect.min]}>
            <div className="ch__head ch__head--wide">
              <div>
                <Heading as="h2">A report to compare and pass on</Heading>
                <p className="how-lead">{collect.body} Then the report is yours to read, line up against others and send on.</p>
              </div>
            </div>
            <div className="share">
              <div className="share__link">
                <span className="share__url">
                  cloud.stroppy.io/s/<span>&lt;token&gt;</span>
                </span>
                <p>A report opens by a public link. Whoever you send it to reads it without signing in.</p>
                <p className="share__embed-note">The leaderboard can live on your own pages too:</p>
                <code className="share__embed">{`<iframe src="${EMBED}">`}</code>
              </div>
              <dl className="share__list">
                <div>
                  <dt>Side by side</dt>
                  <dd>
                    Put any runs next to each other: throughput, latency percentiles, errors and the machines they ran on.
                  </dd>
                </div>
                <div>
                  <dt>On the leaderboard</dt>
                  <dd>
                    Send a run to the public leaderboard, where it’s ranked against setups of the same size.{' '}
                    <Link to="/#results">Open the leaderboard</Link>
                  </dd>
                </div>
              </dl>
            </div>
          </Chapter>

          <Chapter id="teardown" time={clock(teardown.at)} label={teardown.title} color={teardown.color} span={[teardown.at, TOTAL]} className="ch--short">
            <Heading as="h2">The machines go, the report stays</Heading>
            <p className="how-lead">{teardown.body}</p>
          </Chapter>

          <Chapter id="suites" time={clock(TOTAL)} label="And again" span={[TOTAL, TOTAL]}>
            <div className="ch__head ch__head--wide">
              <div>
                <Heading as="h2">One run answers one question</Heading>
                <p className="how-lead">
                  A suite asks several at once, and a schedule keeps asking. Both launch ordinary runs, each with its own
                  report.
                </p>
              </div>
            </div>
            <div className="again">
              <div className="again__part">
                <h3>Suites</h3>
                <p>
                  Run variants of a test in one launch: database versions, machine sizes, settings. The results land in one
                  table.
                </p>
                <SuiteGrid />
              </div>
              <div className="again__part">
                <h3>Schedules</h3>
                <p>
                  Launch a test or a suite on cron. Each launch adds a point to the history chart, so a slower version or
                  setting shows up before your users notice it.
                </p>
                <code className="again__cron">0 3 * * *</code>
                <History />
              </div>
            </div>
          </Chapter>

          <Chapter id="api" label="From your pipeline" span={[TOTAL, TOTAL]}>
            <div className="ch__head ch__head--wide">
              <div>
                <Heading as="h2">Launch from CI, hear back by webhook</Heading>
                <p className="how-lead">
                  Everything the console does goes through a public REST API with an OpenAPI contract. A personal token
                  launches a test from your pipeline; webhooks report each step of the run as it happens.
                </p>
              </div>
            </div>
            <pre className="how-api">
              <code>
                <span className="how-api__verb">POST</span>
                {' https://cloud.stroppy.io/api/v1/t/{tenant}/tests/{id}:launch\n'}
                <span className="how-api__key">Authorization:</span>
                {' Bearer <token>'}
              </code>
            </pre>
            <div className="hooks">
              <RunStrip compact pins={PINS} />
              <dl className="hooks__other">
                <div>
                  <dt>If a run stops early</dt>
                  <dd>
                    <code>run.failed</code> <code>run.cancelled</code>
                  </dd>
                </div>
                <div>
                  <dt>For a suite</dt>
                  <dd>
                    <code>suite.started</code> <code>suite.cell_finished</code> <code>suite.finished</code>
                  </dd>
                </div>
              </dl>
            </div>
          </Chapter>
        </div>
      </div>

      <footer className="how-end">
        <Heading as="h2">Launch your first run</Heading>
        <p className="how-lead">Create an account, add your cloud key and pick a database and a workload.</p>
        <div className="how-actions">
          <a className="button button--primary button--lg" href={REGISTER}>
            Create account
          </a>
          <Link className="button button--secondary button--outline button--lg" to="/#cli">
            Run the CLI locally
          </Link>
        </div>
      </footer>
    </main>
  );
}

export default function How(): ReactNode {
  return (
    <Layout
      title="How Stroppy Cloud works"
      description="One benchmark run in Stroppy Cloud from launch to report: what you describe, where each part runs, auto tuning, the load, comparing and sharing, suites, schedules and the API.">
      <HowPage />
    </Layout>
  );
}
