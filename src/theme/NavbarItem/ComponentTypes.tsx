// Docusaurus's navbar item types plus the site's mega menu (`custom-mega`)
// and its account links (`custom-account`).
import ComponentTypes from '@theme-original/NavbarItem/ComponentTypes';
import Account from '@site/src/components/nav/Account';
import MegaMenu from '@site/src/components/nav/MegaMenu';

export default {
  ...ComponentTypes,
  'custom-mega': MegaMenu,
  'custom-account': Account,
};
