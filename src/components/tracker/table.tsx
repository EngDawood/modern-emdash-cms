import { useState, useRef } from 'react';
import Icon from './icons';
import { Pill, useClickOutside } from './primitives';
import {
  STATUS, PRIORITY, PAYMENT, T,
  daysUntil, formatDate, formatRel, currency,
  type Task, type Lang,
} from './data';

interface TableProps {
  tasks: Task[];
  lang: Lang;
  sortKey: string;
  sortDir: 'asc' | 'desc';
  onSort: (k: string) => void;
  onOpen: (id: number) => void;
  onUpdate: (id: number, patch: Partial<Task>) => void;
  onDelete: (id: number) => void;
  selected: Set<number>;
  setSelected: (s: Set<number>) => void;
}

export function Table({
  tasks, lang, sortKey, sortDir, onSort,
  onOpen, onUpdate, onDelete, selected, setSelected,
}: TableProps) {
  const t = T[lang];

  const columns = [
    { k: 'id',       l: t.id,       cls: 'col-id' },
    { k: 'title',    l: t.task,     cls: 'col-task' },
    { k: 'client',   l: t.client,   cls: 'col-client' },
    { k: 'type',     l: t.type,     cls: 'col-type' },
    { k: 'deadline', l: t.deadline, cls: 'col-deadline' },
    { k: 'status',   l: t.status,   cls: 'col-status' },
    { k: 'priority', l: t.priority, cls: 'col-priority' },
    { k: 'payment',  l: t.payment,  cls: 'col-payment' },
    { k: 'price',    l: t.price,    cls: 'col-price' },
    { k: 'actions',  l: '',         cls: 'col-actions', nosort: true },
  ];

  return (
    <div className="tblwrap">
      <table className="tbl">
        <thead>
          <tr>
            {columns.map(c => (
              <th
                key={c.k}
                className={c.cls}
                onClick={() => !c.nosort && onSort(c.k)}
                style={c.nosort ? { cursor: 'default' } : {}}
              >
                {c.l}
                {sortKey === c.k && (
                  <span className="sort-ind">
                    <Icon name={sortDir === 'asc' ? 'chevU' : 'chevD'} size={9} />
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tasks.map(task => (
            <Row
              key={task.id}
              task={task}
              lang={lang}
              onOpen={() => onOpen(task.id)}
              onUpdate={onUpdate}
              selected={selected.has(task.id)}
              toggleSelected={() => {
                const s = new Set(selected);
                s.has(task.id) ? s.delete(task.id) : s.add(task.id);
                setSelected(s);
              }}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface RowProps {
  task: Task;
  lang: Lang;
  onOpen: () => void;
  onUpdate: (id: number, patch: Partial<Task>) => void;
  selected: boolean;
  toggleSelected: () => void;
}

function Row({ task, lang, onOpen, onUpdate, selected }: RowProps) {
  const t = T[lang];
  const [editing, setEditing] = useState<string | null>(null);
  const [val, setVal] = useState('');
  const title = lang === 'ar' ? task.title_ar : task.title_en;
  const dl = daysUntil(task.deadline);
  const dlCls =
    task.status === 'done' || task.status === 'cancel' ? '' :
    dl < 0 ? 'is-overdue' : dl <= 2 ? 'is-soon' : '';

  function startEdit(field: string, current: string | number) {
    setEditing(field);
    setVal(String(current));
  }

  function commit() {
    if (editing) {
      const v = editing === 'price' ? Number(val) || 0 : val;
      onUpdate(task.id, { [editing]: v } as Partial<Task>);
    }
    setEditing(null);
  }

  function cancel() { setEditing(null); }

  return (
    <tr className={selected ? 'is-selected' : ''}>
      <td className="col-id">
        <span className="mono">#{String(task.id).padStart(3, '0')}</span>
      </td>

      <td className="col-task" onDoubleClick={() => startEdit(lang === 'ar' ? 'title_ar' : 'title_en', title)}>
        {editing === 'title_en' || editing === 'title_ar' ? (
          <input
            className="cell-edit"
            value={val}
            autoFocus
            onChange={e => setVal(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel(); }}
            onBlur={commit}
          />
        ) : (
          <>
            <span className="task-main">{title}</span>
            <span className="task-meta">{task.type}</span>
          </>
        )}
      </td>

      <td className="col-client" onDoubleClick={() => startEdit('client', task.client)}>
        {editing === 'client' ? (
          <input
            className="cell-edit"
            value={val}
            autoFocus
            onChange={e => setVal(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel(); }}
            onBlur={commit}
          />
        ) : (
          <>
            <span>{task.client}</span>
            <span className="uni">{task.university}</span>
          </>
        )}
      </td>

      <td className="col-type">
        <span className="mono" style={{ fontSize: 11, color: 'var(--ink-3)', letterSpacing: '.04em', textTransform: 'uppercase' }}>
          {lang === 'ar' ? task.type_ar : task.type}
        </span>
      </td>

      <td className={`col-deadline ${dlCls}`} onDoubleClick={() => startEdit('deadline', task.deadline)}>
        {editing === 'deadline' ? (
          <input
            type="date"
            className="cell-edit"
            value={val}
            autoFocus
            onChange={e => setVal(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel(); }}
            onBlur={commit}
          />
        ) : (
          <>
            <span>{formatDate(task.deadline, lang)}</span>
            <span className="rel">{formatRel(task.deadline, lang)}</span>
          </>
        )}
      </td>

      <td className="col-status" onClick={e => e.stopPropagation()}>
        <CellSelect value={task.status} options={STATUS} lang={lang} kind="status"
          onChange={v => onUpdate(task.id, { status: v as Task['status'] })} />
      </td>
      <td className="col-priority" onClick={e => e.stopPropagation()}>
        <CellSelect value={task.priority} options={PRIORITY} lang={lang} kind="priority"
          onChange={v => onUpdate(task.id, { priority: v as Task['priority'] })} />
      </td>
      <td className="col-payment" onClick={e => e.stopPropagation()}>
        <CellSelect value={task.payment} options={PAYMENT} lang={lang} kind="payment"
          onChange={v => onUpdate(task.id, { payment: v as Task['payment'] })} />
      </td>

      <td className="col-price" onDoubleClick={() => startEdit('price', task.price)}>
        {editing === 'price' ? (
          <input
            className="cell-edit"
            value={val}
            autoFocus
            type="number"
            onChange={e => setVal(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel(); }}
            onBlur={commit}
          />
        ) : (
          <>${currency(task.price)}</>
        )}
      </td>

      <td className="col-actions">
        <div className="row-actions">
          <button title={t.open} onClick={onOpen}><Icon name="edit" size={12} /></button>
          <button title={t.duplicate}><Icon name="more" size={12} /></button>
        </div>
      </td>
    </tr>
  );
}

interface CellSelectProps {
  value: string;
  options: Record<string, { en: string; ar: string; cls: string }>;
  lang: Lang;
  kind: 'status' | 'priority' | 'payment';
  onChange: (v: string) => void;
}

function CellSelect({ value, options, lang, kind, onChange }: CellSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false));
  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button onClick={() => setOpen(o => !o)} style={{ padding: 0, background: 'none', border: 0, cursor: 'pointer' }}>
        <Pill kind={kind} value={value} lang={lang} />
      </button>
      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 4px)',
          left: 0,
          background: 'var(--surface)',
          border: '1px solid var(--line-strong)',
          borderRadius: 7,
          boxShadow: 'var(--shadow-md)',
          padding: 3,
          minWidth: 140,
          zIndex: 20,
        }}>
          {Object.entries(options).map(([k]) => (
            <button key={k} onClick={() => { onChange(k); setOpen(false); }} style={{
              width: '100%',
              padding: '4px 6px',
              borderRadius: 4,
              textAlign: lang === 'ar' ? 'right' : 'left',
              background: k === value ? 'var(--paper-2)' : 'transparent',
            }}>
              <Pill kind={kind} value={k} lang={lang} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
