import type {ReactNode} from 'react';
import DocsVersionDropdownNavbarItem from '@theme/NavbarItem/DocsVersionDropdownNavbarItem';

// The docs version switch, on top of the docs sidebar instead of in the
// navbar: it is only needed while reading the docs. On a phone it is the
// collapsible "Versions" list at the top of the docs menu.

export default function VersionSwitch({mobile}: {mobile?: boolean}): ReactNode {
  const item = (
    <DocsVersionDropdownNavbarItem
      mobile={mobile}
      items={[]}
      dropdownItemsBefore={[]}
      dropdownItemsAfter={[]}
      dropdownActiveClassDisabled
    />
  );
  if (mobile) return <ul className="menu__list sidebar-version--mobile">{item}</ul>;
  return (
    <div className="sidebar-version">
      <span className="sidebar-version__label">Version</span>
      {item}
    </div>
  );
}
