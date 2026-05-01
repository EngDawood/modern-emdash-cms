export type Lang = 'en' | 'ar';

export interface Client {
  name: string;
  uni: string;
  course: string;
}

export interface Task {
  id: number;
  client: string;
  university: string;
  course: string;
  title_en: string;
  title_ar: string;
  type: string;
  type_ar: string;
  deadline: string;
  priority: 'hi' | 'med' | 'lo';
  status: 'new' | 'progress' | 'done' | 'cancel';
  price: number;
  payment: 'paid' | 'half' | 'unpaid';
  claude: string;
  fatora: string;
  fatora_link: string | null;
  notes: string;
  instructions: string;
  log: Array<{ when: string; who: string; what: string }>;
}

export interface TaskFile {
  id: string;
  key: string;
  name: string;
  size: number;
  url: string;
}

export async function loadTaskFiles(taskId: number): Promise<TaskFile[]> {
  const res = await fetch(`/api/tracker/files/${taskId}`);
  return res.json();
}

export async function uploadTaskFile(taskId: number, file: File): Promise<TaskFile> {
  const form = new FormData();
  form.append("file", file);
  form.append("taskId", String(taskId));
  const res = await fetch("/api/tracker/upload", { method: "POST", body: form });
  if (!res.ok) throw new Error("Upload failed");
  return res.json();
}

export async function deleteTaskFile(taskId: number, fileId: string): Promise<void> {
  await fetch("/api/tracker/file", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ taskId, fileId }),
  });
}

export interface StatusInfo {
  en: string;
  ar: string;
  cls: string;
  swatch: string;
}
export interface PriorityInfo {
  en: string;
  ar: string;
  cls: string;
}
export interface PaymentInfo {
  en: string;
  ar: string;
  cls: string;
}

export interface Tweaks {
  accent: 'amber' | 'moss' | 'indigo' | 'rose';
  density: 'compact' | 'comfortable' | 'relaxed';
  theme: 'light' | 'dark';
  layout: 'table' | 'board';
  language: Lang;
}

export interface Filters {
  status: string;
  priority: string;
  payment: string;
  quick: string;
}

export const CLIENTS: Client[] = [
  { name: 'Mariam Al-Sabah',   uni: 'Kuwait University',         course: 'CS 341 — Algorithms' },
  { name: 'Abdullah Rashid',   uni: 'KFUPM',                     course: 'SWE 363 — Web Eng.' },
  { name: 'Layla Hassan',      uni: 'American Univ. of Beirut',  course: 'EECE 430 — Data Sci.' },
  { name: 'Omar Khaled',       uni: 'Qatar University',          course: 'CMPS 405 — OS' },
  { name: 'Sara Al-Otaibi',    uni: 'King Saud University',      course: 'IS 340 — DB Systems' },
  { name: 'Yousef Al-Balushi', uni: 'Sultan Qaboos Univ.',       course: 'COMP 2500 — OOP' },
  { name: 'Fatima Al-Nuaimi',  uni: 'UAE University',            course: 'CSBP 427 — ML' },
  { name: 'Hamad Al-Thani',    uni: 'Qatar University',          course: 'CMPS 350 — Web' },
  { name: 'Nour Darwish',      uni: 'American Univ. of Sharjah', course: 'CMP 305 — Graphics' },
  { name: 'Ziad Mostafa',      uni: 'Cairo University',          course: 'CSE 332 — AI' },
  { name: 'Reem Al-Harbi',     uni: 'KAUST',                     course: 'CS 397 — NLP' },
  { name: 'Khaled Al-Mutairi', uni: 'Kuwait University',         course: 'MIS 301 — Systems' },
  { name: 'Dana Al-Sabbagh',   uni: 'AUB',                       course: 'CMPS 255 — Software' },
  { name: 'Majed Al-Dosari',   uni: 'KFUPM',                     course: 'ICS 343 — Networks' },
  { name: 'Huda Al-Zaabi',     uni: 'UAE University',            course: 'STAT 420 — Regression' },
];

export const TYPES = ['Assignment', 'Project', 'Exam Prep', 'Thesis', 'Report', 'Lab'];

export const TYPES_AR: Record<string, string> = {
  Assignment: 'واجب', Project: 'مشروع', 'Exam Prep': 'تحضير امتحان',
  Thesis: 'أطروحة', Report: 'تقرير', Lab: 'مختبر',
};

type RawRow = [number, number, string, string, string, string, string, string, number, string];

const TASKS_RAW: RawRow[] = [
  [1,  0, "Dijkstra's shortest path — weighted graph visualizer", "تصور خوارزمية ديكسترا للرسم الموزون", "Project",    "2026-04-26", "hi",  "progress", 320, "half"],
  [2,  1, "Portfolio site — React + Tailwind, 4 pages",           "موقع محفظة شخصية — ريأكت + تيلويند",       "Project",    "2026-04-24", "hi",  "new",      450, "unpaid"],
  [3,  2, "Pandas + scikit-learn: housing price regression",      "تحليل أسعار المنازل باستخدام باندا",       "Assignment", "2026-04-30", "med", "progress", 180, "half"],
  [4,  3, "Process scheduler simulator — C, round-robin + SJF",  "محاكي جدولة العمليات بلغة C",              "Project",    "2026-05-02", "hi",  "new",      400, "unpaid"],
  [5,  4, "ER diagram + normalize to 3NF for inventory DB",       "مخطط ER وتطبيع قاعدة بيانات المخزون",      "Assignment", "2026-04-23", "hi",  "progress", 150, "paid"],
  [6,  5, "Banking system — Java, inheritance + interfaces",      "نظام بنكي بلغة جافا — الوراثة والواجهات",   "Project",    "2026-05-01", "med", "new",      280, "unpaid"],
  [7,  6, "CNN for plant disease classification — PyTorch",       "شبكة CNN لتصنيف أمراض النباتات",            "Project",    "2026-05-08", "hi",  "progress", 620, "half"],
  [8,  7, "REST API + JWT auth — Node.js blog backend",           "API مع مصادقة JWT — مدونة Node.js",        "Project",    "2026-04-25", "hi",  "progress", 380, "paid"],
  [9,  8, "OpenGL terrain renderer with height-map texturing",    "عارض تضاريس OpenGL مع خرائط الارتفاع",      "Project",    "2026-05-12", "med", "new",      520, "unpaid"],
  [10, 9, "Minimax + alpha-beta pruning for Connect Four AI",     "ذكاء اصطناعي للعبة Connect Four",           "Assignment", "2026-04-27", "med", "progress", 220, "half"],
  [11,10, "Sentiment analysis on Arabic tweets — transformers",   "تحليل مشاعر التغريدات العربية",             "Thesis",     "2026-06-01", "med", "new",      850, "unpaid"],
  [12,11, "ERP feasibility report — 18 pages + diagrams",         "تقرير جدوى ERP — 18 صفحة",                 "Report",     "2026-04-22", "hi",  "done",     200, "paid"],
  [13,12, "Bug fixes on existing Flutter recipe app",             "إصلاح أخطاء في تطبيق وصفات فلاتر",          "Assignment", "2026-04-29", "lo",  "new",      120, "unpaid"],
  [14,13, "Subnetting worksheet + CIDR calculations (VLSM)",      "ورقة عمل التقسيم الفرعي CIDR",              "Assignment", "2026-04-24", "med", "progress",  90, "paid"],
  [15,14, "Multiple regression final report, R + writeup",        "تقرير الانحدار المتعدد باستخدام R",          "Report",     "2026-05-05", "med", "new",      260, "unpaid"],
  [16, 0, "Big-O analysis worksheet — 12 problems with proofs",   "ورقة تحليل Big-O — 12 مسألة",               "Assignment", "2026-04-20", "hi",  "done",      75, "paid"],
  [17, 1, "Exam prep — data structures mock + study guide",       "تحضير امتحان هياكل البيانات",               "Exam Prep",  "2026-04-28", "hi",  "progress", 180, "half"],
  [18, 2, "Data cleaning + EDA notebook for survey dataset",      "تنظيف البيانات + EDA لاستبيان",              "Assignment", "2026-05-03", "lo",  "new",      140, "unpaid"],
  [19, 4, "Triggers + stored procedures for library DB",          "Triggers وإجراءات مكتبة DB",                "Assignment", "2026-04-21", "med", "done",     110, "paid"],
  [20, 5, "UML class diagrams for hotel management system",       "مخططات UML لإدارة فندق",                    "Assignment", "2026-04-26", "lo",  "progress", 100, "half"],
  [21, 6, "Ethics essay — AI bias case study, 2500 words",        "مقال أخلاقيات الذكاء الاصطناعي",            "Report",     "2026-05-02", "lo",  "new",      160, "unpaid"],
  [22, 7, "GraphQL migration of existing REST endpoints",         "ترحيل REST إلى GraphQL",                     "Project",    "2026-05-09", "med", "new",      420, "unpaid"],
  [23, 8, "Ray-casting demo — C++ / SDL2",                        "عرض Ray-casting بلغة C++",                  "Project",    "2026-05-15", "lo",  "new",      340, "unpaid"],
  [24,10, "LSTM baseline comparison for NLP final",               "مقارنة LSTM للمشروع النهائي",               "Thesis",     "2026-05-20", "med", "progress", 480, "half"],
  [25,11, "SQL query optimization set — 20 queries + plans",      "تحسين استعلامات SQL — 20 استعلام",          "Assignment", "2026-04-30", "med", "new",      170, "unpaid"],
  [26, 3, "Synchronization lab — producer/consumer, semaphores",  "مختبر المزامنة — منتج/مستهلك",               "Lab",        "2026-04-19", "hi",  "done",     130, "paid"],
  [27,13, "TCP socket programming lab writeup",                   "تقرير مختبر TCP sockets",                    "Lab",        "2026-04-25", "med", "progress", 110, "paid"],
  [28, 9, "AI homework 4 — Bayesian networks",                    "واجب 4 — الشبكات البايزية",                  "Assignment", "2026-04-28", "med", "new",      150, "unpaid"],
  [29,12, "Agile / Scrum case study report",                      "تقرير حالة Agile/Scrum",                     "Report",     "2026-05-06", "lo",  "new",      140, "unpaid"],
  [30, 2, "Feature engineering + pipeline refactor",              "هندسة الميزات + تحسين الأنابيب",             "Assignment", "2026-05-01", "med", "cancel",     0, "unpaid"],
  [31,14, "Hypothesis testing problem set + R notebook",          "مسائل اختبار الفرضيات — R",                  "Assignment", "2026-04-23", "hi",  "progress", 130, "half"],
];

export const STATUS: Record<string, StatusInfo> = {
  new:      { en: 'New',         ar: 'جديد',        cls: 'new',      swatch: 'var(--info)' },
  progress: { en: 'In progress', ar: 'قيد التنفيذ', cls: 'progress', swatch: 'var(--warn)' },
  done:     { en: 'Completed',   ar: 'مكتمل',       cls: 'done',     swatch: 'var(--ok)'   },
  cancel:   { en: 'Cancelled',   ar: 'ملغي',        cls: 'cancel',   swatch: 'var(--ink-4)' },
};

export const PRIORITY: Record<string, PriorityInfo> = {
  hi:  { en: 'High',   ar: 'عالية',  cls: 'hi'  },
  med: { en: 'Medium', ar: 'متوسطة', cls: 'med' },
  lo:  { en: 'Low',    ar: 'منخفضة', cls: 'lo'  },
};

export const PAYMENT: Record<string, PaymentInfo> = {
  paid:   { en: 'Paid',      ar: 'مدفوع',     cls: 'paid'   },
  half:   { en: 'Half paid', ar: 'نصف مدفوع', cls: 'half'   },
  unpaid: { en: 'Unpaid',    ar: 'غير مدفوع', cls: 'unpaid' },
};

// Today pinned for demo stability
export const TODAY = new Date('2026-04-23T09:00:00');

export const SEED: Task[] = TASKS_RAW.map(([id, ci, t_en, t_ar, type, deadline, priority, status, price, payment]) => ({
  id,
  client: CLIENTS[ci].name,
  university: CLIENTS[ci].uni,
  course: CLIENTS[ci].course,
  title_en: t_en,
  title_ar: t_ar,
  type,
  type_ar: TYPES_AR[type] ?? type,
  deadline,
  priority: priority as Task['priority'],
  status: status as Task['status'],
  price,
  payment: payment as Task['payment'],
  claude: ['Pro', 'Max', 'API', 'Team'][id % 4],
  fatora: payment === 'paid' ? 'paid' : payment === 'half' ? 'active' : id % 5 === 0 ? 'active' : 'unknown',
  fatora_link: id % 3 === 0 ? null : `https://fato.me/v/${(id * 977).toString(16).toUpperCase().padStart(8, '0').slice(0, 8)}`,
  notes: '',
  instructions: '',
  log: [
    { when: '2d ago', who: 'Dawood', what: 'Created task' },
    ...(status !== 'new' ? [{ when: '1d ago', who: 'Dawood', what: `Moved to ${STATUS[status]?.en ?? status}` }] : []),
    ...(payment === 'paid' ? [{ when: '5h ago', who: 'System', what: 'Payment confirmed via Fatora' }] : []),
    ...(payment === 'half' ? [{ when: '6h ago', who: 'Client', what: 'Partial payment received' }] : []),
  ],
}));

export const T: Record<Lang, Record<string, string>> = {
  en: {
    brand: 'Tracker', brand_sub: 'Freelance OPS',
    views: 'Views', all: 'All tasks', active: 'Active',
    this_week: 'This week', overdue: 'Overdue', completed: 'Completed',
    cancelled: 'Cancelled', filters: 'Saved filters', hi_pri: 'High priority',
    unpaid: 'Unpaid', by_client: 'By client', settings: 'Settings',
    columns: 'Columns', trash: 'Archive', title: 'Tasks',
    subtitle: '31 tasks · live', new_task: 'New task',
    search: 'Search tasks, clients, courses…', status: 'Status',
    priority: 'Priority', payment: 'Payment', any: 'Any',
    sum_active: 'Active pipeline', sum_earn: 'Earnings (QTD)',
    sum_unpaid: 'Awaiting payment', sum_due: 'Due this week',
    sum_velocity: 'Completion rate', table: 'Table', board: 'Board', list: 'List',
    id: 'ID', task: 'Task', client: 'Client', type: 'Type', deadline: 'Deadline',
    course: 'Course', price: 'Price', edit: 'Edit', delete: 'Delete',
    save: 'Save changes', cancel: 'Cancel', close: 'Close',
    mark_done: 'Mark complete', duplicate: 'Duplicate', open: 'Open details',
    claude: 'Claude account', fatora: 'Fatora invoice',
    instructions: 'Client instructions', notes: 'Private notes',
    activity: 'Activity', add_col: 'Add column', today: 'today',
    tomorrow: 'tomorrow', d_left: 'd left', d_over: 'd over',
    overdue_label: 'overdue', new_label: 'New', progress_label: 'In progress',
    done_label: 'Completed', cancel_label: 'Cancelled',
    banner: '3 tasks overdue and 4 due in the next 48 hours.',
    review: 'Review overdue', of: 'of',
    cmd_title: 'Command', cmd_placeholder: 'Type a command or search…',
    cmd_nav: 'Navigate', cmd_actions: 'Actions', cmd_theme: 'Switch theme',
    cmd_lang: 'Toggle language', cmd_new: 'New task', cmd_filter: 'Filter by…',
    cmd_jump: 'Jump to task', tweaks: 'Tweaks', accent: 'Accent',
    density: 'Density', theme: 'Theme', layout_tw: 'Layout',
    light: 'Light', dark: 'Dark', compact: 'Compact', comfy: 'Comfy', relaxed: 'Relaxed',
    fatora_paid: 'Paid', fatora_active: 'Pending', fatora_unknown: 'No invoice',
    files: 'Files', attach: 'Attach file', uploading: 'Uploading…',
  },
  ar: {
    brand: 'المتتبع', brand_sub: 'إدارة العمل الحر',
    views: 'العروض', all: 'كل المهام', active: 'نشطة',
    this_week: 'هذا الأسبوع', overdue: 'متأخرة', completed: 'مكتملة',
    cancelled: 'ملغاة', filters: 'مرشحات محفوظة', hi_pri: 'أولوية عالية',
    unpaid: 'غير مدفوعة', by_client: 'حسب العميل', settings: 'الإعدادات',
    columns: 'الأعمدة', trash: 'الأرشيف', title: 'المهام',
    subtitle: '31 مهمة · مباشر', new_task: 'مهمة جديدة',
    search: 'ابحث في المهام والعملاء والمواد…', status: 'الحالة',
    priority: 'الأولوية', payment: 'الدفع', any: 'الكل',
    sum_active: 'المهام النشطة', sum_earn: 'الأرباح (الربع)',
    sum_unpaid: 'معلقة الدفع', sum_due: 'مستحق هذا الأسبوع',
    sum_velocity: 'معدل الإنجاز', table: 'جدول', board: 'لوحة', list: 'قائمة',
    id: 'المعرف', task: 'المهمة', client: 'العميل', type: 'النوع', deadline: 'الموعد',
    course: 'المادة', price: 'السعر', edit: 'تعديل', delete: 'حذف',
    save: 'حفظ التغييرات', cancel: 'إلغاء', close: 'إغلاق',
    mark_done: 'إنجاز', duplicate: 'تكرار', open: 'فتح التفاصيل',
    claude: 'حساب Claude', fatora: 'فاتورة فاتورة',
    instructions: 'تعليمات العميل', notes: 'ملاحظات خاصة',
    activity: 'النشاط', add_col: 'إضافة عمود', today: 'اليوم',
    tomorrow: 'غداً', d_left: 'يوم متبقي', d_over: 'يوم تأخير',
    overdue_label: 'متأخرة', new_label: 'جديد', progress_label: 'قيد التنفيذ',
    done_label: 'مكتمل', cancel_label: 'ملغي',
    banner: '3 مهام متأخرة و 4 مستحقة خلال 48 ساعة.',
    review: 'مراجعة المتأخرات', of: 'من',
    cmd_title: 'أمر', cmd_placeholder: 'اكتب أمراً أو ابحث…',
    cmd_nav: 'تنقل', cmd_actions: 'إجراءات', cmd_theme: 'تبديل السمة',
    cmd_lang: 'تبديل اللغة', cmd_new: 'مهمة جديدة', cmd_filter: 'تصفية حسب…',
    cmd_jump: 'اقفز إلى مهمة', tweaks: 'تعديلات', accent: 'اللون',
    density: 'الكثافة', theme: 'السمة', layout_tw: 'التخطيط',
    light: 'فاتح', dark: 'داكن', compact: 'كثيف', comfy: 'مريح', relaxed: 'فسيح',
    fatora_paid: 'مدفوعة', fatora_active: 'معلقة', fatora_unknown: 'لا يوجد',
    files: 'الملفات', attach: 'إرفاق ملف', uploading: 'جاري الرفع…',
  },
};

export function daysUntil(dateStr: string): number {
  const d = new Date(dateStr + 'T09:00:00');
  return Math.round((d.getTime() - TODAY.getTime()) / (1000 * 60 * 60 * 24));
}

export function formatDate(dateStr: string, lang: Lang): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' });
}

export function formatRel(dateStr: string, lang: Lang): string {
  const n = daysUntil(dateStr);
  const t = T[lang];
  if (n === 0) return t.today;
  if (n === 1) return t.tomorrow;
  if (n < 0) return `${Math.abs(n)}${lang === 'en' ? 'd' : ''} ${t.d_over}`;
  return `${n}${lang === 'en' ? 'd' : ''} ${t.d_left}`;
}

export function currency(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
