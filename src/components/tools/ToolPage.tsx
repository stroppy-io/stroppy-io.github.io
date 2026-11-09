import type {ComponentProps} from 'react';
import Link from '@docusaurus/Link';
import SectionPage from './SectionPage';
import {TOOLS, type ToolId} from './tools';

// The page of one tool (/tools/<id>): what it is and for whom, its actions,
// its sections (SectionPage), then the other tools.

type Props = Omit<ComponentProps<typeof SectionPage>, 'accent' | 'title' | 'eyebrow' | 'facts' | 'children'> & {tool: ToolId};

export default function ToolPage({tool, ...page}: Props) {
  const me = TOOLS.find((t) => t.id === tool);
  if (!me) throw new Error(`ToolPage: no tool "${tool}" in src/components/tools/tools.ts`);

  return (
    <SectionPage accent={tool} title={me.name} eyebrow={me.kind} facts={me.facts} {...page}>
      <section className="tl-family" aria-labelledby="tl-family">
        <h2 id="tl-family">The other tools</h2>
        <div className="tl-family__grid">
          {TOOLS.filter((t) => t.id !== tool).map((t) => (
            <Link key={t.id} to={t.href} className={`tl-card tl--${t.id}`}>
              <span className="tl-card__name">{t.name}</span>
              <span className="tl-card__what">{t.what}</span>
            </Link>
          ))}
        </div>
      </section>
    </SectionPage>
  );
}
