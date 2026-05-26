export const schemaSQL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  exp INTEGER NOT NULL DEFAULT 0,
  role TEXT NOT NULL DEFAULT 'user',
  streak_days INTEGER NOT NULL DEFAULT 0,
  last_active_at INTEGER
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  revoked_at INTEGER,
  FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);

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
  user_id TEXT,
  guest_id TEXT,
  stage TEXT NOT NULL,
  per_level_count INTEGER NOT NULL,
  time_limit_sec INTEGER,
  started_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'ongoing',
  ended_by TEXT,
  created_at INTEGER NOT NULL,
  ended_at INTEGER,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS rulesets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 0,
  config_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS achievements (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS user_achievements (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  achievement_id TEXT NOT NULL,
  unlocked_at INTEGER NOT NULL,
  meta_json TEXT,
  UNIQUE(user_id, achievement_id),
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(achievement_id) REFERENCES achievements(id)
);

CREATE TABLE IF NOT EXISTS user_activity_days (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  day_key INTEGER NOT NULL,
  source TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(user_id, day_key),
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS question_snapshots (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  scope TEXT NOT NULL,
  session_id TEXT,
  source_id TEXT,
  word_id TEXT NOT NULL,
  options_json TEXT NOT NULL,
  answer_index INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  answered_at INTEGER,
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(session_id) REFERENCES assessment_sessions(id),
  FOREIGN KEY(word_id) REFERENCES words(id)
);
CREATE INDEX IF NOT EXISTS idx_question_snapshots_session ON question_snapshots(session_id);
CREATE INDEX IF NOT EXISTS idx_question_snapshots_source ON question_snapshots(source_id);

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
