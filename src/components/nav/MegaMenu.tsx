import {useEffect, useId, useSyncExternalStore, type CSSProperties, type ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import {useLocation} from '@docusaurus/router';
import useBaseUrl from '@docusaurus/useBaseUrl';
import {usePluginData} from '@docusaurus/useGlobalData';
import ThemedImage from '@theme/ThemedImage';
import {engine, machine, type Rating} from '@site/src/components/landing/rating';
import Icon from './icons';
import {MENU, type MenuPromo, type MenuSection} from './menu';

// A navbar item that opens a panel under the navbar on hover or focus and,
// clicked, goes to its section's page (navbar item type `custom-mega`,
// src/theme/NavbarItem/ComponentTypes.tsx). The items
// share one open section, so moving along the bar swaps the panel in place
// instead of closing and reopening it; while one is open the page dims. In
// the mobile drawer a section is a collapsible list.

const CLOSE_DELAY = 150;

// Which section is open, shared by every mega item of the navbar.
let open: string | null = null;
let timer: number | undefined;
const listeners = new Set<() => void>();

function setOpen(id: string | null) {
  window.clearTimeout(timer);
  if (open === id) return;
  open = id;
  document.documentElement.classList.toggle('mega-active', id !== null);
  listeners.forEach((l) => l());
}

function closeLater() {
  window.clearTimeout(timer);
  timer = window.setTimeout(() => setOpen(null), CLOSE_DELAY);
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

const useOpen = () => useSyncExternalStore(subscribe, () => open, () => null);

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

/** The top three of the leaderboard, from the build's copy of the rating. */
function TopThree() {
  const {rating} = usePluginData('cloud-rating') as {rating: Rating | null};
  const rows = rating?.data.slice(0, 3) ?? [];
  if (rows.length === 0) return null;
  const top = rows[0].value;
  return (
    <ol className="mega__board">
      {rows.map((r) => (
        <li key={r.rank} style={{'--w': String(r.value / top)} as CSSProperties}>
          <span className="mega__board-db">
            {engine(r.db_kind)} {r.db_version}
            <small>{machine(r)}</small>
          </span>
          <span className="mega__board-value">
            {fmt(r.value)} <small>{r.unit}</small>
          </span>
        </li>
      ))}
    </ol>
  );
}

function Promo({p}: {p: MenuPromo}) {
  const light = useBaseUrl('/kit/mark-light.svg');
  const dark = useBaseUrl('/kit/mark-dark.svg');
  return (
    <Link className="mega__promo" to={p.href}>
      {p.kind === 'board' ? (
        <TopThree />
      ) : (
        <span className="mega__art" aria-hidden="true">
          <ThemedImage sources={{light, dark}} alt="" />
        </span>
      )}
      <span className="mega__promo-title">{p.title}</span>
      <span className="mega__promo-body">{p.body}</span>
      <span className="mega__promo-cta">{p.cta} →</span>
    </Link>
  );
}

function Panel({s, id, shown}: {s: MenuSection; id: string; shown: boolean}) {
  return (
    <div
      className={clsx('mega__panel', shown && 'mega__panel--shown')}
      id={id}
      onMouseEnter={() => setOpen(s.id)}
      onMouseLeave={closeLater}>
      <div className="container mega__inner">
        {s.columns.map((c) => (
          <div key={c.title} className="mega__col">
            <div className="mega__title">{c.title}</div>
            <ul className="mega__list">
              {c.items.map((i) => (
                <li key={i.label}>
                  <Link className="mega__link" to={i.href} tabIndex={shown ? undefined : -1}>
                    <Icon name={i.icon} />
                    <span className="mega__text">
                      <span className="mega__label">{i.label}</span>
                      <span className="mega__desc">{i.desc}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <Promo p={s.promo} />
      </div>
    </div>
  );
}

function Desktop({s}: {s: MenuSection}) {
  const id = useId();
  const current = useOpen();
  const shown = current === s.id;
  const {pathname, hash} = useLocation();

  useEffect(() => setOpen(null), [pathname, hash]);
  useEffect(() => {
    if (!shown) return undefined;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shown]);

  return (
    // Hover and focus are on the item, not the link: Docusaurus's Link takes
    // the link's own onMouseEnter for preloading the page.
    <div
      className={clsx('navbar__item mega', shown && 'mega--open')}
      onMouseEnter={() => setOpen(s.id)}
      onMouseLeave={closeLater}
      onFocus={() => setOpen(s.id)}>
      <Link to={s.href} className="mega__trigger" aria-expanded={shown} aria-controls={id}>
        {s.label}
      </Link>
      <Panel s={s} id={id} shown={shown} />
    </div>
  );
}

function Mobile({s}: {s: MenuSection}) {
  const current = useOpen();
  const shown = current === s.id;
  return (
    <li className={clsx('menu__list-item', !shown && 'menu__list-item--collapsed')}>
      <div className="menu__list-item-collapsible">
        <Link className="menu__link" to={s.href}>
          {s.label}
        </Link>
        <button
          type="button"
          className="clean-btn menu__caret"
          aria-label={`${shown ? 'Collapse' : 'Expand'} ${s.label}`}
          aria-expanded={shown}
          onClick={() => setOpen(shown ? null : s.id)}
        />
      </div>
      {shown && (
        <ul className="menu__list">
          {s.columns.flatMap((c) => c.items).map((i) => (
            <li key={i.label} className="menu__list-item">
              <Link className="menu__link" to={i.href}>
                {i.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export default function MegaMenu({section, mobile}: {section: string; mobile?: boolean}): ReactNode {
  const s = MENU.find((m) => m.id === section);
  if (!s) throw new Error(`MegaMenu: no menu section "${section}" in src/components/nav/menu.ts`);
  return mobile ? <Mobile s={s} /> : <Desktop s={s} />;
}
