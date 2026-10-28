import type {ReactNode} from 'react';
import Content from '@theme-original/DocSidebar/Desktop/Content';
import type ContentType from '@theme/DocSidebar/Desktop/Content';
import type {WrapperProps} from '@docusaurus/types';
import VersionSwitch from '@site/src/components/nav/VersionSwitch';

// The docs sidebar, with the version switch on top.

type Props = WrapperProps<typeof ContentType>;

export default function ContentWrapper(props: Props): ReactNode {
  return (
    <>
      <VersionSwitch />
      <Content {...props} />
    </>
  );
}
