PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS direction (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS task_status (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS meeting (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  title        TEXT    NOT NULL,
  meeting_date TEXT    NOT NULL,
  topic        TEXT    NOT NULL,
  created_at   TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS task (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  meeting_id     INTEGER NOT NULL,
  parent_task_id INTEGER NULL,
  title          TEXT    NOT NULL,
  start_date     TEXT    NOT NULL,
  end_date       TEXT    NOT NULL,
  status         TEXT    NOT NULL DEFAULT 'В работе',
  created_at     TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (meeting_id)     REFERENCES meeting(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_task_id) REFERENCES task(id)    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS person (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name   TEXT    NOT NULL DEFAULT '',
  last_name    TEXT    NOT NULL DEFAULT '',
  full_name    TEXT    NOT NULL DEFAULT '',
  email        TEXT,
  direction_id INTEGER,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (direction_id) REFERENCES direction(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS task_person (
  task_id   INTEGER NOT NULL,
  person_id INTEGER NOT NULL,
  PRIMARY KEY (task_id, person_id),
  FOREIGN KEY (task_id)   REFERENCES task(id)   ON DELETE CASCADE,
  FOREIGN KEY (person_id) REFERENCES person(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_meeting_date ON meeting(meeting_date);
CREATE INDEX IF NOT EXISTS idx_task_meeting ON task(meeting_id);
CREATE INDEX IF NOT EXISTS idx_task_parent  ON task(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_task_dates   ON task(start_date, end_date);
