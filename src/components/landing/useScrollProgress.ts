import {useEffect, useState, type RefObject} from 'react';

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * How far an element has travelled through the viewport, 0…1, following the
 * scroll both ways. `start` and `end` are the element top's position as a
 * fraction of the viewport height: 0 at `start`, 1 at `end`. With reduced
 * motion it is always `settled`.
 */
export default function useScrollProgress(
  ref: RefObject<HTMLElement | null>,
  {start = 0.9, end = 0.35, settled = 1}: {start?: number; end?: number; settled?: number} = {},
): number {
  const [progress, setProgress] = useState(settled);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (reducedMotion()) {
      setProgress(settled);
      return undefined;
    }
    let frame = 0;
    const measure = () => {
      frame = 0;
      const top = el.getBoundingClientRect().top / window.innerHeight;
      setProgress(Math.min(1, Math.max(0, (start - top) / (start - end))));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener('scroll', schedule, {passive: true});
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [ref, start, end, settled]);
  return progress;
}
