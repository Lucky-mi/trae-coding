export const schemaSQL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS words (
  id TEXT PRIMARY KEY,
  word TEXT NOT NULL,
  meaning_zh TEXT NOT NULL,
  stage TEXT NOT NULL,
  level TEXT,
  pos TEXT,
  phonetic TEXT
);
CREATE INDEX IF NOT EXISTS idx_words_stage ON words(stage);
CREATE INDEX IF NOT EXISTS idx_words_level ON words(level);

CREATE TABLE IF NOT EXISTS assessment_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  stage TEXT NOT NULL,
  per_level_count INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'ongoing',
  created_at INTEGER NOT NULL,
  ended_at INTEGER,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS assessment_answers (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  word_id TEXT NOT NULL,
  is_correct INTEGER NOT NULL,
  user_choice_index INTEGER NOT NULL,
  time_spent_ms INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY(session_id) REFERENCES assessment_sessions(id),
  FOREIGN KEY(word_id) REFERENCES words(id)
);

CREATE TABLE IF NOT EXISTS spaced_repetition_items (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  word_id TEXT NOT NULL,
  box_level INTEGER NOT NULL DEFAULT 1,
  next_review_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(user_id, word_id),
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(word_id) REFERENCES words(id)
);
`;