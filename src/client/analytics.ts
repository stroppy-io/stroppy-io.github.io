// Analytics, only with consent. A standard consent banner (vanilla-cookieconsent)
// asks once; Google Tag Manager, and through it Google Analytics, loads only
// after the visitor allows analytics, and only in a production build. Taking
// consent back clears Google's cookies and reloads the page, which unloads
// the tags. "Cookie settings" in the footer reopens the choice
// (src/theme/Footer). The container id is in docusaurus.config.ts
// (customFields.gtm). Styles: src/css/consent.css.

import ExecutionEnvironment from '@docusaurus/ExecutionEnvironment';
import siteConfig from '@generated/docusaurus.config';
import * as CookieConsent from 'vanilla-cookieconsent';
import 'vanilla-cookieconsent/dist/cookieconsent.css';
import '../css/consent.css';

declare global {
  interface Window {
    dataLayer?: Record<string, string | number>[];
  }
}

const ANALYTICS = 'analytics';
const container = siteConfig.customFields?.gtm;

let loaded = false;

/** Google Tag Manager's own loader, as its install snippet does it. */
function loadTagManager(): void {
  if (loaded || typeof container !== 'string' || process.env.NODE_ENV !== 'production') return;
  loaded = true;
  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push({'gtm.start': Date.now(), event: 'gtm.js'});
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(container)}`;
  document.head.appendChild(script);
}

/**
 * The banner shows through classes on <html> (show--consent, show--preferences,
 * cc--anim), and Docusaurus rewrites <html>'s class on every page it renders,
 * dropping them. The classes the library currently wants are kept here, from
 * its own show and hide events, and put back whenever they go missing.
 */
function keepBannerClasses(): Set<string> {
  const html = document.documentElement;
  const wanted = new Set<string>(['cc--anim']);
  new MutationObserver(() => {
    for (const c of wanted) if (!html.classList.contains(c)) html.classList.add(c);
  }).observe(html, {attributes: true, attributeFilter: ['class']});
  return wanted;
}

const MODAL_CLASS: Record<string, string> = {consentModal: 'show--consent', preferencesModal: 'show--preferences'};

if (ExecutionEnvironment.canUseDOM) {
  const wanted = keepBannerClasses();
  CookieConsent.run({
    onModalShow: ({modalName}) => {
      const c = MODAL_CLASS[modalName];
      if (c) wanted.add(c);
    },
    onModalHide: ({modalName}) => {
      const c = MODAL_CLASS[modalName];
      if (c) wanted.delete(c);
    },
    guiOptions: {
      consentModal: {layout: 'box', position: 'bottom right'},
      preferencesModal: {layout: 'box'},
    },
    categories: {
      necessary: {enabled: true, readOnly: true},
      [ANALYTICS]: {autoClear: {cookies: [{name: /^_ga/}, {name: '_gid'}]}},
    },
    onConsent: () => {
      if (CookieConsent.acceptedCategory(ANALYTICS)) loadTagManager();
    },
    onChange: ({changedCategories}) => {
      if (!changedCategories.includes(ANALYTICS)) return;
      if (CookieConsent.acceptedCategory(ANALYTICS)) loadTagManager();
      else if (loaded) window.location.reload();
    },
    language: {
      default: 'en',
      translations: {
        en: {
          consentModal: {
            title: 'Cookies',
            description:
              'We would like to count visits with Google Analytics, to learn which pages readers use. Nothing loads until you allow it.',
            acceptAllBtn: 'Allow analytics',
            acceptNecessaryBtn: 'Reject',
            showPreferencesBtn: 'Choose',
          },
          preferencesModal: {
            title: 'Cookie settings',
            acceptAllBtn: 'Allow all',
            acceptNecessaryBtn: 'Reject all',
            savePreferencesBtn: 'Save',
            closeIconLabel: 'Close',
            sections: [
              {
                title: 'Strictly necessary',
                description: 'The theme you pick and this choice. Always on.',
                linkedCategory: 'necessary',
              },
              {
                title: 'Analytics',
                description:
                  'Google Analytics, loaded through Google Tag Manager, counts visits and pages. Off until you turn it on; turning it off removes its cookies.',
                linkedCategory: ANALYTICS,
              },
            ],
          },
        },
      },
    },
  }).catch(() => undefined);
}
