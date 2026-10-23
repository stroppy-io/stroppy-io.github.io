import type {ReactNode} from 'react';
import Content from '@theme-original/DocSidebar/Desktop/Content';
import type ContentType from '@theme/DocSidebar/Desktop/Content';
import type {WrapperProps} from '@docusaurus/types';
import DocsVersionDropdownNavbarItem from '@theme/NavbarItem/DocsVersionDropdownNavbarItem';

// The docs sidebar, with the version switch on top: it is only needed while
// reading the docs, so it is here instead of in the navbar.

type Props = WrapperProps<typeof ContentType>;

export default function ContentWrapper(props: Props): ReactNode {
  return (
    <>
      <div className="sidebar-version">
        <span className="sidebar-version__label">Version</span>
        <DocsVersionDropdownNavbarItem items={[]} dropdownItemsBefore={[]} dropdownItemsAfter={[]} dropdownActiveClassDisabled />
      </div>
      <Content {...props} />
    </>
  );
}
