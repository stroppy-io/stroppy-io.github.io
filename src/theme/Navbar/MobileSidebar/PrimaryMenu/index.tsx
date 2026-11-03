import type {ReactNode} from 'react';
import PrimaryMenu from '@theme-original/Navbar/MobileSidebar/PrimaryMenu';
import SearchBar from '@theme/SearchBar';
import Account from '@site/src/components/nav/Account';
import Icon from '@site/src/components/nav/icons';
import {DISCORD} from '@site/src/components/nav/menu';

// The drawer's main menu: the search on top, the menu's sections
// (src/components/nav/MegaMenu.tsx), and the account and community links held
// at the bottom. The drawer covers the bar, so it has its own search.

export default function PrimaryMenuWrapper(): ReactNode {
  return (
    <div className="drawer">
      <div className="drawer__search">
        <SearchBar />
      </div>
      <PrimaryMenu />
      <div className="drawer__foot">
        <Account />
        <a className="navbar__item navbar-github" href={DISCORD} aria-label="Stroppy on Discord">
          <Icon name="chat" className="navbar-github__icon" />
        </a>
      </div>
    </div>
  );
}
