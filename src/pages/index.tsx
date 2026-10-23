import {useEffect, useRef, useState, type CSSProperties, type ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import {PairsPlot, type Group} from '@site/src/components/landing/Charts';
import HeroMark from '@site/src/components/landing/HeroMark';
import {ResultsFrame, TopBoard} from '@site/src/components/landing/Leaderboard';
import {PagerCue, PagerNav, PagerSnap, usePager, type Page as PageInfo} from '@site/src/components/landing/Pager';
import RunReplay, {type RunPart} from '@site/src/components/landing/RunReplay';
import useScrollProgress from '@site/src/components/landing/useScrollProgress';
import '../css/landing.css';

const RELEASES = 'https://github.com/stroppy-io/stroppy/releases/latest';

const PAGES: readonly PageInfo[] = [
  {id: 'start', label: 'Start'},
  {id: 'results', label: 'Results'},
  {id: 'run', label: 'A run'},
  {id: 'evidence', label: 'How fast'},
  {id: 'cloud', label: 'Stroppy Cloud'},
];

/** One page of the landing; its content arrives with the scroll that brings it in. */
function Page({id, className, children}: {id: string; className?: string; children: ReactNode}) {
  const ref = useRef<HTMLElement>(null);
  const p = useScrollProgress(ref, {start: 1, end: 0.25});
  return (
    <section ref={ref} id={id} className={clsx('page', className)}>
      <div className="page__inner" style={{'--in': String(p)} as CSSProperties}>
        {children}
      </div>
    </section>
  );
}

function CopyButton({text}: {text: string}) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return undefined;
    const t = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(t);
  }, [copied]);
  return (
    <button
      type="button"
      className="copy"
      onClick={() => navigator.clipboard?.writeText(text).then(() => setCopied(true))}>
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function Shell({children}: {children: string}) {
  return (
    <div className="shell">
      <pre>
        <code>{children}</code>
      </pre>
      <CopyButton text={children} />
    </div>
  );
}

const PLATFORMS = [
  {id: 'linux_amd64', label: 'Linux x86-64'},
  {id: 'linux_arm64', label: 'Linux ARM64'},
  {id: 'darwin_arm64', label: 'macOS Apple silicon'},
  {id: 'darwin_amd64', label: 'macOS Intel'},
] as const;

const installScript = (platform: string) =>
  `curl -fsSL ${RELEASES}/download/stroppy_${platform}.tar.gz | tar -xz
sudo install stroppy /usr/local/bin/`;

function Install() {
  const [platform, setPlatform] = useState<string>(PLATFORMS[0].id);
  // A Mac visitor most likely wants the Mac build; Apple silicon is the default there.
  useEffect(() => {
    if (/Mac/.test(navigator.platform || navigator.userAgent)) setPlatform('darwin_arm64');
  }, []);
  return (
    <div className="install">
      <div className="install__tabs" role="tablist" aria-label="Platform">
        {PLATFORMS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={platform === p.id}
            className="install__tab"
            onClick={() => setPlatform(p.id)}>
            {p.label}
          </button>
        ))}
      </div>
      <Shell>{installScript(platform)}</Shell>
      <p className="install__more">
        It’s one file, about 40 MB, and the archive has nothing else in it. Docker and building from source are covered
        in <Link to="/docs/introduction#installation">the introduction</Link>.
      </p>
    </div>
  );
}

function Hero() {
  // The mark opens as the page scrolls away from the headline.
  const ref = useRef<HTMLElement>(null);
  const open = useScrollProgress(ref, {start: 0.12, end: -0.45, settled: 0});
  return (
    <header ref={ref} id="start" className="intro page">
      <HeroMark open={open} />
      <div className="container intro__inner">
        <div className="intro__text">
          <Heading as="h1" className="intro__title">
            Stress-test your database, not your load generator.
          </Heading>
          <p className="intro__lede">
            Stroppy is a single Go binary for database workloads, including TPC-B, TPC-C, TPC-H, TPC-DS and banking checks.
            Drivers cover PostgreSQL, MySQL, CockroachDB, YugabyteDB, TiDB, Picodata and YDB, with support varying by workload.
            We kept catching benchmarks that were really measuring the client, so Stroppy can tell you where its own
            limit is before you start blaming the database.
          </p>
          <div className="intro__actions">
            <Link className="button button--primary button--lg" to="/docs/introduction">
              Read the docs
            </Link>
          </div>
          <Install />
        </div>
        <TopBoard />
      </div>
    </header>
  );
}

function Results() {
  return (
    <Page id="results" className="story">
      <div className="container">
        <div className="story__head">
          <Heading as="h2">Runs other people can check</Heading>
          <p>
            Each row is a run published from Stroppy Cloud, with the workload, the database and its version, and the
            machines it ran on. Filter by any of them; a row opens the full report with every metric of that run.
          </p>
        </div>
        <ResultsFrame />
      </div>
    </Page>
  );
}

// Published measurements only; each group names its post.
const GROUPS: Group[] = [
  {
    title: 'go-tpc → Stroppy',
    per: 'go-tpc',
    setting: (
      <>
        TPC-C on OrioleDB, one hour, 1000 warehouses, 100 VUs, Stroppy 5.7.2.{' '}
        <Link to="/blog/stroppy-vs-go-tpc">How we found it</Link>
      </>
    ),
    rows: [{label: 'go-tpc → tpcc/procs', them: 6399, us: 15791}],
  },
  {
    title: 'v5 on k6 → v6',
    per: 'v5',
    setting: (
      <>
        Medians of five runs on one AMD EPYC Genoa VM. Big on the noop driver, small on a real database, which is how
        it should be. <Link to="/blog/why-stroppy-moved-off-k6">Why we dropped k6</Link>
      </>
    ),
    rows: [
      {label: 'TPC-B ceiling, 1 VU', them: 4368, us: 145524},
      {label: 'TPC-B ceiling, 24 VUs', them: 38694, us: 517627},
      {label: 'TPC-C on PostgreSQL, 1 VU', them: 202, us: 290},
      {label: 'TPC-C on PostgreSQL, 16 VUs', them: 2892, us: 3368},
    ],
  },
  {
    title: 'Database → Stroppy ceiling',
    per: 'PostgreSQL',
    setting: 'Same VM, 16 VUs. Different workloads; the gap is the room the client leaves.',
    rows: [{label: 'PostgreSQL TPC-C → noop TPC-B', them: 3368, us: 500772}],
  },
];

function Evidence() {
  return (
    <Page id="evidence" className="story">
      <div className="container">
        <div className="story__head">
          <Heading as="h2">How fast the client is, and why it matters</Heading>
          <p>
            Every number a load generator reports includes the load generator. If the client is slow, the database
            waits and you end up measuring the tool. <code>stroppy baseline</code> shows how much room it leaves on
            your machine.
          </p>
        </div>
        <PairsPlot groups={GROUPS} />
      </div>
    </Page>
  );
}

type Note = {part: RunPart; title: string; body: ReactNode};

// What the command asks for: each note is something the binary carries.
const ASK: Note[] = [
  {
    part: 'workload',
    title: 'tpcb/tx',
    body: (
      <>
        The workload: TPC-B, TPC-C, TPC-H, TPC-DS or a <code>.sql</code> file of your own. The built-in SQL is just a
        file too, and a copy in your working directory wins.
      </>
    ),
  },
  {
    part: 'driver',
    title: '-d pg',
    body: (
      <>
        PostgreSQL, MySQL, Picodata or YDB, each loading through its fast path (<code>COPY</code> on Postgres). The same
        seed gives the same rows however many workers load them.
      </>
    ),
  },
  {
    part: 'executor',
    title: '--executor',
    body: 'Eight VUs keep sending transactions for 30 seconds; shared-iterations splits a fixed count instead.',
  },
];

// What comes back.
const GET: Note[] = [
  {part: 'steps', title: 'Steps', body: 'Schema, data load and ANALYZE run first, and each one logs how long it took.'},
  {part: 'counters', title: 'Counters', body: '5,603 transactions, 5,603 commits, not one failed iteration.'},
  {
    part: 'rates',
    title: 'tps',
    body: '186 a second. TPC-B at scale 1 has one branch row and every transaction updates it, so that row is the bottleneck here.',
  },
  {
    part: 'tail',
    title: 'p(99)',
    body: 'One transaction in a hundred took around 250 ms while the average was 43, which is why we don’t lead with averages.',
  },
];

function Notes({notes, part, setPart}: {notes: Note[]; part: RunPart | null; setPart: (p: RunPart | null) => void}) {
  return (
    <ul className="notes">
      {notes.map((n) => (
        <li key={n.part}>
          <button
            type="button"
            className="note"
            aria-pressed={part === n.part}
            onMouseEnter={() => setPart(n.part)}
            onMouseLeave={() => setPart(null)}
            onFocus={() => setPart(n.part)}
            onBlur={() => setPart(null)}>
            <span className="note__title">{n.title}</span>
            <span className="note__body">{n.body}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function Anatomy() {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  const [part, setPart] = useState<RunPart | null>(null);
  useEffect(() => {
    if (!ref.current) return undefined;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setSeen(true), {threshold: 0.5});
    io.observe(ref.current);
    return () => io.disconnect();
  }, []);
  return (
    <Page id="run" className="story story--panel">
      <div className="container">
        <div className="story__head">
          <Heading as="h2">One command in, a summary out</Heading>
          <p>
            All of it ships in the one binary, since version 6 dropped k6 and TypeScript and there’s nothing left to
            install next to it. Hover a note to see which part of the run it’s about.
          </p>
        </div>
        <div className="anatomy">
          <div ref={ref} className="anatomy__run">
            <RunReplay active={seen} highlight={part} />
          </div>
          <div className="anatomy__side">
            <h3 className="anatomy__group">What you ask for</h3>
            <Notes notes={ASK} part={part} setPart={setPart} />
            <h3 className="anatomy__group">What you get back</h3>
            <Notes notes={GET} part={part} setPart={setPart} />
          </div>
        </div>
      </div>
    </Page>
  );
}

function Cloud() {
  return (
    <Page id="cloud" className="finale page--end">
      <HeroMark open={0.6} />
      <div className="container finale__inner">
        <div className="finale__text">
          <Heading as="h2">Don’t feel like setting up the machines?</Heading>
          <p>
            Stroppy Cloud does that part. You pick a database and a workload; it brings up the stand in your cloud, runs
            the test and gives you a report with queries per second, latency and the moment errors began. Run it again
            next week and the two sit side by side.
          </p>
          <a className="button button--primary button--lg" href="https://cloud.stroppy.io">
            Open Stroppy Cloud
          </a>
        </div>
      </div>
    </Page>
  );
}

function Landing() {
  const root = useRef<HTMLDivElement>(null);
  const pager = usePager(PAGES, root);
  return (
    <PagerSnap>
      <div ref={root}>
        <Hero />
        <main>
          <Results />
          <Anatomy />
          <Evidence />
          <Cloud />
        </main>
        {pager.paged && (
          <>
            <PagerNav pages={PAGES} {...pager} />
            <PagerCue pages={PAGES} {...pager} />
          </>
        )}
      </div>
    </PagerSnap>
  );
}

export default function Home(): ReactNode {
  return (
    <Layout
      title="Go-Native Database Stress Testing"
      description="Stroppy is a database stress tester in a single Go binary: TPC-B, TPC-C, TPC-H and TPC-DS against PostgreSQL, MySQL, Picodata and YDB, with a baseline that measures the tool's own limit.">
      <Landing />
    </Layout>
  );
}
