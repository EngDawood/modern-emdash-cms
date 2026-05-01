import Icon from './icons';
import { Pill } from './primitives';
import { STATUS, daysUntil, formatDate, formatRel, currency, type Task, type Lang } from './data';

interface BoardProps {
  tasks: Task[];
  lang: Lang;
  onOpen: (id: number) => void;
}

export function Board({ tasks, lang, onOpen }: BoardProps) {
  const cols: Task['status'][] = ['new', 'progress', 'done', 'cancel'];
  return (
    <div className="board">
      {cols.map(k => {
        const s = STATUS[k];
        const items = tasks.filter(t => t.status === k);
        const sum = items.reduce((a, b) => a + b.price, 0);
        return (
          <div className="col" key={k}>
            <div className="col__head">
              <h3>
                <span className="swatch" style={{ background: s.swatch }} />
                {s[lang]}
              </h3>
              <span className="col__count mono">{items.length}</span>
              <span className="col__sum">${currency(sum)}</span>
            </div>
            <div className="col__body">
              {items.map(task => (
                <Card key={task.id} task={task} lang={lang} onOpen={() => onOpen(task.id)} />
              ))}
              {!items.length && (
                <div style={{
                  textAlign: 'center',
                  padding: '20px 8px',
                  fontSize: 11.5,
                  color: 'var(--ink-4)',
                  fontFamily: 'var(--mono)',
                  letterSpacing: '.08em',
                  textTransform: 'uppercase',
                }}>—</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface CardProps {
  task: Task;
  lang: Lang;
  onOpen: () => void;
}

function Card({ task, lang, onOpen }: CardProps) {
  const title = lang === 'ar' ? task.title_ar : task.title_en;
  const dl = daysUntil(task.deadline);
  const dlCls =
    task.status === 'done' || task.status === 'cancel' ? '' :
    dl < 0 ? 'is-overdue' : dl <= 2 ? 'is-soon' : '';

  return (
    <div className="card" onClick={onOpen}>
      <div className="card__top">
        <span className="card__id">#{String(task.id).padStart(3, '0')}</span>
        {task.priority === 'hi' && (
          <span style={{ color: 'var(--err)', display: 'inline-flex' }} title="High priority">
            <Icon name="flame" size={11} />
          </span>
        )}
        <span className="card__client">{task.client}</span>
      </div>
      <div className="card__title">{title}</div>
      <div className="card__meta">
        <span className={`meta ${dlCls}`}>
          <Icon name="calendar" size={11} />
          {formatDate(task.deadline, lang)} · {formatRel(task.deadline, lang)}
        </span>
        <span className="meta">
          <Icon name="tag" size={11} />
          {lang === 'ar' ? task.type_ar : task.type}
        </span>
      </div>
      <div className="card__bottom">
        <Pill kind="payment" value={task.payment} lang={lang} />
        <span className="price mono">${currency(task.price)}</span>
      </div>
    </div>
  );
}
