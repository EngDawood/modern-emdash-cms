import { useState, useEffect, useMemo, useRef } from 'react';
import Icon from './icons';
import { T, type Task, type Lang, type Filters } from './data';

interface PaletteItem {
  group: string;
  icon: string;
  label: string;
  hint: string;
  run: () => void;
  i: number;
}

interface PaletteProps {
  tasks: Task[];
  lang: Lang;
  onClose: () => void;
  setLang: (l: Lang) => void;
  setView: (v: string) => void;
  setTheme: (t: string) => void;
  theme: string;
  onOpen: (id: number) => void;
  onNewTask: () => void;
  setFilters: (f: Filters) => void;
}

export function Palette({
  tasks, lang, onClose, setLang, setView, setTheme, theme, onOpen, onNewTask, setFilters,
}: PaletteProps) {
  const t = T[lang];
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const items = useMemo(() => {
    const actions = [
      { group: t.cmd_actions, icon: 'plus',  label: t.cmd_new,   hint: 'N',  run: () => { onNewTask(); onClose(); } },
      { group: t.cmd_actions, icon: 'sun',   label: t.cmd_theme, hint: theme === 'dark' ? '→ Light' : '→ Dark', run: () => { setTheme(theme === 'dark' ? 'light' : 'dark'); onClose(); } },
      { group: t.cmd_actions, icon: 'lang',  label: t.cmd_lang,  hint: lang === 'en' ? '→ عربي' : '→ English', run: () => { setLang(lang === 'en' ? 'ar' : 'en'); onClose(); } },
      { group: t.cmd_nav,     icon: 'table', label: t.table + ' view', hint: '1', run: () => { setView('table'); onClose(); } },
      { group: t.cmd_nav,     icon: 'board', label: t.board + ' view', hint: '2', run: () => { setView('board'); onClose(); } },
      { group: t.cmd_actions, icon: 'flame', label: 'Show: ' + t.overdue, hint: '', run: () => { setFilters({ status: '', priority: '', payment: '', quick: 'overdue' }); onClose(); } },
      { group: t.cmd_actions, icon: 'coin',  label: 'Show: ' + t.unpaid, hint: '', run: () => { setFilters({ status: '', priority: '', payment: 'unpaid', quick: '' }); onClose(); } },
    ];
    const taskItems = tasks.slice(0, 20).map(task => ({
      group: t.cmd_jump,
      icon: 'arrowR',
      label: `#${String(task.id).padStart(3, '0')}  ${lang === 'ar' ? task.title_ar : task.title_en}`,
      hint: task.client,
      run: () => { onOpen(task.id); onClose(); },
    }));

    const all = [...actions, ...taskItems].map((item, i) => ({ ...item, i }));
    if (!q) return all;
    const ql = q.toLowerCase();
    return all.filter(i => i.label.toLowerCase().includes(ql) || (i.hint ?? '').toLowerCase().includes(ql));
  }, [q, tasks, lang, theme]);

  useEffect(() => { setIdx(0); }, [q]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setIdx(i => Math.min(i + 1, items.length - 1)); }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setIdx(i => Math.max(i - 1, 0)); }
      if (e.key === 'Enter' && items[idx]) { e.preventDefault(); items[idx].run(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [idx, items, onClose]);

  const groups = items.reduce<Record<string, PaletteItem[]>>((acc, it) => {
    if (!acc[it.group]) acc[it.group] = [];
    acc[it.group].push(it);
    return acc;
  }, {});

  return (
    <div className="palette-wrap" onClick={onClose}>
      <div className="palette" onClick={e => e.stopPropagation()}>
        <div className="palette__search">
          <Icon name="search" size={15} />
          <input
            ref={inputRef}
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder={t.cmd_placeholder}
          />
          <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--ink-4)', padding: '2px 6px', border: '1px solid var(--line)', borderRadius: 4 }}>ESC</span>
        </div>
        <div className="palette__list">
          {Object.entries(groups).map(([g, its]) => (
            <div key={g}>
              <div className="palette__group">{g}</div>
              {its.map(it => (
                <div
                  key={it.i}
                  className={`palette__item ${idx === it.i ? 'is-active' : ''}`}
                  onMouseEnter={() => setIdx(it.i)}
                  onClick={it.run}
                >
                  <span className="i"><Icon name={it.icon} size={14} /></span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {it.label}
                  </span>
                  {it.hint && <span className="hint">{it.hint}</span>}
                </div>
              ))}
            </div>
          ))}
          {!items.length && (
            <div style={{ padding: '30px 14px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>
              No matches
            </div>
          )}
        </div>
        <div className="palette__foot">
          <span><kbd>↑↓</kbd> Navigate</span>
          <span><kbd>↵</kbd> Select</span>
          <span><kbd>ESC</kbd> Close</span>
        </div>
      </div>
    </div>
  );
}
