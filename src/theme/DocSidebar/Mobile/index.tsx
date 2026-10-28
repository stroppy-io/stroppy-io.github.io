import {memo, type ReactNode} from 'react';
import clsx from 'clsx';
import {NavbarSecondaryMenuFiller, ThemeClassNames} from '@docusaurus/theme-common';
import {useNavbarMobileSidebar} from '@docusaurus/theme-common/internal';
import DocSidebarItems from '@theme/DocSidebarItems';
import type {Props} from '@theme/DocSidebar/Mobile';
import VersionSwitch from '@site/src/components/nav/VersionSwitch';

// Docusaurus's mobile docs menu with the version switch on top, as on the
// desktop sidebar (DocSidebar/Desktop/Content). The menu is rendered by the
// navbar's secondary panel, so the switch has to be inside it, not around it.

function SecondaryMenu({sidebar, path}: Props): ReactNode {
  const mobileSidebar = useNavbarMobileSidebar();
  return (
    <>
      <VersionSwitch mobile />
      <ul className={clsx(ThemeClassNames.docs.docSidebarMenu, 'menu__list')}>
        <DocSidebarItems
          items={sidebar}
          activePath={path}
          onItemClick={(item) => {
            // Only a category with a page closes the menu, as upstream.
            if (item.type === 'link' || (item.type === 'category' && item.href)) mobileSidebar.toggle();
          }}
          level={1}
        />
      </ul>
    </>
  );
}

function DocSidebarMobile(props: Props): ReactNode {
  return <NavbarSecondaryMenuFiller component={SecondaryMenu} props={props} />;
}

export default memo(DocSidebarMobile);
