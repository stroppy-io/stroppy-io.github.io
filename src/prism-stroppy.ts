import type {PrismTheme} from 'prism-react-renderer';

// One Prism theme for both colour modes: prism-react-renderer writes these as
// inline styles, so the kit's --st-* variables resolve per data-theme.
const theme: PrismTheme = {
  plain: {color: 'var(--st-text)', backgroundColor: 'var(--st-panel)'},
  styles: [
    {types: ['comment', 'prolog', 'doctype', 'cdata'], style: {color: 'var(--st-muted)', fontStyle: 'italic'}},
    {types: ['keyword', 'selector', 'atrule', 'important'], style: {color: 'var(--st-primary-text)'}},
    {types: ['string', 'char', 'attr-value', 'regex', 'inserted'], style: {color: 'var(--st-series-3)'}},
    {types: ['number', 'boolean', 'constant', 'symbol'], style: {color: 'var(--st-series-5)'}},
    {types: ['function', 'class-name'], style: {color: 'var(--st-series-4)'}},
    {types: ['property', 'tag', 'attr-name', 'namespace'], style: {color: 'var(--st-series-6)'}},
    {types: ['builtin', 'variable', 'parameter'], style: {color: 'var(--st-series-2)'}},
    {types: ['operator', 'punctuation', 'entity', 'url'], style: {color: 'var(--st-muted)'}},
    {types: ['deleted'], style: {color: 'var(--st-error)'}},
  ],
};

export default theme;
