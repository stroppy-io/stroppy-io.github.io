import {useEffect, useState, type ReactNode} from 'react';
import {CLOUD} from './menu';

// The right end of the navbar (navbar item type `custom-account`): "Sign in"
// for a guest, "Open console" for someone signed in to Stroppy Cloud. The
// console answers only whether there is a session (GET
// /api/v1/public/session, its cookie is on .stroppy.io); no answer within a
// few seconds, or an error, counts as signed out.

const SESSION_URL = `${CLOUD}/api/v1/public/session`;
const TIMEOUT = 3000;

function useSignedIn(): boolean {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    const ac = new AbortController();
    const t = window.setTimeout(() => ac.abort(), TIMEOUT);
    fetch(SESSION_URL, {credentials: 'include', signal: ac.signal, headers: {accept: 'application/json'}})
      .then((res) => (res.ok ? (res.json() as Promise<{signed_in?: boolean}>) : {signed_in: false}))
      .then((body) => setSignedIn(body.signed_in === true))
      .catch(() => undefined)
      .finally(() => window.clearTimeout(t));
    return () => {
      window.clearTimeout(t);
      ac.abort();
    };
  }, []);
  return signedIn;
}

export default function Account({mobile}: {mobile?: boolean}): ReactNode {
  const signedIn = useSignedIn();
  // The site and the console are one product: the way into the console is
  // to sign in (registering starts from there, or from the page's own calls
  // to action), not a second door to "another" site.
  const links = signedIn
    ? [{label: 'Open console', href: `${CLOUD}/`, cta: true}]
    : [{label: 'Sign in', href: `${CLOUD}/login`, cta: true}];
  if (mobile) {
    return (
      <>
        {links.map((l) => (
          <li key={l.label} className="menu__list-item">
            <a className="menu__link" href={l.href}>
              {l.label}
            </a>
          </li>
        ))}
      </>
    );
  }
  return (
    <>
      {links.map((l) => (
        <a key={l.label} className={l.cta ? 'navbar__item navbar-cta' : 'navbar__item navbar-signin'} href={l.href}>
          {l.label}
          {signedIn && (
            <span className="navbar-cta__arrow" aria-hidden="true">
              →
            </span>
          )}
        </a>
      ))}
    </>
  );
}
