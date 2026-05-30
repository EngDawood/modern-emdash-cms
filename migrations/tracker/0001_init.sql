CREATE TABLE IF NOT EXISTS tasks (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  client         TEXT NOT NULL,
  task           TEXT NOT NULL,
  type           TEXT,
  deadline       TEXT,
  priority       TEXT,
  status         TEXT DEFAULT 'جديد',
  price          REAL,
  payment        TEXT,
  course         TEXT,
  university     TEXT,
  claude_account TEXT,
  instructions   TEXT,
  notes          TEXT,
  files          TEXT,
  fatora_link    TEXT,
  fatora_status  TEXT DEFAULT 'unknown',
  custom_fields  TEXT DEFAULT '{}',
  created_at     TEXT DEFAULT (datetime('now')),
  updated_at     TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS universities (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL UNIQUE,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS custom_columns (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  col_key      TEXT NOT NULL UNIQUE,
  col_label_en TEXT NOT NULL,
  col_label_ar TEXT NOT NULL,
  col_type     TEXT NOT NULL DEFAULT 'text',
  col_options  TEXT,
  created_at   TEXT DEFAULT (datetime('now'))
);
