import type {ComponentProps} from 'react';

/** A native select in the kit's look: a pill with a drawn chevron (ratings.css, .rt-select). */
export default function Select(props: ComponentProps<'select'>) {
  return (
    <span className="rt-select">
      <select {...props} />
    </span>
  );
}
