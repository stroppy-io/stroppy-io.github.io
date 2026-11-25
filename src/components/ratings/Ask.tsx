import {useEffect, useId, useRef, useState} from 'react';
import clsx from 'clsx';
import {protocolShort} from '../conformity/data';
import type {Tool} from './fit';

// The top of /ratings: what the reader's clients speak, a segment each with
// its engine count, and the reader's own tools as chips with the whole list
// of tools the checks cover, searchable.

export type ProtocolCard = {proto: string; engines: number};

/** A segmented control of the protocols, each with how many engines claim it. */
export function Protocols({cards, value, onPick}: {cards: ProtocolCard[]; value: string; onPick: (p: string) => void}) {
  return (
    <div className="rp-seg" role="tablist" aria-label="What your clients speak">
      {cards.map((c) => (
        <button
          key={c.proto}
          type="button"
          role="tab"
          aria-selected={c.proto === value}
          className={clsx(c.proto === value && 'is-on')}
          onClick={() => onPick(c.proto)}>
          {protocolShort(c.proto)}
          <span>{c.engines}</span>
        </button>
      ))}
    </div>
  );
}

/** The tools a reader picked, in words: "psycopg", "psycopg and pg_dump", "psycopg, pg_dump and Debezium". */
export const toolsInWords = (names: string[]) =>
  names.length < 2 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

type ToolsProps = {proto: string; tools: Tool[]; picked: string[]; onTools: (t: string[]) => void};

/** "Your tools: psycopg × pg_dump × Add a tool", the list opening under it. */
export function Tools({proto, tools, picked, onTools}: ToolsProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const panel = useId();
  const box = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);

  // The list closes on Escape and on a click outside it; opening puts the cursor in its search.
  useEffect(() => {
    if (!open) return undefined;
    search.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const onDown = (e: MouseEvent) => {
      if (box.current && e.target instanceof Node && !box.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open]);

  if (tools.length === 0) return null;
  const toggle = (name: string) => onTools(picked.includes(name) ? picked.filter((t) => t !== name) : [...picked, name]);
  const q = query.trim().toLowerCase();
  const shown = q ? tools.filter((t) => t.name.toLowerCase().includes(q)) : tools;

  return (
    <div className="rp-mytools" ref={box}>
      <span className="rp-mytools__label">Your tools:</span>
      {picked.map((name) => (
        <button key={name} type="button" className="rp-chip" onClick={() => toggle(name)} aria-label={`Remove ${name}`}>
          {name}
          <span aria-hidden="true">×</span>
        </button>
      ))}
      <button type="button" className="rp-add" aria-expanded={open} aria-controls={panel} onClick={() => setOpen((v) => !v)}>
        {picked.length ? 'Add a tool' : `Pick from ${tools.length}`}
      </button>
      {picked.length > 0 && (
        <button type="button" className="rp-link" onClick={() => onTools([])}>
          Clear
        </button>
      )}
      {open && (
        <div id={panel} className="rp-tools" role="group" aria-label={`Tools that speak ${protocolShort(proto)}`}>
          <input
            ref={search}
            className="rp-tools__search"
            type="search"
            placeholder={`Find a tool among ${tools.length}`}
            aria-label="Find a tool"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <ul className="rp-tools__list">
            {shown.map((t) => (
              <li key={t.name}>
                <label>
                  <input type="checkbox" checked={picked.includes(t.name)} onChange={() => toggle(t.name)} />
                  {t.name}
                </label>
              </li>
            ))}
            {shown.length === 0 && <li className="rp-tools__none">No tool matches “{query}”.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
