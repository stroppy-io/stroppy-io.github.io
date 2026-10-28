// The phone's status bar and browser chrome take the colour of the navbar
// (--st-panel) in whichever theme the page shows. The theme is the
// data-theme attribute, not the system's scheme, so a media query in a
// static <meta name="theme-color"> cannot follow it; the tag follows here.

if (typeof window !== 'undefined') {
  const html = document.documentElement;
  const meta = document.createElement('meta');
  meta.name = 'theme-color';
  document.head.append(meta);
  const sync = () => {
    meta.content = getComputedStyle(html).getPropertyValue('--st-panel').trim();
  };
  sync();
  new MutationObserver(sync).observe(html, {attributes: true, attributeFilter: ['data-theme']});
}
