CREATE TABLE rate_limit (
  day TEXT NOT NULL,
  visitor TEXT NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY (day, visitor)
);

CREATE TABLE metrics (
  day TEXT NOT NULL,
  name TEXT NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY (day, name)
);

CREATE TABLE exchanges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  user_message TEXT NOT NULL,
  model_reply TEXT NOT NULL
);

CREATE INDEX exchanges_created_at ON exchanges (created_at);
