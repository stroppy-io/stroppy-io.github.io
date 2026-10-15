import {useCallback, useEffect, useLayoutEffect, useState} from 'react';
import clsx from 'clsx';

// A real run, trimmed: Stroppy v6.1.1, TPC-B against PostgreSQL 17 in a local
// Docker container, 8 VUs for 30 seconds. The step log keeps three of its
// lines and the summary seven of its twenty-two, in the order Stroppy printed
// them. The URL is shortened; nothing else is changed.

/** Parts of the command and of the output a note can point at. */
export type RunPart = 'workload' | 'driver' | 'executor' | 'steps' | 'counters' | 'rates' | 'tail';

const TOKENS: {text: string; part?: RunPart}[] = [
  {text: 'stroppy run'},
  {text: 'tpcb/tx', part: 'workload'},
  {text: '-d pg -D url=postgres://localhost/bench', part: 'driver'},
  {text: '--executor constant-vus --vus 8 --duration 30s', part: 'executor'},
];
const COMMAND = TOKENS.map((t) => t.text).join(' ');

const STEPS = [
  "19:08:49.103  INFO  End of 'create_schema' step (took 24ms)",
  "19:08:49.236  INFO  End of 'load_data' step (took 132ms)",
  "19:08:49.553  INFO  End of 'analyze' step (took 262ms)",
];

type SummaryLine = {name: string; value: string; part: 'counters' | 'rates' | 'hist'};

const SUMMARY: SummaryLine[] = [
  {name: 'transactions_total', value: '5603.000', part: 'counters'},
  {name: 'failed_iterations_total', value: '0.000', part: 'counters'},
  {
    name: 'tx_total_duration',
    value: 'count=5603 avg=42.767 p(50)~=50.000 p(90)~=100.000 p(95)~=100.000 p(99)~=250.000',
    part: 'hist',
  },
  {name: 'tx_commits_total', value: '5603.000', part: 'counters'},
  {name: 'tps', value: '186.530', part: 'rates'},
  {name: 'queries_per_second', value: '932.648', part: 'rates'},
  {name: 'measurement_seconds', value: '30.038', part: 'rates'},
];

const TYPE_MS = 12;
const LOG_MS = 160;
const RUN_MS = 1500;
const LINE_MS = 90;

// Where the replay stands: command characters typed, log lines shown, the
// run going, summary lines shown (the heading counts as one).
type Phase = {typed: number; logs: number; running: boolean; lines: number};
const DONE: Phase = {typed: COMMAND.length, logs: STEPS.length, running: false, lines: SUMMARY.length + 1};
const EMPTY: Phase = {typed: 0, logs: 0, running: false, lines: 0};

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Flags take the link colour, so the shape of a run reads at a glance.
function Words({text}: {text: string}) {
  return (
    <>
      {text.split(/(\s+)/).map((word, i) =>
        word.startsWith('-') ? (
          <span key={i} className="run__flag">
            {word}
          </span>
        ) : (
          word
        ),
      )}
    </>
  );
}

// The command as typed so far; the rest is laid out but hidden.
function Command({typed, highlight}: {typed: number; highlight?: RunPart | null}) {
  let start = 0;
  return (
    <>
      {TOKENS.map((t, i) => {
        if (i > 0) start += 1;
        const from = start;
        start += t.text.length;
        const shown = Math.max(0, Math.min(t.text.length, typed - from));
        const typing = typed >= from && typed < from + t.text.length && typed < COMMAND.length;
        return (
          <span key={t.text}>
            {i > 0 && <span className={typed > from - 1 ? undefined : 'run__hidden'}> </span>}
            <span
              className={clsx('run__token', highlight && (t.part === highlight ? 'run__lit' : 'run__dim'))}
              data-part={t.part}>
              <Words text={t.text.slice(0, shown)} />
              {typing && <span className="run__caret" />}
              <span className="run__hidden">
                <Words text={t.text.slice(shown)} />
              </span>
            </span>
          </span>
        );
      })}
    </>
  );
}

function Histogram({value}: {value: string}) {
  return (
    <>
      {value.split(' ').map((field, i) => {
        const [, key, sep, val] = /^([^~=]+)(~?=)(.*)$/.exec(field) ?? ['', field, '', ''];
        return (
          <span key={i}>
            {i > 0 && ' '}
            <span className={key === 'p(99)' ? 'run__field run__tail' : 'run__field'}>
              <span className="run__key">{key}</span>
              {sep}
              {val}
            </span>
          </span>
        );
      })}
    </>
  );
}

// Which output part a note about `highlight` keeps bright: p(99) lives inside
// the histogram line, which stays up and picks out that field.
const keeps = (highlight: RunPart, part: RunPart | 'hist') =>
  highlight === part || (part === 'hist' && highlight === 'tail');

/**
 * Plays the run each time `active` turns true. Everything is laid out from the
 * start and only revealed, so the panel never changes size while it plays.
 * Without JavaScript, or with reduced motion, the finished run shows.
 * `highlight` picks out one part of the command or the output and quiets the rest.
 */
export default function RunReplay({active, highlight}: {active: boolean; highlight?: RunPart | null}) {
  const [phase, setPhase] = useState<Phase>(DONE);
  const [epoch, setEpoch] = useState(0);

  useLayoutEffect(() => {
    if (reducedMotion()) setPhase(DONE);
    else if (!active) setPhase(EMPTY);
  }, [active]);

  useEffect(() => {
    if (!active || reducedMotion()) return undefined;
    const timers: number[] = [];
    const at = (ms: number, next: Phase) => timers.push(window.setTimeout(() => setPhase(next), ms));
    const typed = COMMAND.length;
    setPhase(EMPTY);
    let t = 350;
    for (let c = 1; c <= typed; c++) at((t += TYPE_MS), {...EMPTY, typed: c});
    t += 200;
    for (let l = 1; l <= STEPS.length; l++) at((t += LOG_MS), {...EMPTY, typed, logs: l});
    at((t += 150), {typed, logs: STEPS.length, running: true, lines: 0});
    t += RUN_MS;
    for (let l = 1; l <= SUMMARY.length + 1; l++) {
      at((t += LINE_MS), {typed, logs: STEPS.length, running: false, lines: l});
    }
    return () => timers.forEach(window.clearTimeout);
  }, [active, epoch]);

  const replay = useCallback(() => setEpoch((e) => e + 1), []);
  const finished = phase.lines === SUMMARY.length + 1;
  const dim = (part: RunPart | 'hist') => (highlight && !keeps(highlight, part) ? 'run__dim' : undefined);
  const outputDim = highlight && ['workload', 'driver', 'executor'].includes(highlight) ? 'run__dim' : undefined;

  return (
    <figure className="run" data-hl={highlight ?? undefined}>
      <div className="run__bar">
        <span>~/bench</span>
        <button type="button" className="run__replay" onClick={replay} disabled={!finished}>
          Run again
        </button>
      </div>
      <div className={phase.running ? 'run__load run__load--active' : 'run__load'} aria-hidden="true" />
      <pre className="run__screen" aria-label={`${COMMAND}, followed by its log and summary`}>
        <code>
          <span className="run__prompt">$ </span>
          <Command typed={phase.typed} highlight={highlight} />
          {'\n'}
          <span className={outputDim}>
            {STEPS.map((line, i) => (
              <span key={line} className={clsx('run__log', i >= phase.logs && 'run__hidden', dim('steps'))}>
                {line}
                {'\n'}
              </span>
            ))}
            <span className={clsx(phase.lines < 1 && 'run__hidden', highlight && 'run__dim')}>
              {'\n'}
              <span className="run__heading">=== bench summary ===</span>
              {'\n'}
            </span>
            {SUMMARY.map((line, i) => (
              <span
                key={line.name}
                className={clsx('run__line', i + 1 >= phase.lines && 'run__hidden', dim(line.part))}>
                {'  '}
                <span className="run__name">{line.part === 'hist' ? line.name : `${line.name.padEnd(40)} `}</span>
                {line.part === 'hist' ? (
                  <>
                    {'\n    '}
                    <Histogram value={line.value} />
                  </>
                ) : (
                  line.value
                )}
                {'\n'}
              </span>
            ))}
          </span>
        </code>
      </pre>
      <figcaption className="run__caption">
        Real output from Stroppy 6.1.1 against PostgreSQL 17 in Docker, trimmed to the lines the notes talk about.
      </figcaption>
    </figure>
  );
}
