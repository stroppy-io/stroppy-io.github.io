import type {Score} from './score';

/** Quality, not category: green from 8, amber from 5, red below. */
export const tone = (v: number) => (v >= 8 ? 'good' : v >= 5 ? 'fair' : 'poor');

/** The score out of 10 and how many categories it rests on: "9.1  2 of 2". */
export default function ScoreChip({score}: {score: Score | null}) {
  if (!score) return <span className="rt-na">—</span>;
  return (
    <span className="rt-score" title={`The mean of the ${score.measured} of ${score.of} categories that were run`}>
      <b className={`rt-tone--${tone(score.value)}`}>{score.value.toFixed(1)}</b>
      <small>
        {score.measured} of {score.of}
      </small>
    </span>
  );
}
