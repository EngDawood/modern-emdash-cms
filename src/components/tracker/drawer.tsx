import { useState, useEffect } from 'react';
import Icon from './icons';
import { IconBtn } from './primitives';
import { CLIENTS, TYPES, STATUS, PRIORITY, PAYMENT, T, type Task, type Lang, type TaskFile, loadTaskFiles, uploadTaskFile, deleteTaskFile } from './data';

interface DrawerProps {
  task: Task;
  lang: Lang;
  onClose: () => void;
  onUpdate: (id: number, patch: Partial<Task>) => void;
  onDelete: (id: number) => void;
}

export function Drawer({ task, lang, onClose, onUpdate, onDelete }: DrawerProps) {
  const t = T[lang];
  const [form, setForm] = useState<Task>(task);
  const [files, setFiles] = useState<TaskFile[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => { setForm(task); }, [task.id]);

  useEffect(() => {
    if (task.id) loadTaskFiles(task.id).then(setFiles).catch(() => setFiles([]));
  }, [task.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!task) return null;
  const set = <K extends keyof Task>(k: K, v: Task[K]) => setForm(f => ({ ...f, [k]: v }));

  function save() {
    onUpdate(task.id, form);
    onClose();
  }

  const uniList = [...new Set(CLIENTS.map(c => c.uni))];

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label="Edit task">
        <div className="drawer__head">
          <span className="did">#{String(task.id).padStart(3, '0')}</span>
          <h2>{lang === 'ar' ? form.title_ar : form.title_en}</h2>
          <span className="spacer" />
          <IconBtn icon="link" title="Copy link" />
          <IconBtn
            icon="trash"
            title={t.delete}
            onClick={() => {
              if (window.confirm('Delete task?')) { onDelete(task.id); onClose(); }
            }}
          />
          <IconBtn icon="x" title={t.close} onClick={onClose} />
        </div>

        <div className="drawer__body">
          <div className="field">
            <label className="field__label">
              {t.task}
              <span className="lbl-ar">المهمة</span>
            </label>
            <input
              className="input"
              value={lang === 'ar' ? form.title_ar : form.title_en}
              onChange={e => set(lang === 'ar' ? 'title_ar' : 'title_en', e.target.value)}
            />
          </div>

          <div className="grid2">
            <div className="field">
              <label className="field__label">{t.client}</label>
              <input
                className="input"
                list="drawer-clients-list"
                value={form.client}
                onChange={e => set('client', e.target.value)}
              />
              <datalist id="drawer-clients-list">
                {CLIENTS.map(c => <option key={c.name} value={c.name} />)}
              </datalist>
            </div>
            <div className="field">
              <label className="field__label">University</label>
              <input
                className="input"
                list="drawer-uni-list"
                value={form.university}
                onChange={e => set('university', e.target.value)}
              />
              <datalist id="drawer-uni-list">
                {uniList.map(u => <option key={u} value={u} />)}
              </datalist>
            </div>
          </div>

          <div className="grid3">
            <div className="field">
              <label className="field__label">{t.deadline}</label>
              <input
                type="date"
                className="input"
                value={form.deadline}
                onChange={e => set('deadline', e.target.value)}
              />
            </div>
            <div className="field">
              <label className="field__label">{t.type}</label>
              <select className="select" value={form.type} onChange={e => set('type', e.target.value)}>
                {TYPES.map(x => <option key={x} value={x}>{x}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="field__label">{t.price}</label>
              <input
                type="number"
                className="input"
                value={form.price}
                onChange={e => set('price', Number(e.target.value) || 0)}
              />
            </div>
          </div>

          <div className="grid3">
            <Choice label={t.status} value={form.status} options={STATUS} lang={lang}
              onChange={v => set('status', v as Task['status'])} />
            <Choice label={t.priority} value={form.priority} options={PRIORITY} lang={lang}
              onChange={v => set('priority', v as Task['priority'])} />
            <Choice label={t.payment} value={form.payment} options={PAYMENT} lang={lang}
              onChange={v => set('payment', v as Task['payment'])} />
          </div>

          <div className="grid2">
            <div className="field">
              <label className="field__label">{t.claude}</label>
              <select className="select" value={form.claude} onChange={e => set('claude', e.target.value)}>
                {['Pro', 'Max', 'API', 'Team'].map(x => <option key={x}>{x}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="field__label">
                {t.fatora}
                <span className="lbl-ar" style={{
                  marginLeft: 'auto',
                  padding: '1px 7px',
                  borderRadius: 3,
                  fontFamily: 'var(--mono)',
                  textTransform: 'uppercase',
                  fontSize: 9.5,
                  background: form.fatora === 'paid' ? 'var(--ok-soft)' : form.fatora === 'active' ? 'var(--warn-soft)' : 'var(--surface-sunk)',
                  color: form.fatora === 'paid' ? 'var(--ok)' : form.fatora === 'active' ? 'var(--warn)' : 'var(--ink-4)',
                }}>
                  {form.fatora === 'paid' ? t.fatora_paid : form.fatora === 'active' ? t.fatora_active : t.fatora_unknown}
                </span>
              </label>
              <input
                className="input mono"
                placeholder="https://fato.me/v/…"
                style={{ fontSize: 12 }}
                value={form.fatora_link ?? ''}
                onChange={e => set('fatora_link', e.target.value || null)}
              />
            </div>
          </div>

          <div className="field">
            <label className="field__label">{t.instructions}</label>
            <textarea
              className="textarea"
              placeholder="Paste requirements, rubric, file links…"
              value={form.instructions ?? ''}
              onChange={e => set('instructions', e.target.value)}
            />
          </div>

          <div className="field">
            <label className="field__label">{t.files}</label>
            {files.length > 0 && (
              <div className="file-list">
                {files.map(f => (
                  <div key={f.id} className="file-item">
                    <a href={f.url} download={f.name} className="file-item__name">{f.name}</a>
                    <span className="file-item__size">{(f.size / 1024).toFixed(0)} KB</span>
                    <button
                      className="file-item__del"
                      title="Remove"
                      onClick={async () => {
                        await deleteTaskFile(task.id, f.id);
                        setFiles(fs => fs.filter(x => x.id !== f.id));
                      }}
                    >✕</button>
                  </div>
                ))}
              </div>
            )}
            <label className={`file-upload-btn${uploading ? ' file-upload-btn--busy' : ''}`}>
              {uploading ? t.uploading : t.attach}
              <input
                type="file"
                hidden
                disabled={uploading}
                onChange={async e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUploading(true);
                  try {
                    const ref = await uploadTaskFile(task.id, file);
                    setFiles(fs => [...fs, ref]);
                  } catch {
                    // upload error — silently ignore, user can retry
                  } finally {
                    setUploading(false);
                    e.target.value = '';
                  }
                }}
              />
            </label>
          </div>

          <div className="field">
            <label className="field__label">{t.notes}</label>
            <textarea
              className="textarea"
              placeholder="Only visible to you"
              value={form.notes ?? ''}
              onChange={e => set('notes', e.target.value)}
            />
          </div>

          <div className="log">
            <label className="field__label" style={{ marginBottom: 4 }}>{t.activity}</label>
            {(task.log ?? []).map((l, i) => (
              <div className="log__item" key={i}>
                <span className="when">{l.when}</span>
                <span><b>{l.who}</b> {l.what}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="drawer__foot">
          <button className="btn" onClick={onClose}>{t.cancel}</button>
          <span className="spacer" />
          <button
            className="btn"
            onClick={() => { onUpdate(task.id, { status: 'done', payment: 'paid' }); onClose(); }}
          >
            <Icon name="check" size={12} /> {t.mark_done}
          </button>
          <button className="btn btn--primary" onClick={save}>{t.save}</button>
        </div>
      </aside>
    </>
  );
}

interface ChoiceProps {
  label: string;
  value: string;
  options: Record<string, { en: string; ar: string; cls: string }>;
  lang: Lang;
  onChange: (v: string) => void;
}

function Choice({ label, value, options, lang, onChange }: ChoiceProps) {
  return (
    <div className="field">
      <label className="field__label">{label}</label>
      <div className="choicegroup" style={{ alignSelf: 'flex-start' }}>
        {Object.entries(options).map(([k, v]) => (
          <button key={k} className={k === value ? 'is-active' : ''} onClick={() => onChange(k)}>
            {v[lang]}
          </button>
        ))}
      </div>
    </div>
  );
}
