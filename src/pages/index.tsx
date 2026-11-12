import type {ReactNode} from 'react';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import {HtmlClassNameProvider} from '@docusaurus/theme-common';
import {usePluginData} from '@docusaurus/useGlobalData';
import type {ConformitySummary} from '@site/plugins/conformity';
import {TopBoard} from '@site/src/components/landing/Leaderboard';
import useRatings from '@site/src/components/landing/useRatings';
import CompatSpread, {COMPATIBLE} from '@site/src/components/landing/CompatSpread';
import {mapUrl, protocolShort} from '@site/src/components/conformity/data';
import {TOOLS} from '@site/src/components/tools/tools';
import '../css/landing.css';

// The landing says one thing: Stroppy is an open project that helps you pick
// a database by measurement. The claim beside the live TPC-C rating, then
// prose: what the project is, with its numbers; the problems of choosing a
// database and how each is answered, with one measured number each; how
// compatible the PostgreSQL-compatible engines are; the tools behind the
// numbers. The numbers come from the data
// (plugins/conformity.ts, plugins/cloud-rating.ts) or a published post.

type Numbers = {engines: number; protocols: string[]; runs: number; pg: number; pgUnder: number};

/** The project's numbers, counted from the data the site is built with. */
function useNumbers(): Numbers {
  const {summary} = usePluginData('conformity') as {summary: ConformitySummary | null};
  const {rating, procs} = useRatings();
  const protocols = summary?.protocols ?? [];
  const pg = protocols.find((p) => p.protocol === 'pgwire')?.scores ?? [];
  return {
    engines: new Set(protocols.flatMap((p) => p.scores.map((s) => s.target))).size,
    protocols: protocols.map((p) => protocolShort(p.protocol)),
    runs: [...(rating?.data ?? []), ...(procs?.data ?? [])].reduce((sum, r) => sum + r.runs, 0),
    pg: pg.length,
    pgUnder: pg.filter((s) => s.score < COMPATIBLE).length,
  };
}

function Hero({n}: {n: Numbers}) {
  return (
    <header className="home-hero">
      <div className="container home-hero__inner">
        <div>
          <Heading as="h1" className="home-hero__title">
            Pick a database on evidence
          </Heading>
          <p className="home-hero__lead">
            We want a database choice anyone can check: the same open tests for every engine, every result public.
          </p>
          <ul className="home-facts">
            <li>{n.engines} engines checked</li>
            <li>{n.protocols.length} protocols</li>
            <li>TPC-C on 32 vCPU · 128 GB</li>
            <li>Open source</li>
          </ul>
          <div className="home-actions">
            <Link className="button button--primary button--lg" to="/ratings">
              Find your database
            </Link>
            <Link className="button button--secondary button--outline button--lg" to="/vendors#fairness">
              Methodology
            </Link>
          </div>
          <p className="home-aside">
            Building a database? <Link to="/vendors">Get it measured</Link>
          </p>
        </div>
        <TopBoard more={{href: '/ratings?bench&sort=speed', label: 'All benchmarks'}} />
      </div>
    </header>
  );
}

function About({n}: {n: Numbers}) {
  return (
    <section className="home-block">
      <div className="container">
        <p className="home-about">
          <b>Stroppy is an open project that measures databases the same way and publishes every result.</b> We run the workloads, check
          protocol compatibility against the original engine, and link every number to the run behind it.
        </p>
        <dl className="home-numbers">
          <div>
            <dt>{n.engines}</dt>
            <dd>engines checked for protocol compatibility</dd>
          </div>
          <div>
            <dt>{n.protocols.length}</dt>
            <dd>protocols: {n.protocols.join(', ')}</dd>
          </div>
          <div>
            <dt>{n.runs}</dt>
            <dd>TPC-C runs behind the public rating in the last 30 days</dd>
          </div>
          <div>
            <dt>{TOOLS.length}</dt>
            <dd>tools behind the numbers</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

type Problem = {topic: string; title: string; why: string; answer: ReactNode; link: {label: string; href: string}};

function Problems({n}: {n: Numbers}) {
  const problems: Problem[] = [
    {
      topic: 'Compatibility',
      title: '“Compatible” doesn’t say what breaks',
      why: 'Engines claim the PostgreSQL or MySQL protocol; clients find the gaps in production, one query at a time.',
      answer: (
        <>
          <b>Stroppy Conformity</b> runs the same checks on the original and on the engine, and keeps what each answered: the request, the
          original’s reply, the engine’s reply.
        </>
      ),
      link: {label: 'Open the conformity map', href: mapUrl({protocol: 'pgwire'})},
    },
    {
      topic: 'Speed',
      title: 'Vendor benchmarks don’t compare',
      why: 'Each vendor picks its own workload, machine and settings, so two published numbers rarely measure the same thing.',
      answer: (
        <>
          <b>We run</b> the same TPC-C on one 32 vCPU · 128 GB node, every engine deployed and tuned the same way, and every row opens the
          report of its run.
        </>
      ),
      link: {label: 'See the ratings', href: '/ratings'},
    },
    {
      topic: 'Client',
      title: 'The load generator is part of the result',
      why: 'How a client sends a transaction changes the number it reports, often by more than the database does.',
      answer: (
        <>
          <b>On the same OrioleDB</b>, the same TPC-C ran at 4,410 transactions a second with 18 round trips each, and at 15,791 with one.
          The rating shows both.
        </>
      ),
      link: {label: 'How we found it', href: '/blog/stroppy-vs-go-tpc'},
    },
    {
      topic: 'Effort',
      title: 'A bench stand takes weeks',
      why: 'Machines, deployment, tuning, monitoring and teardown come before the first number, and again for every engine.',
      answer: (
        <>
          <b>Stroppy Cloud</b> brings the stand up in your own cloud account, deploys and tunes the database, runs the test and keeps the
          report after the machines are gone.
        </>
      ),
      link: {label: 'Stroppy Cloud', href: '/tools/cloud'},
    },
  ];
  return (
    <section className="home-block">
      <div className="container">
        <Heading as="h2" className="home-h2">
          What gets in the way of choosing a database
        </Heading>
        <div className="home-cards">
          {problems.map((p) => (
            <article key={p.topic} className="home-card">
              <p className="home-card__topic">{p.topic}</p>
              <Heading as="h3">{p.title}</Heading>
              <p className="home-card__why">{p.why}</p>
              <p className="home-card__answer">{p.answer}</p>
              <Link className="home-card__link" to={p.link.href}>
                {p.link.label}
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Compatibility({n}: {n: Numbers}) {
  return (
    <section className="home-block">
      <div className="container home-split">
        <div>
          <Heading as="h2" className="home-h2">
            “PostgreSQL‑compatible” rarely is
          </Heading>
          <p className="home-text">
            Each engine against PostgreSQL itself, on the same checks. A score is how often the engine answers like the original; the line
            marks {COMPATIBLE}, where we call an engine compatible.
          </p>
          <p className="home-big">
            {n.pgUnder} of {n.pg}
            <span>PostgreSQL-compatible engines score under {COMPATIBLE} of 100</span>
          </p>
          <div className="home-actions">
            <Link className="button button--primary button--lg" to={mapUrl({protocol: 'pgwire'})}>
              Open the conformity map
            </Link>
          </div>
        </div>
        <CompatSpread protocol="pgwire" />
      </div>
    </section>
  );
}

function Tools() {
  return (
    <section className="home-block">
      <div className="container">
        <Heading as="h2" className="home-h2">
          The tools behind the numbers
        </Heading>
        <div className="home-tools">
          {TOOLS.map((t) => (
            <Link key={t.id} to={t.href} className={`home-tool home-tool--${t.id}`}>
              <span className="home-tool__kind">{t.kind}</span>
              <span className="home-tool__name">{t.name}</span>
              <span className="home-tool__what">{t.what}</span>
              <ul className="home-tool__facts">
                {t.facts.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <span className="home-tool__more">About {t.name}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Home(): ReactNode {
  const n = useNumbers();
  return (
    // home-page narrows the bar, the page and the footer to one column (landing.css).
    <HtmlClassNameProvider className="home-page">
      <Layout
        title="Pick a database on evidence"
        description="An open project that measures every database the same way, speed and protocol compatibility, and publishes the results.">
        <main className="home">
          <Hero n={n} />
          <About n={n} />
          <Problems n={n} />
          <Compatibility n={n} />
          <Tools />
        </main>
      </Layout>
    </HtmlClassNameProvider>
  );
}
