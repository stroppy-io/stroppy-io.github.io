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
          Database stress testing CLI powered by k6. Write tests in TypeScript,
          generate data with flexible generators, get detailed HTML reports.
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
            href="https://github.com/stroppy-io/stroppy">
            GitHub
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
    title: 'TypeScript Test Scripts',
    icon: '{}',
    description: (
      <>
        Write database stress tests in TypeScript with full type safety.
        Use k6 scenarios, thresholds, and the built-in helpers framework.
      </>
    ),
  },
  {
    title: 'Flexible Data Generation',
    icon: '\u2684',
    description: (
      <>
        Generate realistic test data with uniform, normal, and Zipfian distributions.
        Strings, integers, floats, UUIDs, booleans, dates &mdash; with sequence
        and random modes.
      </>
    ),
  },
  {
    title: 'k6 Under the Hood',
    icon: '\u26A1',
    description: (
      <>
        Built as a k6 extension. Get virtual users, scenarios, thresholds,
        real-time web dashboard, and HTML report export out of the box.
        All k6 features work natively.
      </>
    ),
  },
  {
    title: 'Built-in Workloads',
    icon: '\uD83D\uDCCA',
    description: (
      <>
        Start immediately with TPC-B, TPC-C, and TPC-DS preset workloads.
        Or scaffold your own with <code>stroppy gen --preset=simple</code>.
      </>
    ),
  },
  {
    title: 'SQL-First Approach',
    icon: '\uD83D\uDDC3\uFE0F',
    description: (
      <>
        Organize SQL in structured files with named sections and queries.
        Named parameters, automatic placeholder conversion, and argument
        validation out of the box.
      </>
    ),
  },
  {
    title: 'Extensible Drivers',
    icon: '\uD83D\uDD0C',
    description: (
      <>
        PostgreSQL driver built-in with connection pooling and COPY support.
        Add your own database driver by implementing a simple Go interface
        and registering it.
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
            <Heading as="h2">Up and running in 30 seconds</Heading>
            <div className="workflow-step">
              <div className="workflow-step-number">1</div>
              <div>
                <strong>Generate a workspace</strong>
                <pre><code>stroppy gen --preset=simple</code></pre>
              </div>
            </div>
            <div className="workflow-step">
              <div className="workflow-step-number">2</div>
              <div>
                <strong>Install dependencies</strong>
                <pre><code>cd simple && npm install</code></pre>
              </div>
            </div>
            <div className="workflow-step">
              <div className="workflow-step-number">3</div>
              <div>
                <strong>Run your test</strong>
                <pre><code>stroppy run simple.ts</code></pre>
              </div>
            </div>
          </div>
          <div className="col col--4">
            <Heading as="h2">Or use Docker</Heading>
            <pre style={{padding: '1.5rem', borderRadius: '8px'}}>
              <code>{`# Pull and run directly
docker pull ghcr.io/stroppy-io/stroppy:latest

# Run built-in TPC-C benchmark
docker run --network host \\
  stroppy run /workloads/tpcc/tpcc.ts \\
  /workloads/tpcc/tpcc.sql

# With custom database URL
docker run --network host \\
  -e DRIVER_URL="postgres://u:p@host/db" \\
  stroppy run /workloads/simple/simple.ts`}</code>
            </pre>
          </div>
          <div className="col col--4">
            <Heading as="h2">Or ask Claude Code</Heading>
            <pre style={{padding: '1.5rem', borderRadius: '8px'}}>
              <code>{`# With the Stroppy MCP server configured,
# just ask in natural language:

> run a TPC-C benchmark with
  50 virtual users for 5 minutes
  and save an HTML report

# Claude Code calls stroppy_run()
# with the right parameters — no env
# vars, no flags, no permission prompts.`}</code>
            </pre>
            <p style={{fontSize: '0.9rem', opacity: 0.8}}>
              <Link to="/docs/mcp">Set up the MCP server &rarr;</Link>
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
      title="Database Stress Testing Powered by k6"
      description="Stroppy is a database stress testing CLI tool powered by k6. Write tests in TypeScript, generate data with flexible generators, get detailed HTML reports.">
      <HomepageHeader />
      <main>
        <section style={{padding: '4rem 0'}}>
          <div className="container">
            <div className="row">
              {features.map((props, idx) => (
                <Feature key={idx} {...props} />
              ))}
            </div>
          </div>
        </section>
        <QuickStart />
      </main>
    </Layout>
  );
}
