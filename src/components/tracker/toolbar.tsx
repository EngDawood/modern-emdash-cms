import { useState, useRef } from 'react';
import Icon from './icons';
import { useClickOutside } from './primitives';
import { STATUS, PRIORITY, PAYMENT, T, type Lang, type Filters } from './data';

interface ToolbarProps {
  lang: Lang;
  setLang: (l: Lang) => void;
  query: string;
  setQuery: (q: string) => void;
  filters: Filters;
  setFilters: (f: Filters) => void;
  view: string;
  setView: (v: string) => void;
  onNewTask: () => void;
  onOpenPalette: () => void;
  onOpenColumns: () => void;
  onOpenTweaks: () => void;
}

export function Toolbar({
  lang, setLang,
  query, setQuery,
  filters, setFilters,
  view, setView,
  onNewTask, onOpenPalette, onOpenColumns, onOpenTweaks,
}: ToolbarProps) {
  const t = T[lang];
  return (
    <div className="toolbar">
      <div className="search">
        <span className="icon"><Icon name="search" size={14} /></span>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={t.search}
        />
        <span className="kbd">⌘K</span>
      </div>

      <FilterDropdown
        label={t.status}
        value={filters.status}
        onChange={v => setFilters({ ...filters, status: v })}
        options={[
          { v: '', l: t.any },
          { v: 'new', l: STATUS.new[lang] },
          { v: 'progress', l: STATUS.progress[lang] },
          { v: 'done', l: STATUS.done[lang] },
          { v: 'cancel', l: STATUS.cancel[lang] },
        ]}
        lang={lang}
      />
      <FilterDropdown
        label={t.priority}
        value={filters.priority}
        onChange={v => setFilters({ ...filters, priority: v })}
        options={[
          { v: '', l: t.any },
          { v: 'hi', l: PRIORITY.hi[lang] },
          { v: 'med', l: PRIORITY.med[lang] },
          { v: 'lo', l: PRIORITY.lo[lang] },
        ]}
        lang={lang}
      />
      <FilterDropdown
        label={t.payment}
        value={filters.payment}
        onChange={v => setFilters({ ...filters, payment: v })}
        options={[
          { v: '', l: t.any },
          { v: 'paid', l: PAYMENT.paid[lang] },
          { v: 'half', l: PAYMENT.half[lang] },
          { v: 'unpaid', l: PAYMENT.unpaid[lang] },
        ]}
        lang={lang}
      />

      <div className="divider-v" />

      <div className="seg">
        <button className={view === 'table' ? 'is-active' : ''} onClick={() => setView('table')} title={t.table}>
          <Icon name="table" size={13} /> {t.table}
        </button>
        <button className={view === 'board' ? 'is-active' : ''} onClick={() => setView('board')} title={t.board}>
          <Icon name="board" size={13} /> {t.board}
        </button>
      </div>

      <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
        <button className="btn btn--ghost" onClick={onOpenColumns} title={t.columns}>
          <Icon name="sliders" size={13} /> {t.columns}
        </button>
        <button className="btn btn--ghost" onClick={onOpenPalette} title="Command">
          <Icon name="cmd" size={13} />
        </button>
        <button className="btn btn--ghost" onClick={onOpenTweaks} title={t.tweaks}>
          <Icon name="settings" size={13} />
        </button>
        <button className="btn btn--ghost" onClick={() => setLang(lang === 'en' ? 'ar' : 'en')} title="Language">
          <Icon name="lang" size={13} /> {lang === 'en' ? 'AR' : 'EN'}
        </button>
        <button className="btn btn--accent" onClick={onNewTask}>
          <Icon name="plus" size={13} /> {t.new_task}
        </button>
      </div>
    </div>
  );
}

interface Option {
  v: string;
  l: string;
}

interface FilterDropdownProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  lang: Lang;
}

function FilterDropdown({ label, value, onChange, options, lang }: FilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false));
  const selected = options.find(o => o.v === value);
  const isOn = !!value;
  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button className={`filter ${isOn ? 'is-on' : ''}`} onClick={() => setOpen(o => !o)}>
        <Icon name={isOn ? 'tag' : 'plus'} size={11} />
        <span>{label}</span>
        {isOn && (
          <>
            <span style={{ color: 'var(--ink-5)' }}>·</span>
            <span className="val">{selected?.l}</span>
          </>
        )}
        <Icon name="chevD" size={10} />
      </button>
      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 4px)',
          [lang === 'ar' ? 'right' : 'left']: 0,
          background: 'var(--surface)',
          border: '1px solid var(--line-strong)',
          borderRadius: 8,
          boxShadow: 'var(--shadow-md)',
          padding: 4,
          minWidth: 160,
          zIndex: 20,
        }}>
          {options.map(o => (
            <button
              key={o.v || 'any'}
              onClick={() => { onChange(o.v); setOpen(false); }}
              style={{
                width: '100%',
                textAlign: lang === 'ar' ? 'right' : 'left',
                padding: '6px 10px',
                borderRadius: 5,
                fontSize: 12.5,
                fontWeight: o.v === value ? 600 : 400,
                color: o.v === value ? 'var(--acc)' : 'var(--ink-2)',
                background: o.v === value ? 'var(--acc-tint)' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {o.v === value && <Icon name="check" size={11} />}
              <span style={{ marginLeft: o.v === value ? 0 : 17 }}>{o.l}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
