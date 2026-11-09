import type {ReactNode} from 'react';
import Link from '@docusaurus/Link';
import useBaseUrl from '@docusaurus/useBaseUrl';
import {useColorMode, useThemeConfig} from '@docusaurus/theme-common';
import ColorModeToggle from '@theme/ColorModeToggle';
import ThemedImage from '@theme/ThemedImage';
import Icon from '@site/src/components/nav/icons';
import {CLOUD, DISCORD, GITHUB, MENU, sectionItems, type MenuSection} from '@site/src/components/nav/menu';

// The site's footer, in place of Docusaurus's: the mark and the one thing to
// do on the left, a map of the site on the right (the top menu's sections,
// src/components/nav/menu.ts, plus the docs and community links), and the
// copyright and the theme switch along the bottom. Styles: src/css/footer.css.

type FooterLink = {label: string; href: string};
type FooterColumn = {title: string; href?: string; groups: {title?: string; links: FooterLink[]}[]};

// A section's column: its parts when it has them, otherwise its first items,
// then the links along its panel's bottom.
const sectionColumn = (s: MenuSection): FooterColumn => ({
  title: s.label,
  href: s.href,
  groups: [
    {
      links: [
        ...('parts' in s ? s.parts : sectionItems(s).slice(0, 6)).map(({label, href}) => ({label, href})),
        ...(s.strip?.links ?? []),
      ],
    },
  ],
});

const COLUMNS: FooterColumn[] = [
  ...MENU.map(sectionColumn),
  {
    title: 'Community',
    groups: [
      {
        links: [
          {label: 'Blog', href: '/blog'},
          {label: 'Discord', href: DISCORD},
          {label: 'GitHub', href: GITHUB},
          {label: 'Releases', href: `${GITHUB}/releases`},
        ],
      },
      {
        title: 'Earlier work',
        links: [
          {label: 'Historical overview', href: '/docs/legacy/overview'},
          {label: 'FoundationDB report', href: '/docs/legacy/fdb-report'},
          {label: 'MongoDB report', href: '/docs/legacy/mongodb-report'},
        ],
      },
    ],
  },
];

function ThemeSwitch() {
  const {disableSwitch, respectPrefersColorScheme} = useThemeConfig().colorMode;
  const {colorModeChoice, setColorMode} = useColorMode();
  if (disableSwitch) return null;
  return (
    <ColorModeToggle
      className="site-footer__theme"
      value={colorModeChoice}
      onChange={setColorMode}
      respectPrefersColorScheme={respectPrefersColorScheme}
    />
  );
}

export default function Footer(): ReactNode {
  const {footer} = useThemeConfig();
  const light = useBaseUrl('/kit/mark-light.svg');
  const dark = useBaseUrl('/kit/mark-dark.svg');
  return (
    <footer className="footer site-footer">
      <div className="site-footer__inner">
        <div className="site-footer__brand">
          <Link to="/" className="site-footer__logo" aria-label="Stroppy home">
            <ThemedImage sources={{light, dark}} alt="" />
            <span>Stroppy</span>
          </Link>
          <p>Pick a database on evidence: the same open tests for every engine, every result public.</p>
          <a className="site-footer__cta" href={`${CLOUD}/login`}>
            Sign in
          </a>
          <div className="site-footer__social">
            <a href={GITHUB} aria-label="GitHub">
              <Icon name="github" className="site-footer__icon" />
            </a>
            <a href={DISCORD} aria-label="Discord">
              <Icon name="chat" className="site-footer__icon" />
            </a>
          </div>
        </div>

        <nav className="site-footer__map" aria-label="Site map">
          {COLUMNS.map((c) => (
            <div key={c.title} className="site-footer__col">
              <h2 className="site-footer__title">{c.href ? <Link to={c.href}>{c.title}</Link> : c.title}</h2>
              {c.groups.map((g, i) => (
                <div key={g.title ?? i} className="site-footer__group">
                  {g.title && <h3 className="site-footer__subtitle">{g.title}</h3>}
                  <ul>
                    {g.links.map((l) => (
                      <li key={l.label}>
                        <Link to={l.href}>{l.label}</Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ))}
        </nav>
      </div>

      <div className="site-footer__bottom">
        <span>{footer?.copyright}</span>
        <ThemeSwitch />
      </div>
    </footer>
  );
}
