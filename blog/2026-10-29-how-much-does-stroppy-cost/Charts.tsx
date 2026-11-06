import React, {useId, useState} from 'react';
import data from '@site/static/data/framework-performance/results.json';
import styles from './charts.module.css';

type Tool = 'native_reuse' | 'native_no_reuse' | 'stroppy';
type Row = {label: string; tool: Tool; values: number[]};
const labels: Record<Tool, string> = {
  native_reuse: 'Native go-tpc · reuse',
  native_no_reuse: 'Native go-tpc · no reuse',
  stroppy: 'Stroppy port',
};
const number = (value: number, digits = 0) => value.toLocaleString('en-US', {maximumFractionDigits: digits});
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return (sorted[Math.floor((sorted.length - 1) / 2)] + sorted[Math.ceil((sorted.length - 1) / 2)]) / 2;
};
const tools: Tool[] = ['native_reuse', 'native_no_reuse', 'stroppy'];

function Legend({selected, originalLabel}: {selected: Tool[]; originalLabel?: string}) {
  return <ul className={styles.legend} aria-label="Chart legend">{selected.map(tool => (
    <li key={tool}><i className={`${styles.key} ${styles[tool]}`} />{tool === 'native_reuse' && originalLabel ? originalLabel : labels[tool]}</li>
  ))}</ul>;
}

function Bars({title, rows, unit, caption, lower = false, originalLabel}: {
  title: string; rows: Row[]; unit: string; caption: string; lower?: boolean; originalLabel?: string;
}) {
  const id = useId();
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...rows.flatMap(row => row.values)) * 1.08;
  const selected = tools.filter(tool => rows.some(row => row.tool === tool));
  return <figure className={styles.figure} aria-labelledby={id}>
    <figcaption id={id}><strong>{title}</strong><span>{unit} · {lower ? 'lower is better' : 'higher is better'}</span></figcaption>
    <Legend selected={selected} originalLabel={originalLabel} />
    <div className={styles.bars}>
      {rows.map((row, index) => {
        const value = median(row.values);
        const low = Math.min(...row.values);
        const high = Math.max(...row.values);
        return <div key={row.label} className={styles.barRow} onPointerEnter={() => setHover(index)} onPointerLeave={() => setHover(null)}>
          <div className={styles.rowTitle}><span>{row.label}</span><b>{number(value, lower ? 1 : 0)}</b></div>
          <div className={styles.track} tabIndex={0} onFocus={() => setHover(index)} onBlur={() => setHover(null)}
            aria-label={`${row.label}: ${number(value, 1)} ${unit}. Samples: ${row.values.map(value => number(value, 1)).join(', ')}.`}>
            <span className={`${styles.bar} ${styles[row.tool]}`} style={{width: `${value / max * 100}%`}} />
            {row.values.length > 1 && <span className={styles.range} style={{left: `${low / max * 100}%`, width: `${(high - low) / max * 100}%`}} />}
          </div>
          {hover === index && <div className={styles.tooltip} role="status">{row.values.length > 1 ? 'Individual runs' : 'Measured run'}: {row.values.map(value => number(value, 1)).join(' · ')} {unit}</div>}
        </div>;
      })}
      <div className={styles.axis}><span>0</span><span>{number(max / 2)}</span><span>{number(max)}</span></div>
    </div>
    <p className={styles.caption}>{caption}</p>
    <details><summary>View exact values</summary><div className={styles.tableScroll}><table>
      <thead><tr><th>Client path</th><th>{unit}</th><th>Individual runs</th></tr></thead>
      <tbody>{rows.map(row => <tr key={row.label}><th>{row.label}</th><td>{number(median(row.values), 2)}</td><td>{row.values.map(value => number(value, 2)).join(' / ')}</td></tr>)}</tbody>
    </table></div></details>
  </figure>;
}

export function MainResults({family}: {family: 'hammerdb' | 'go-tpc'}) {
  const rows: Row[] = [];
  for (const placement of ['local', 'private_lan']) {
    const name = placement === 'local' ? 'Same host' : 'Private LAN';
    for (const engine of ['original', 'stroppy']) {
      rows.push({label: `${name} · ${engine === 'original' ? family === 'hammerdb' ? 'HammerDB' : 'native go-tpc, reuse' : 'Stroppy port'}`,
        tool: engine === 'original' ? 'native_reuse' : 'stroppy',
        values: data.cases.filter(row => row.campaign === 'headtohead' && row.family === family && row.placement === placement && row.tool === engine).map(row => row.new_orders_per_second)});
    }
  }
  return <Bars title={family === 'hammerdb' ? 'HammerDB and its Stroppy port' : 'Native go-tpc and its Stroppy port'} rows={rows} unit="committed New-Orders/s" originalLabel={family === 'hammerdb' ? 'Original HammerDB' : 'Native go-tpc · reuse'}
    caption="Median of two runs per row. Black marks show the full two-run range, not confidence intervals. Same eight-core client budget; local TCP and private-LAN placements shown separately." />;
}

export function NoReuseResults() {
  const [placement, setPlacement] = useState('local');
  const rows: Row[] = tools.map(tool => ({tool,
    label: tool === 'native_reuse' ? 'Native go-tpc · reuse (earlier)' : tool === 'native_no_reuse' ? 'Native go-tpc · no reuse (follow-up)' : 'Stroppy port (earlier)',
    values: data.cases.filter(row => row.family === 'go-tpc' && row.placement === placement && (tool === 'native_no_reuse' ? row.campaign === 'no-reuse' : row.campaign === 'headtohead' && row.tool === (tool === 'native_reuse' ? 'original' : 'stroppy'))).map(row => row.new_orders_per_second),
  }));
  return <div className={styles.root}>
    <label className={styles.control}>Client placement <select value={placement} onChange={event => setPlacement(event.target.value)}><option value="local">Same host as DB</option><option value="private_lan">Private LAN</option></select></label>
    <Bars title="What changes when native go-tpc stops reusing statements?" rows={rows} unit="committed New-Orders/s"
      caption="Two runs per row. No-reuse measurements followed the original campaign; the other two rows are earlier results, not fresh interleaved controls. All rows use eight client cores." />
  </div>;
}

export function EfficiencyResults() {
  const [cores, setCores] = useState(1);
  const rows = tools.map(tool => {
    const row = data.efficiency.cases.find(row => row.tool === tool && row.client_cores === cores)!;
    return {tool, label: tool === 'native_reuse' ? 'Native go-tpc · reuse' : labels[tool], values: [row.new_orders_per_client_cpu_second]};
  });
  return <div className={styles.root}>
    <label className={styles.control}>Physical client cores <select value={cores} onChange={event => setCores(Number(event.target.value))}><option value={1}>1 core</option><option value={2}>2 cores</option></select></label>
    <Bars title="Committed work per client CPU-second" rows={rows} unit="New-Orders/client CPU-second"
      caption={cores === 1 ? 'Fresh runs. All clients used 99–100% of their one-core budget. One invocation per setting; this is not a confidence estimate.' : 'Fresh runs. Clients used 70–80% of their two-core budget. These runs did not pass our strict fully-CPU-bound test. One invocation per setting.'} />
  </div>;
}

export function RuntimeResults() {
  const [placement, setPlacement] = useState('local');
  const [metric, setMetric] = useState<'new_orders_per_second' | 'client_cpu_percent'>('new_orders_per_second');
  const [cursor, setCursor] = useState<number | null>(null);
  const [texture, setTexture] = useState(true);
  const chosen = tools.map(tool => ({tool, row: data.runtime.find(row => row.family === 'go-tpc' && row.placement === placement && row.repetition === 1 &&
    (tool === 'native_no_reuse' ? row.campaign === 'no-reuse' : row.campaign === 'headtohead' && row.tool === (tool === 'native_reuse' ? 'original' : 'stroppy')))!}));
  const maxTime = 910;
  const width = 700, left = 56, plot = 536, top = 24, height = 190;
  const values = chosen.flatMap(({row}) => row.points.map(point => (point as unknown as Record<string, number>)[metric])).filter(Number.isFinite);
  const max = Math.max(...values) * 1.1;
  const x = (value: number) => left + value / maxTime * plot;
  const y = (value: number) => top + height - value / max * height;
  const closest = (points: typeof data.runtime[number]['points'], seconds: number) => points.reduce((a, b) => Math.abs(a.seconds - seconds) < Math.abs(b.seconds - seconds) ? a : b);
  const id = useId();
  const unit = metric === 'new_orders_per_second' ? 'committed New-Orders/s' : '% of one client core';
  return <figure className={`${styles.figure} ${texture ? styles.textured : ''}`} aria-labelledby={id}>
    <figcaption id={id}><strong>Runtime, not just a final number</strong><span>{unit} · first repetition</span></figcaption>
    <div className={styles.controls}>
      <label>Placement <select value={placement} onChange={event => setPlacement(event.target.value)}><option value="local">Same host</option><option value="private_lan">Private LAN</option></select></label>
      <label>Measure <select value={metric} onChange={event => setMetric(event.target.value as typeof metric)}><option value="new_orders_per_second">New-Orders/s</option><option value="client_cpu_percent">Client CPU</option></select></label>
      <label><input type="checkbox" checked={texture} onChange={event => setTexture(event.target.checked)} /> Line patterns</label>
    </div>
    <Legend selected={tools} />
    <div className={styles.plot}>
      <svg viewBox={`0 0 ${width} 260`} role="img" aria-label={`First repetition ${placement}, ${unit}. Exact samples available below.`} tabIndex={0}
        onPointerMove={event => {const rect = event.currentTarget.getBoundingClientRect(); setCursor(Math.min(maxTime, Math.max(0, ((event.clientX - rect.left) / rect.width * width - left) / plot * maxTime)));}}
        onPointerLeave={() => setCursor(null)} onFocus={() => setCursor(600)} onBlur={() => setCursor(null)}>
        {[0, 1, 2, 3, 4].map(tick => <g key={tick}>
          <line x1={left} x2={left + plot} y1={y(max * tick / 4)} y2={y(max * tick / 4)} className={styles.grid} />
          <text x={left - 9} y={y(max * tick / 4) + 4} textAnchor="end" className={styles.axisText}>{number(max * tick / 4)}</text>
        </g>)}
        {[0, 300, 600, 900].map(seconds => <text key={seconds} x={x(seconds)} y={242} textAnchor="middle" className={styles.axisText}>{seconds}s</text>)}
        <line x1={x(300)} x2={x(300)} y1={top} y2={top + height} className={styles.boundary} />
        <text x={x(300) + 5} y={15} className={styles.axisText}>measurement starts</text>
        <line x1={x(900)} x2={x(900)} y1={top} y2={top + height} className={styles.boundary} />
        {chosen.map(({tool, row}, index) => {
          const points = row.points.filter(point => Number.isFinite((point as unknown as Record<string, number>)[metric]));
          return <g key={tool} className={styles[tool]}>
            <path className={styles.line} d={points.map((point, index) => `${index ? 'L' : 'M'}${x(point.seconds)},${y((point as unknown as Record<string, number>)[metric])}`).join(' ')} />
            <text x={left + plot + 10} y={top + 22 + index * 20} className={styles.direct}>{tool === 'native_reuse' ? 'native reuse' : tool === 'native_no_reuse' ? 'no reuse' : 'Stroppy'}</text>
          </g>;
        })}
        {cursor !== null && <line x1={x(cursor)} x2={x(cursor)} y1={top} y2={top + height} className={styles.crosshair} />}
      </svg>
      {cursor !== null && <div className={styles.runtimeTip} role="status"><strong>{number(cursor)} seconds</strong>{chosen.map(({tool, row}) => {
        const point = closest(row.points, cursor);
        return <span key={tool}>{tool === 'native_reuse' ? 'Native reuse' : tool === 'native_no_reuse' ? 'Native no reuse' : 'Stroppy'}: {Number.isFinite((point as unknown as Record<string, number>)[metric]) ? number((point as unknown as Record<string, number>)[metric], 1) : 'not sampled'}</span>;
      })}</div>}
    </div>
    <p className={styles.caption}>Five-second samples, aligned by elapsed client time. On a narrow screen, scroll the plot sideways or use the sample table. The no-reuse line comes from the later follow-up, not a simultaneous run. Warm-up is 0–300s. Samples after 900s show shutdown, not measured throughput. Every repetition and raw resource counter is in the download.</p>
    <details><summary>View sample table</summary><div className={styles.tableScroll}><table><thead><tr><th>Client</th><th>Elapsed seconds</th><th>{unit}</th></tr></thead><tbody>
      {chosen.flatMap(({tool, row}) => row.points.map(point => <tr key={`${tool}-${point.seconds}`}><th>{tool.replaceAll('_', ' ')}</th><td>{number(point.seconds, 1)}</td><td>{Number.isFinite((point as unknown as Record<string, number>)[metric]) ? number((point as unknown as Record<string, number>)[metric], 2) : 'not sampled'}</td></tr>))}
    </tbody></table></div></details>
  </figure>;
}
