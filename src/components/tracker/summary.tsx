import Icon from './icons';
import { daysUntil, currency, T, type Task, type Lang } from './data';

interface SummaryProps {
  tasks: Task[];
  lang: Lang;
}

export function Summary({ tasks, lang }: SummaryProps) {
  const t = T[lang];

  const active = tasks.filter(x => x.status === 'new' || x.status === 'progress');
  const done = tasks.filter(x => x.status === 'done');
  const cancelled = tasks.filter(x => x.status === 'cancel');
  const overdue = tasks.filter(x => x.status !== 'done' && x.status !== 'cancel' && daysUntil(x.deadline) < 0);
  const dueWeek = tasks.filter(x => {
    const d = daysUntil(x.deadline);
    return x.status !== 'done' && x.status !== 'cancel' && d >= 0 && d <= 7;
  });

  const earn =
    done.reduce((s, x) => s + x.price, 0) +
    tasks.filter(x => x.payment === 'half').reduce((s, x) => s + x.price / 2, 0);
  const unpaid = tasks
    .filter(x => x.status !== 'cancel' && (x.payment === 'unpaid' || x.payment === 'half'))
    .reduce((s, x) => s + (x.payment === 'half' ? x.price / 2 : x.price), 0);

  const total = tasks.length || 1;
  const pctDone   = Math.round((done.length / total) * 100);
  const pctProg   = Math.round((tasks.filter(x => x.status === 'progress').length / total) * 100);
  const pctNew    = Math.round((tasks.filter(x => x.status === 'new').length / total) * 100);
  const pctCancel = Math.round((cancelled.length / total) * 100);
  const velocity  = Math.round((done.length / (done.length + active.length || 1)) * 100);

  return (
    <div className="summary">
      <div className="summary__cell">
        <div className="summary__label">
          <span className="dot" style={{ background: 'var(--warn)' }} />
          {t.sum_active}
        </div>
        <div className="summary__value">
          <span className="mono">{active.length}</span>
          <span className="unit">/ {tasks.length}</span>
        </div>
        <div className="summary__bar" title="Status breakdown">
          <span className="b-neu" style={{ width: pctNew + '%', background: 'var(--info)' }} />
          <span className="b-warn" style={{ width: pctProg + '%' }} />
          <span className="b-ok" style={{ width: pctDone + '%' }} />
          <span className="b-neu" style={{ width: pctCancel + '%' }} />
        </div>
      </div>

      <div className="summary__cell">
        <div className="summary__label">
          <span className="dot" style={{ background: 'var(--ok)' }} />
          {t.sum_earn}
        </div>
        <div className="summary__value">
          <span className="mono">${currency(earn)}</span>
        </div>
        <div className="summary__delta up">
          <Icon name="arrowUp" size={11} /> +{currency(Math.round(earn * 0.14))} vs last Q
        </div>
      </div>

      <div className="summary__cell">
        <div className="summary__label">
          <span className="dot" style={{ background: 'var(--err)' }} />
          {t.sum_unpaid}
        </div>
        <div className="summary__value">
          <span className="mono">${currency(unpaid)}</span>
        </div>
        <div className="summary__delta">
          <span style={{ color: 'var(--err)' }}>{tasks.filter(x => x.payment === 'unpaid' && x.status !== 'cancel').length}</span>{' '}
          unpaid ·
          <span style={{ color: 'var(--warn)' }}> {tasks.filter(x => x.payment === 'half').length}</span> partial
        </div>
      </div>

      <div className="summary__cell">
        <div className="summary__label">
          <span className="dot" style={{ background: 'var(--warn)' }} />
          {t.sum_due}
        </div>
        <div className="summary__value">
          <span className="mono">{dueWeek.length}</span>
          <span className="unit">tasks</span>
        </div>
        <div className="summary__delta down">
          <Icon name="flame" size={11} /> {overdue.length} overdue
        </div>
      </div>

      <div className="summary__cell">
        <div className="summary__label">
          <span className="dot" style={{ background: 'var(--acc)' }} />
          {t.sum_velocity}
        </div>
        <div className="summary__value">
          <span className="mono">{velocity}%</span>
        </div>
        <div className="summary__delta">
          <Sparkline data={[3, 5, 4, 6, 7, 5, 8, 9, 7, 10, 9, 11]} />
        </div>
      </div>
    </div>
  );
}

interface SparklineProps {
  data: number[];
  w?: number;
  h?: number;
}

function Sparkline({ data, w = 80, h = 20 }: SparklineProps) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const step = w / (data.length - 1);
  const pts = data
    .map((v, i) => `${i * step},${h - ((v - min) / (max - min || 1)) * (h - 2) - 1}`)
    .join(' ');
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <polyline
        points={pts}
        fill="none"
        stroke="var(--acc)"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
