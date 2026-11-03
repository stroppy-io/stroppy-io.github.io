import {useEffect, type ReactNode} from 'react';
import clsx from 'clsx';
import Layout from '@theme/Layout';
import {useLocation} from '@docusaurus/router';
import Link from '@docusaurus/Link';
import CodeBlock from '@theme/CodeBlock';
import useBrokenLinks from '@docusaurus/useBrokenLinks';
import '../../css/tools.css';

// A page of sections under a hero: a tool's page (/tools/<id>) and /vendors.
// Each section is a row: what it does on the left, a real example on the right
// (a command, a config, code or a short list), and published data (a map, a
// chart, a board) under both at full width. The menu links to a section by id;
// the section it lands on is marked.

export type PageLink = {label: string; href: string};

export type PageSection = {
  id: string;
  title: string;
  /** One or two sentences: what this part does for the reader. */
  lead: ReactNode;
  points?: ReactNode[];
  links?: PageLink[];
  /** The example beside the text: a command, a config or code, as the tool's own docs give it. */
  code?: {language: string; text: string; title?: string};
  /** An example that is not code: a short list, a set of names. */
  example?: ReactNode;
  /** Published data under the row, at full width. */
  media?: ReactNode;
};

type Props = {
  /** The accent: a tool's id, or the page's own (tools.css). */
  accent: string;
  title: string;
  /** What kind of page, above the title: "Load generator · open source". */
  eyebrow: string;
  tagline: string;
  intro: ReactNode;
  actions: PageLink[];
  /** Short facts under the actions: "One binary", "Apache-2.0". */
  facts: string[];
  sections: PageSection[];
  /** What follows the sections. */
  children?: ReactNode;
};

const external = (href: string) => /^https?:/.test(href);

function Go({link, primary}: {link: PageLink; primary?: boolean}) {
  return (
    <Link className={primary ? 'tl-btn tl-btn--primary' : 'tl-btn'} to={link.href}>
      {link.label}
      {external(link.href) ? ' ↗' : ''}
    </Link>
  );
}

/**
 * The section the URL's hash names. The router changes the hash with
 * pushState, which CSS's :target does not follow, so the page follows it here;
 * on a first load the sections may render after the browser's jump to the
 * fragment, so the section is brought into view again.
 */
function useLinkedSection(ids: string[]): string | null {
  const {hash} = useLocation();
  const id = decodeURIComponent(hash.slice(1));
  const linked = ids.includes(id) ? id : null;
  useEffect(() => {
    if (linked) document.getElementById(linked)?.scrollIntoView({block: 'start'});
  }, [linked]);
  return linked;
}

function Section({s, linked}: {s: PageSection; linked: boolean}) {
  const aside = s.code ? (
    <CodeBlock language={s.code.language} title={s.code.title}>
      {s.code.text}
    </CodeBlock>
  ) : (
    s.example
  );
  return (
    <section id={s.id} className={clsx('tl-section', linked && 'tl-section--linked')}>
      <div className={clsx('tl-row', !aside && 'tl-row--text')}>
        <div className="tl-text">
          <h2>
            <a className="tl-section__anchor" href={`#${s.id}`}>
              {s.title}
            </a>
          </h2>
          <div className="tl-lead">{s.lead}</div>
          {s.points && (
            <ul className="tl-points">
              {/* Fixed content in source order, so the index is a stable key. */}
              {s.points.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          )}
          {s.links && (
            <p className="tl-links">
              {s.links.map((l) => (
                <Link key={l.href} to={l.href}>
                  {l.label} {external(l.href) ? '↗' : '→'}
                </Link>
              ))}
            </p>
          )}
        </div>
        {aside && <div className="tl-example">{aside}</div>}
      </div>
      {s.media && <div className="tl-media">{s.media}</div>}
    </section>
  );
}

export default function SectionPage({accent, title, eyebrow, tagline, intro, actions, facts, sections, children}: Props) {
  const anchors = useBrokenLinks();
  for (const s of sections) anchors.collectAnchor(s.id);
  const linked = useLinkedSection(sections.map((s) => s.id));

  return (
    <Layout title={title} description={tagline}>
      <main className={`tl tl--${accent}`}>
        <header className="tl-hero">
          <p className="tl-eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="tl-tagline">{tagline}</p>
          <div className="tl-intro">{intro}</div>
          <div className="tl-actions">
            {actions.map((a, i) => (
              <Go key={a.href} link={a} primary={i === 0} />
            ))}
          </div>
          <ul className="tl-facts">
            {facts.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </header>

        {sections.map((s) => (
          <Section key={s.id} s={s} linked={s.id === linked} />
        ))}

        {children}
      </main>
    </Layout>
  );
}
