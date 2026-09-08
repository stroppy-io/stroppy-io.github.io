import type {ReactNode} from 'react';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

function HomepageHeader() {
  return (
    <header className="hero hero--stroppy">
      <div className="container">
        <img src="/img/hero-logo.svg" alt="Stroppy" className="hero-logo" />
        <Heading as="h1" className="hero__title">
          Stroppy
        </Heading>
        <p className="hero__subtitle">
          Go-native database stress testing in one binary. Run deterministic TPC
          workloads, measure client overhead, and export native metrics through OpenTelemetry.
        </p>
        <div style={{display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '2rem'}}>
          <Link
            className="button button--lg"
            style={{background: '#fbbf24', color: '#1e1e1e', border: 'none', fontWeight: 700}}
            to="/docs/introduction">
            Get Started
          </Link>
          <Link
            className="button button--outline button--lg"
            style={{color: 'white', borderColor: 'rgba(255,255,255,0.4)'}}
            href="https://github.com/stroppy-io/stroppy/releases/tag/v6.0.0">
            Download v6
          </Link>
        </div>
      </div>
    </header>
  );
}

type FeatureItem = {
  title: string;
  icon: string;
  description: ReactNode;
};

const features: FeatureItem[] = [
  {
    title: 'One Go Binary',
    icon: '◆',
    description: (
      <>
        No external workload runtime. The CLI, executor, workloads, drivers,
        generators, metrics, and SQL assets ship together.
      </>
    ),
  },
  {
    title: 'Deterministic Generation',
    icon: '⚄',
    description: (
      <>
        Typed reusable batches and canonical dbgen/dsdgen adapters reproduce
        data across worker counts and partition boundaries.
      </>
    ),
  },
  {
    title: 'Native Metrics',
    icon: '⚡',
    description: (
      <>
        Bounded counters, gauges, and histograms produce terminal summaries and
        optional OTLP gRPC or HTTP export.
      </>
    ),
  },
  {
    title: 'Built-in Workloads',
    icon: '📊',
    description: (
      <>
        Run TPC-B, TPC-C, TPC-H, TPC-DS, direct SQL, and machine-baseline
        workloads with typed flags.
      </>
    ),
  },
  {
    title: 'SQL-First Assets',
    icon: '🗃️',
    description: (
      <>
        Organize dialect SQL with named sections, named queries, bound
        parameters, and local file overrides.
      </>
    ),
  },
  {
    title: 'Six Drivers',
    icon: '🔌',
    description: (
      <>
        PostgreSQL, MySQL, Picodata, YDB, Noop, and CSV drivers expose
        discoverable load and query capabilities.
      </>
    ),
  },
];

function Feature({title, icon, description}: FeatureItem) {
  return (
    <div className="col col--4" style={{marginBottom: '2rem'}}>
      <div className="feature-card">
        <div style={{fontSize: '2.5rem'}}>{icon}</div>
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

function QuickStart() {
  return (
    <section style={{padding: '4rem 0', background: 'var(--ifm-background-surface-color)'}}>
      <div className="container">
        <div className="row">
          <div className="col col--4">
            <Heading as="h2">Inspect and baseline</Heading>
            <div className="workflow-step">
              <div className="workflow-step-number">1</div>
              <div>
                <strong>Verify release</strong>
                <pre><code>stroppy version</code></pre>
              </div>
            </div>
            <div className="workflow-step">
              <div className="workflow-step-number">2</div>
              <div>
                <strong>List capabilities</strong>
                <pre><code>stroppy probe</code></pre>
              </div>
            </div>
            <div className="workflow-step">
              <div className="workflow-step-number">3</div>
              <div>
                <strong>Measure this machine</strong>
                <pre><code>stroppy baseline --quick</code></pre>
              </div>
            </div>
          </div>
          <div className="col col--4">
            <Heading as="h2">Run a database workload</Heading>
            <pre style={{padding: '1.5rem', borderRadius: '8px'}}>
              <code>{`# TPC-C on PostgreSQL
stroppy run tpcc/tx -d pg \\
  -D url=postgres://u:p@host/db \\
  --executor constant-vus \\
  --vus 10 --duration 60s

# Fixed-work TPC-B run
stroppy run tpcb/tx -d pg \\
  --iterations 100`}</code>
            </pre>
            <p style={{fontSize: '0.9rem', opacity: 0.8}}>
              <Link to="/docs/presets">Explore built-in workloads &rarr;</Link>
            </p>
          </div>
          <div className="col col--4">
            <Heading as="h2">Use Docker</Heading>
            <pre style={{padding: '1.5rem', borderRadius: '8px'}}>
              <code>{`docker pull \\
  ghcr.io/stroppy-io/stroppy:latest

docker run --rm --network host \\
  ghcr.io/stroppy-io/stroppy:latest \\
  run tpch/tx -d pg \\
  --scale-factor 0.01`}</code>
            </pre>
            <p style={{fontSize: '0.9rem', opacity: 0.8}}>
              <Link to="/docs/introduction#docker">Installation and Docker details &rarr;</Link>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Home(): ReactNode {
  return (
    <Layout
      title="Go-Native Database Stress Testing"
      description="Stroppy v6 is a self-contained Go CLI for deterministic TPC workloads, database stress testing, machine baselines, and OpenTelemetry metrics.">
      <HomepageHeader />
      <main>
        <section style={{padding: '4rem 0'}}>
          <div className="container">
            <div className="row">
              {features.map((props) => (
                <Feature key={props.title} {...props} />
              ))}
            </div>
          </div>
        </section>
        <QuickStart />
      </main>
    </Layout>
  );
}
