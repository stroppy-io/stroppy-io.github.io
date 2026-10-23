import {useEffect, useState, type ReactNode, type RefObject} from 'react';
import clsx from 'clsx';
import {HtmlClassNameProvider} from '@docusaurus/theme-common';

// The landing scrolls a page at a time: CSS scroll snapping (landing.css,
// under PAGED_QUERY, while every page fits the screen) stops every gesture at
// the next page, and the page keeps native scrolling, keyboard and anchors. This adds the map on the right edge
// and the cue to the next page.

export const PAGED_QUERY = '(min-width: 997px) and (min-height: 700px)';

export type Page = {id: string; label: string};

function useMedia(query: string): boolean {
  const [match, setMatch] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    setMatch(mq.matches);
    const on = () => setMatch(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return match;
}

/**
 * Whether every page fits the screen under the navbar. A page taller than
 * that could not be read to its end with snapping on (each gesture would jump
 * to the next page), so then the landing scrolls freely.
 */
function useAllFit(pages: readonly Page[], root: RefObject<HTMLElement | null>, enabled: boolean): boolean {
  const [fit, setFit] = useState(false);
  useEffect(() => {
    const el = root.current;
    if (!el || !enabled) return undefined;
    const nodes = pages.map((p) => el.querySelector<HTMLElement>(`#${p.id}`)).filter(Boolean) as HTMLElement[];
    const check = () => {
      const navbar = document.querySelector<HTMLElement>('.navbar')?.offsetHeight ?? 0;
      const room = window.innerHeight - navbar + 1;
      setFit(nodes.every((n) => n.offsetHeight <= room));
    };
    const ro = new ResizeObserver(check);
    nodes.forEach((n) => ro.observe(n));
    window.addEventListener('resize', check);
    check();
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', check);
    };
  }, [pages, root, enabled]);
  return enabled && fit;
}

/** The page in view, and whether the landing pages (`<PagerSnap on>`). */
export function usePager(pages: readonly Page[], root: RefObject<HTMLElement | null>) {
  const paged = useAllFit(pages, root, useMedia(PAGED_QUERY));
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const el = root.current;
    if (!el) return undefined;
    const nodes = pages.map((p) => el.querySelector<HTMLElement>(`#${p.id}`)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setCurrent(nodes.indexOf(e.target as HTMLElement));
        }
      },
      {rootMargin: '-45% 0px -45% 0px'},
    );
    nodes.forEach((n) => io.observe(n));
    // The last page is short and ends with the footer: at the bottom, it is the one in view.
    const onScroll = () => {
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) setCurrent(nodes.length - 1);
    };
    window.addEventListener('scroll', onScroll, {passive: true});
    return () => {
      io.disconnect();
      window.removeEventListener('scroll', onScroll);
    };
  }, [pages, root]);

  // The last page ends with the footer: it is sized to leave room for it, so
  // page and footer arrive as one stop when they fit the screen together.
  useEffect(() => {
    const footer = document.querySelector<HTMLElement>('.footer');
    if (!footer) return undefined;
    const html = document.documentElement;
    const ro = new ResizeObserver(() => html.style.setProperty('--landing-footer-h', `${footer.offsetHeight}px`));
    ro.observe(footer);
    return () => {
      ro.disconnect();
      html.style.removeProperty('--landing-footer-h');
    };
  }, []);

  const go = (i: number) => {
    const target = document.getElementById(pages[Math.max(0, Math.min(pages.length - 1, i))].id);
    target?.scrollIntoView({behavior: 'smooth', block: 'start'});
  };

  return {paged, current, go};
}

export function PagerNav({pages, current, go}: {pages: readonly Page[]; current: number; go: (i: number) => void}) {
  return (
    <nav className="pager" aria-label="Page sections">
      {pages.map((p, i) => (
        <button
          key={p.id}
          type="button"
          className="pager__item"
          aria-current={i === current ? 'step' : undefined}
          aria-label={p.label}
          onClick={() => go(i)}>
          <span className="pager__label">{p.label}</span>
          <i className={clsx('pager__mark', i === current && 'pager__mark--active')} />
        </button>
      ))}
    </nav>
  );
}

export function PagerCue({pages, current, go}: {pages: readonly Page[]; current: number; go: (i: number) => void}) {
  const next = pages[current + 1];
  if (!next) return null;
  return (
    <button type="button" className="pager-cue" onClick={() => go(current + 1)}>
      {next.label}
      <svg className="pager-cue__icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

/** Turns snapping on for the document while `on` (merged with the theme's classes). */
export function PagerSnap({on, children}: {on: boolean; children: ReactNode}) {
  return <HtmlClassNameProvider className={on ? 'landing-paged' : undefined}>{children}</HtmlClassNameProvider>;
}
