import type {KeyboardEvent, ReactNode} from 'react';
import SearchBar from '@theme-original/SearchBar';
import IconClose from '@theme/Icon/Close';

// The local search plugin's field with a close button. On a phone the open
// field takes the whole bar (src/css/nav.css), so the button is the way back;
// Escape does the same. Closing is leaving the field: the plugin shrinks it
// back to its icon on blur.

function close(): void {
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
}

export default function SearchBarWrapper(): ReactNode {
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') close();
  };
  return (
    <div className="navbar-search" onKeyDown={onKeyDown}>
      <SearchBar />
      {/* No focus change on press: the field would blur first and fold the
          bar, and the tap would land on the account button now under it. */}
      <button
        type="button"
        className="navbar-search__close clean-btn"
        aria-label="Close search"
        onMouseDown={(e) => e.preventDefault()}
        onClick={close}
      >
        <IconClose width={18} height={18} />
      </button>
    </div>
  );
}
