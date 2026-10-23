import type {CSSProperties} from 'react';

// How far auto tuning moves each PostgreSQL setting from its stock value,
// on a log scale: right of the line is raised, left is lowered. Real values
// for PostgreSQL 17 on 16 vCPU / 64 GB / 400 GB network SSD, size L
// (stroppy-cloud internal/domain/compile/tune_postgres_test.go). Styles in
// src/css/how.css (.tune).

type Row = {key: string; stock: string; tuned: string; ratio: number};

const ROWS: Row[] = [
  {key: 'shared_buffers', stock: '128 MB', tuned: '16 GB', ratio: 128},
  {key: 'effective_cache_size', stock: '4 GB', tuned: '48 GB', ratio: 12},
  {key: 'max_wal_size', stock: '1 GB', tuned: '18.6 GB', ratio: 18.6},
  {key: 'maintenance_work_mem', stock: '64 MB', tuned: '2 GB', ratio: 32},
  {key: 'max_parallel_workers', stock: '8', tuned: '16', ratio: 2},
  {key: 'effective_io_concurrency', stock: '1', tuned: '200', ratio: 200},
  {key: 'random_page_cost', stock: '4', tuned: '1.1', ratio: 1.1 / 4},
  {key: 'checkpoint_timeout', stock: '5 min', tuned: '15 min', ratio: 3},
];

// The track spans 1/8 (left) to 256 (right) in powers of two.
const LO = -3;
const HI = 8;
const at = (r: number) => (Math.log2(r) - LO) / (HI - LO);
const ZERO = at(1);

const factor = (r: number) => (r >= 1 ? `×${+r.toFixed(1)}` : `÷${+(1 / r).toFixed(1)}`);

export default function TuneChart() {
  return (
    <figure className="tune" style={{'--zero': ZERO} as CSSProperties}>
      <table className="tune__table">
        <caption>PostgreSQL 17 on 16 vCPU, 64 GB memory and a 400 GB network SSD</caption>
        <thead>
          <tr>
            <th scope="col">Setting</th>
            <th scope="col">Stock</th>
            <th scope="col">
              <span className="tune__axis">
                <span>lowered</span>
                <span>raised, log scale</span>
              </span>
            </th>
            <th scope="col">Tuned</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((r) => {
            const end = at(r.ratio);
            return (
              <tr key={r.key}>
                <th scope="row">
                  <code>{r.key}</code>
                </th>
                <td className="tune__stock">{r.stock}</td>
                <td className="tune__track" aria-label={factor(r.ratio)}>
                  <span
                    className={r.ratio < 1 ? 'tune__bar tune__bar--down' : 'tune__bar'}
                    style={{left: `${Math.min(ZERO, end) * 100}%`, width: `${Math.abs(end - ZERO) * 100}%`} as CSSProperties}
                  />
                  <span
                    className={r.ratio < 1 ? 'tune__factor tune__factor--down' : 'tune__factor'}
                    style={{left: `${end * 100}%`}}>
                    {factor(r.ratio)}
                  </span>
                </td>
                <td className="tune__tuned">{r.tuned}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </figure>
  );
}
