import {useRef, type ReactNode} from 'react';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import HeroMark from '@site/src/components/landing/HeroMark';
import {TopBoard} from '@site/src/components/landing/Leaderboard';
import CompatSpread, {COMPATIBLE, useCompat} from '@site/src/components/landing/CompatSpread';
import useScrollProgress from '@site/src/components/landing/useScrollProgress';
import {mapUrl} from '@site/src/components/conformity/data';
import {TOOLS} from '@site/src/components/tools/tools';
import {CLOUD} from '@site/src/components/landing/rating';
import '../css/landing.css';

// The landing says one thing: Stroppy is an open project that helps you pick
// a database by measurement. A short claim, then two measurements that back
// it (speed on one machine, compatibility against the original), then the
// open tools behind them.

function Hero() {
  // The mark opens as the page scrolls away from the headline.
  const ref = useRef<HTMLElement>(null);
  const open = useScrollProgress(ref, {start: 0.12, end: -0.45, settled: 0});
  return (
    <header ref={ref} className="home-hero">
      <HeroMark open={open} />
      <div className="container home-hero__inner">
        <div>
          <Heading as="h1" className="home-hero__title">
            Pick a database on evidence
          </Heading>
          <p className="home-hero__lead">
            We want a database choice anyone can check: the same open tests for every engine, every result public.
          </p>
          <div className="home-actions">
            <Link className="button button--primary button--lg" to="/ratings">
              Find your database
            </Link>
            <Link className="button button--secondary button--outline button--lg" to="/vendors#fairness">
              Methodology
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}

function Benchmarks() {
  return (
    <section className="home-block">
      <div className="container home-split">
        <div>
          <p className="home-eyebrow">Benchmarks</p>
          <Heading as="h2">Explore your database’s speed</Heading>
          <p className="home-text">TPC-C on one 32-core server. Every row opens the full run report.</p>
          <div className="home-actions">
            <Link className="button button--primary button--lg" to="/ratings?bench&sort=speed">
              Open benchmarks →
            </Link>
          </div>
        </div>
        <TopBoard more={{href: '/ratings', label: 'All ratings →'}} />
      </div>
    </section>
  );
}

function Compatibility() {
  const scores = useCompat('pgwire');
  const under = scores.filter((s) => s.score < COMPATIBLE).length;
  return (
    <section className="home-block">
      <div className="container home-split">
        <div>
          <p className="home-eyebrow">Compatibility</p>
          <Heading as="h2">“PostgreSQL-compatible” rarely is</Heading>
          <p className="home-text">We run the same checks on PostgreSQL and on every engine that claims its protocol.</p>
          <p className="home-big">
            {under} of {scores.length}
            <span>score under {COMPATIBLE} of 100</span>
          </p>
          <div className="home-actions">
            <Link className="button button--primary button--lg" to={mapUrl({protocol: 'pgwire'})}>
              Open the conformity map →
            </Link>
          </div>
        </div>
        <CompatSpread protocol="pgwire" />
      </div>
    </section>
  );
}

function Open() {
  return (
    <section className="home-block">
      <div className="container">
        <p className="home-eyebrow">All open</p>
        <Heading as="h2">Check any number yourself</Heading>
        <p className="home-text">The tools behind these results are open source.</p>
        <div className="home-tools">
          {TOOLS.map((t) => (
            <Link key={t.id} to={t.href} className={`home-tool home-tool--${t.id}`}>
              <span className="home-tool__name">{t.name}</span>
              <span className="home-tool__what">{t.what}</span>
            </Link>
          ))}
        </div>
        <p className="home-cloud">
          Don’t want to set up the machines? <a href={`${CLOUD}/register`}>Try Stroppy Cloud</a>
        </p>
      </div>
    </section>
  );
}

export default function Home(): ReactNode {
  return (
    <Layout
      title="Pick a database on evidence"
      description="An open project that measures every database the same way, speed and protocol compatibility, and publishes the results.">
      <main className="home">
        <Hero />
        <Benchmarks />
        <Compatibility />
        <Open />
      </main>
    </Layout>
  );
}
