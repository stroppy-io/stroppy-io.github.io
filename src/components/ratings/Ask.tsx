import {useEffect, useId, useRef, useState} from 'react';
import clsx from 'clsx';
import {protocolShort} from '../conformity/data';
import {LEAN_NAMES, LEANS, type Tool} from './fit';

// The top of /ratings: what the reader's clients speak, a segment each with
// its engine count, and the reader's own tools as chips with the whole list
// of tools the checks cover, searchable, grouped by what each leans on.

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

/**
 * A field beside the search: "Your tools", the picked ones as chips, each
 * removed by its × without opening anything, a × that clears them all; the
 * rest of the field opens the list of every tool.
 */
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
      <div className={clsx('rp-field', open && 'is-open')}>
        <span className="rp-field__label">Your tools</span>
        {picked.map((name) => (
          <button key={name} type="button" className="rp-chip" onClick={() => toggle(name)} aria-label={`Remove ${name}`}>
            {name}
            <span aria-hidden="true">×</span>
          </button>
        ))}
        <button
          type="button"
          className="rp-field__open"
          aria-expanded={open}
          aria-controls={panel}
          aria-label={`Pick from ${tools.length} tools`}
          onClick={() => setOpen((v) => !v)}>
          {picked.length === 0 && <span className="rp-field__hint">Pick from {tools.length}</span>}
          <span className="rp-field__chevron" aria-hidden="true" />
        </button>
        {picked.length > 0 && (
          <button type="button" className="rp-field__clear" onClick={() => onTools([])} aria-label="Clear your tools">
            ×
          </button>
        )}
      </div>
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
          <div className="rp-tools__body">
            {LEANS.map((lean) => {
              const group = shown.filter((t) => t.lean === lean);
              if (group.length === 0) return null;
              return (
                <fieldset key={lean} className="rp-tools__group">
                  <legend>{LEAN_NAMES[lean]}</legend>
                  <ul className="rp-tools__list">
                    {group.map((t) => (
                      <li key={t.name}>
                        <label>
                          <input type="checkbox" checked={picked.includes(t.name)} onChange={() => toggle(t.name)} />
                          {t.name}
                        </label>
                      </li>
                    ))}
                  </ul>
                </fieldset>
              );
            })}
            {shown.length === 0 && <p className="rp-tools__none">No tool matches “{query}”.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
