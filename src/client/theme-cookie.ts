// One theme for stroppy.io and Stroppy Cloud: both keep the visitor's choice
// in the `stroppy-theme` cookie on .stroppy.io (dark | light; no cookie means
// the system's). A script in <head> (docusaurus.config.ts) copies the cookie
// into Docusaurus's own storage before the page paints; this module writes
// the cookie back when the visitor picks a theme here.

const COOKIE = 'stroppy-theme';
const YEAR = 60 * 60 * 24 * 365;

function domain(): string {
  const host = window.location.hostname;
  return host === 'stroppy.io' || host.endsWith('.stroppy.io') ? '; domain=.stroppy.io' : '';
}

function write(choice: string | null): void {
  if (choice === 'light' || choice === 'dark') {
    document.cookie = `${COOKIE}=${choice}; path=/; max-age=${YEAR}; samesite=lax${domain()}`;
  } else if (choice === 'system') {
    document.cookie = `${COOKIE}=; path=/; max-age=0; samesite=lax${domain()}`;
  }
}

if (typeof window !== 'undefined') {
  const html = document.documentElement;
  new MutationObserver(() => write(html.getAttribute('data-theme-choice'))).observe(html, {
    attributes: true,
    attributeFilter: ['data-theme-choice'],
  });
}
