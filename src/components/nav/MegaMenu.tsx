import {useEffect, useId, useRef, useState, useSyncExternalStore, type MouseEvent, type ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import {useLocation} from '@docusaurus/router';
import useBaseUrl from '@docusaurus/useBaseUrl';
import {usePluginData} from '@docusaurus/useGlobalData';
import {useNavbarMobileSidebar} from '@docusaurus/theme-common/internal';
import ThemedImage from '@theme/ThemedImage';
import {engine} from '@site/src/components/landing/rating';
import type {CloudRating} from '@site/plugins/cloud-rating';
import {MENU, type MenuColumn, type MenuItem, type MenuPromo, type MenuSection} from './menu';

// A navbar item that opens a panel under the navbar (navbar item type
// `custom-mega`, src/theme/NavbarItem/ComponentTypes.tsx). The items share one
// open section, so moving along the bar swaps the panel in place; while one
// is open the page dims. In the mobile drawer a section is a collapsible list.
//
// Hover intent: a section or a part takes over only when the pointer rests on
// it, so crossing another name on the way down to the open panel does not
// switch it. Opening from closed waits less than switching away from an open
// panel. A click is a hover without the wait: it opens the panel and goes
// nowhere, which is also what a first tap does on a touch screen.

const OPEN_REST = 100;
const SWITCH_REST = 200;
const PART_REST = 100;
const CLOSE_DELAY = 160;

type Open = {id: string; part: number} | null;

let open: Open = null;
let closeTimer: number | undefined;
let restTimer: number | undefined;
const listeners = new Set<() => void>();

function setOpen(next: Open) {
  window.clearTimeout(closeTimer);
  if (open?.id === next?.id && open?.part === next?.part) return;
  open = next;
  // An attribute of its own, not a class: Docusaurus rewrites <html>'s class
  // when a page renders, which would drop the page's dimming.
  document.documentElement.toggleAttribute('data-mega-open', next !== null);
  listeners.forEach((l) => l());
}

const openSection = (id: string) => open?.id === id || setOpen({id, part: 0});
const cancelClose = () => window.clearTimeout(closeTimer);
const stopRest = () => window.clearTimeout(restTimer);

function closeLater() {
  stopRest();
  cancelClose();
  closeTimer = window.setTimeout(() => setOpen(null), CLOSE_DELAY);
}

/** Runs `fn` once the pointer has rested `wait` ms; every move restarts the wait. */
function rest(fn: () => void, wait: number) {
  stopRest();
  restTimer = window.setTimeout(fn, wait);
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

const useOpen = () =>
  useSyncExternalStore(
    subscribe,
    () => open,
    () => null,
  );

/** A plain left click, not one that opens the link in a new tab or window. */
const plainClick = (e: MouseEvent) => e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;

/** The path a section lives under, for marking it current: none for the landing. */
function sectionPath(s: MenuSection): string | null {
  const path = s.href.split('#')[0];
  if (!path.startsWith('/') || path === '/') return null;
  return `/${path.split('/')[1]}`;
}

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

/** The top three of the leaderboard, from the build's copy of the rating. */
function TopThree() {
  const {tx} = usePluginData('cloud-rating') as CloudRating;
  const rows = tx?.data.slice(0, 3) ?? [];
  if (rows.length === 0) return null;
  return (
    <ol className="mega__board">
      {rows.map((r) => (
        <li key={r.rank}>
          <span className="mega__board-rank">{r.rank}</span>
          <span className="mega__board-db">
            {engine(r.db_kind)} {r.db_version}
          </span>
          <span className="mega__board-value">
            {fmt(r.value)} <small>{r.unit}</small>
          </span>
        </li>
      ))}
    </ol>
  );
}

function Promo({p, tabIndex}: {p: MenuPromo; tabIndex?: number}) {
  const light = useBaseUrl('/kit/mark-light.svg');
  const dark = useBaseUrl('/kit/mark-dark.svg');
  return (
    <Link className="mega__promo" to={p.href} tabIndex={tabIndex}>
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

function Item({i, tabIndex}: {i: MenuItem; tabIndex?: number}) {
  return (
    <Link className="mega__link" to={i.href} tabIndex={tabIndex}>
      <span className="mega__label">{i.label}</span>
      <span className="mega__desc">{i.desc}</span>
    </Link>
  );
}

function Columns({columns, tabIndex}: {columns: MenuColumn[]; tabIndex?: number}) {
  return (
    <div className="mega__cols">
      {columns.map((c) => (
        <div key={c.title} className="mega__col">
          <div className="mega__title">{c.title}</div>
          {c.items.map((i) => (
            <Item key={i.label} i={i} tabIndex={tabIndex} />
          ))}
        </div>
      ))}
    </div>
  );
}

function Panel({s, id, shown, part}: {s: MenuSection; id: string; shown: boolean; part: number}) {
  const tabIndex = shown ? undefined : -1;
  const parts = 'parts' in s ? s.parts : null;
  return (
    // A link followed from the panel closes it, also when it only changes the
    // query of the page already open, which no route change would close.
    <div
      className={clsx('mega__panel', shown && 'mega__panel--shown')}
      id={id}
      onMouseEnter={cancelClose}
      onMouseLeave={closeLater}
      // The section's own hover intent is for its name in the bar. A move over
      // the open panel must not reach it: it would restart the one rest timer
      // for the section and cancel the part the pointer is resting on.
      onMouseMove={(e) => e.stopPropagation()}
      onClick={(e) => {
        if (!e.defaultPrevented && e.target instanceof Element && e.target.closest('a')) setOpen(null);
      }}>
      <div className={clsx('container mega__inner', parts && 'mega__inner--rail')}>
        {parts && (
          <div className="mega__rail">
            {parts.map((p, n) => {
              const show = () => setOpen({id: s.id, part: n});
              return (
                // A part only shows its columns: hovering, focusing or
                // clicking it never leaves the page; its items are the links.
                <button
                  key={p.label}
                  type="button"
                  tabIndex={tabIndex}
                  className={clsx('mega__part', n === part && 'mega__part--on')}
                  aria-pressed={n === part}
                  onMouseEnter={() => rest(show, PART_REST)}
                  onMouseMove={() => rest(show, PART_REST)}
                  onMouseLeave={stopRest}
                  onFocus={show}
                  onClick={show}>
                  <span className="mega__label">{p.label}</span>
                  <span className="mega__desc">{p.desc}</span>
                </button>
              );
            })}
          </div>
        )}
        <Columns columns={parts ? parts[part].columns : 'columns' in s ? s.columns : []} tabIndex={tabIndex} />
        <Promo p={s.promo} tabIndex={tabIndex} />
        {s.strip && (
          <div className="mega__strip">
            <span className="mega__title">{s.strip.title}</span>
            {s.strip.links.map((l) => (
              <Link key={l.label} to={l.href} tabIndex={tabIndex}>
                {l.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Desktop({s}: {s: MenuSection}) {
  const id = useId();
  const current = useOpen();
  const shown = current?.id === s.id;
  const {pathname, search, hash} = useLocation();
  const path = sectionPath(s);
  const here = path !== null && (pathname === path || pathname.startsWith(`${path}/`));

  const item = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLAnchorElement>(null);
  // Set while Escape hands focus back to the trigger, so that focus does not
  // reopen the panel it just closed.
  const returning = useRef(false);

  useEffect(() => setOpen(null), [pathname, search, hash]);
  useEffect(() => {
    if (!shown) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (item.current?.contains(document.activeElement)) {
        returning.current = true;
        trigger.current?.focus();
        returning.current = false;
      }
      setOpen(null);
    };
    // A press outside the bar and its panel closes it, so a touch screen,
    // which has no pointer to leave, can close it too.
    const onDown = (e: PointerEvent) => {
      if (e.target instanceof Node && !item.current?.closest('.navbar')?.contains(e.target)) setOpen(null);
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [shown]);

  const arm = () => {
    cancelClose();
    rest(() => openSection(s.id), open === null ? OPEN_REST : SWITCH_REST);
  };

  return (
    // Hover and focus are on the item, not the link: Docusaurus's Link takes
    // the link's own onMouseEnter for preloading the page.
    <div
      ref={item}
      className={clsx('navbar__item mega', shown && 'mega--open', here && 'mega--here')}
      onMouseEnter={arm}
      onMouseMove={arm}
      onMouseLeave={closeLater}
      onFocus={() => returning.current || openSection(s.id)}>
      <Link
        ref={trigger}
        to={s.href}
        className="mega__trigger"
        aria-expanded={shown}
        aria-controls={id}
        onMouseDown={(e) => plainClick(e) && openSection(s.id)}
        onClick={(e) => {
          if (!plainClick(e)) return;
          e.preventDefault();
          stopRest();
          openSection(s.id);
        }}>
        {s.label}
      </Link>
      <Panel s={s} id={id} shown={shown} part={shown ? (current?.part ?? 0) : 0} />
    </div>
  );
}

// With room for several columns the drawer opens every section, like a site map.
const WIDE_DRAWER = '(min-width: 700px)';

function MobileItem({i, onPick}: {i: MenuItem; onPick: () => void}) {
  return (
    <Link className="mmenu__link" to={i.href} onClick={onPick}>
      <span className="mega__label">{i.label}</span>
      <span className="mega__desc">{i.desc}</span>
    </Link>
  );
}

function Mobile({s}: {s: MenuSection}) {
  const {pathname} = useLocation();
  const sidebar = useNavbarMobileSidebar();
  const path = sectionPath(s);
  const [expanded, setExpanded] = useState(() => window.matchMedia(WIDE_DRAWER).matches || (path !== null && pathname.startsWith(path)));
  const onPick = () => sidebar.shown && sidebar.toggle();
  return (
    <li className="mmenu">
      <details open={expanded} onToggle={(e) => setExpanded(e.currentTarget.open)}>
        <summary className="mmenu__head">{s.label}</summary>
        {'parts' in s
          ? s.parts.map((p) => (
              <details key={p.label} className="mmenu__part">
                <summary className="mmenu__head mmenu__head--part">
                  {p.label}
                  <span className="mega__desc">{p.desc}</span>
                </summary>
                {p.columns
                  .flatMap((c) => c.items)
                  .map((i) => (
                    <MobileItem key={i.label} i={i} onPick={onPick} />
                  ))}
              </details>
            ))
          : s.columns.flatMap((c) => c.items).map((i) => <MobileItem key={i.label} i={i} onPick={onPick} />)}
        {s.strip?.links.map((l) => (
          <Link key={l.label} className="mmenu__link" to={l.href} onClick={onPick}>
            <span className="mega__label">{l.label}</span>
          </Link>
        ))}
      </details>
    </li>
  );
}

export default function MegaMenu({section, mobile}: {section: string; mobile?: boolean}): ReactNode {
  const s = MENU.find((m) => m.id === section);
  if (!s) throw new Error(`MegaMenu: no menu section "${section}" in src/components/nav/menu.ts`);
  return mobile ? <Mobile s={s} /> : <Desktop s={s} />;
}
