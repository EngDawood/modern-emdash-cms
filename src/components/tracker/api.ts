import { TYPES_AR, type Task } from './data';

interface D1Result<T = Record<string, unknown>> {
  results: T[];
  meta: { last_row_id: number; changes: number; duration: number };
  success: boolean;
}

interface DbTask {
  id: number;
  client: string;
  task: string;
  title_ar: string | null;
  type: string | null;
  deadline: string | null;
  priority: string | null;
  status: string | null;
  price: number | null;
  payment: string | null;
  course: string | null;
  university: string | null;
  claude_account: string | null;
  instructions: string | null;
  notes: string | null;
  fatora_link: string | null;
  fatora_status: string | null;
  log: string | null;
  created_at: string | null;
  updated_at: string | null;
}

async function q<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<D1Result<T>> {
  const res = await fetch('/api/tracker', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql, params: params ?? null }),
  });
  if (!res.ok) throw new Error(`Tracker API ${res.status}: ${await res.text()}`);
  return res.json() as Promise<D1Result<T>>;
}

export function mapDbRow(row: DbTask): Task {
  const type = row.type ?? 'Assignment';
  return {
    id: row.id,
    client: row.client,
    university: row.university ?? '',
    course: row.course ?? '',
    title_en: row.task,
    title_ar: row.title_ar ?? row.task,
    type,
    type_ar: TYPES_AR[type] ?? type,
    deadline: row.deadline ?? '',
    priority: (row.priority ?? 'med') as Task['priority'],
    status: (row.status ?? 'new') as Task['status'],
    price: row.price ?? 0,
    payment: (row.payment ?? 'unpaid') as Task['payment'],
    claude: row.claude_account ?? 'Pro',
    fatora: row.fatora_status ?? 'unknown',
    fatora_link: row.fatora_link ?? null,
    notes: row.notes ?? '',
    instructions: row.instructions ?? '',
    log: (() => { try { return JSON.parse(row.log ?? '[]'); } catch { return []; } })(),
  };
}

export async function loadAll(): Promise<Task[]> {
  const result = await q<DbTask>('SELECT * FROM tasks ORDER BY deadline ASC NULLS LAST, id DESC');
  return result.results.map(mapDbRow);
}

export async function insertTask(task: Task): Promise<number> {
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const result = await q(
    `INSERT INTO tasks (client, task, title_ar, type, deadline, priority, status, price, payment,
      course, university, claude_account, fatora_link, fatora_status, instructions, notes, log,
      created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      task.client, task.title_en, task.title_ar, task.type, task.deadline,
      task.priority, task.status, task.price, task.payment,
      task.course, task.university, task.claude, task.fatora_link, task.fatora,
      task.instructions, task.notes, JSON.stringify(task.log),
      now, now,
    ],
  );
  return result.meta.last_row_id;
}

export async function updateTaskInDb(id: number, patch: Partial<Task>): Promise<void> {
  const colMap: Record<string, string> = {
    title_en: 'task', title_ar: 'title_ar', type: 'type', deadline: 'deadline',
    priority: 'priority', status: 'status', price: 'price', payment: 'payment',
    client: 'client', university: 'university', course: 'course',
    claude: 'claude_account', fatora: 'fatora_status', fatora_link: 'fatora_link',
    instructions: 'instructions', notes: 'notes', log: 'log',
  };

  const sets: string[] = [];
  const vals: unknown[] = [];

  for (const [key, col] of Object.entries(colMap)) {
    if (key in patch) {
      sets.push(`${col} = ?`);
      const v = patch[key as keyof Task];
      vals.push(key === 'log' ? JSON.stringify(v) : v);
    }
  }

  if (!sets.length) return;
  sets.push("updated_at = datetime('now')");
  vals.push(id);
  await q(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`, vals);
}

export async function deleteTaskInDb(id: number): Promise<void> {
  await q('DELETE FROM tasks WHERE id = ?', [id]);
}
