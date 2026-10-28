import {useEffect, type ReactNode} from 'react';
import MobileSidebar from '@theme-original/Navbar/MobileSidebar';
import type MobileSidebarType from '@theme/Navbar/MobileSidebar';
import type {WrapperProps} from '@docusaurus/types';
import {useNavbarMobileSidebar} from '@docusaurus/theme-common/internal';

// Docusaurus's mobile menu, closed by Escape like every other panel here.

type Props = WrapperProps<typeof MobileSidebarType>;

export default function MobileSidebarWrapper(props: Props): ReactNode {
  const {shown, toggle} = useNavbarMobileSidebar();
  useEffect(() => {
    if (!shown) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') toggle();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shown, toggle]);
  return <MobileSidebar {...props} />;
}
