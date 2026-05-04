CREATE TABLE IF NOT EXISTS tracker_lists (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  list_key   TEXT NOT NULL,
  value      TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

INSERT INTO tracker_lists (list_key, value, sort_order) VALUES
  ('claude_accounts', 'davidh',     0),
  ('claude_accounts', 'engdawood',  1),
  ('claude_accounts', 'dawood',     2),
  ('claude_accounts', 'amoota',     3),
  ('claude_accounts', 'moh',        4),
  ('claude_accounts', 'adbalmlak',  5),
  ('task_types', 'Assignment', 0),
  ('task_types', 'Project',    1),
  ('task_types', 'Exam Prep',  2),
  ('task_types', 'Thesis',     3),
  ('task_types', 'Report',     4),
  ('task_types', 'Lab',        5);
