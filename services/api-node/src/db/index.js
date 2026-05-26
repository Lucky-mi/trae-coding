import Database from 'better-sqlite3'
import crypto from 'node:crypto'
import { schemaSQL } from './schema.js'
import { seedAchievements } from '../progress.js'

function hasColumn(db, table, column) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all()
  return columns.some((item) => item.name === column)
}

function ensureColumn(db, table, column, definition) {
  if (!hasColumn(db, table, column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
  }
}

export function initDB(dbPath) {
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.exec(schemaSQL)

  ensureColumn(db, 'users', 'exp', 'INTEGER NOT NULL DEFAULT 0')
  ensureColumn(db, 'users', 'role', "TEXT NOT NULL DEFAULT 'user'")
  ensureColumn(db, 'users', 'streak_days', 'INTEGER NOT NULL DEFAULT 0')
  ensureColumn(db, 'users', 'last_active_at', 'INTEGER')
  ensureColumn(db, 'assessment_sessions', 'time_limit_sec', 'INTEGER')
  ensureColumn(db, 'assessment_sessions', 'started_at', 'INTEGER NOT NULL DEFAULT 0')
  ensureColumn(db, 'assessment_sessions', 'ended_by', 'TEXT')
  ensureColumn(db, 'assessment_sessions', 'guest_id', 'TEXT')

  db.prepare("UPDATE users SET role = 'user' WHERE role IS NULL OR role = ''").run()
  const hasAdmin = db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'admin'").get().c > 0
  if (!hasAdmin) {
    db.prepare("UPDATE users SET role = 'admin' WHERE id = (SELECT id FROM users ORDER BY created_at ASC LIMIT 1)").run()
  }

  db.prepare('UPDATE assessment_sessions SET started_at = created_at WHERE started_at = 0').run()

  const hasRuleset = db.prepare('SELECT COUNT(*) AS c FROM rulesets').get().c > 0
  if (!hasRuleset) {
    const now = Date.now()
    const defaultRuleset = {
      srs_intervals_days: [0, 1, 3, 7, 15, 30, 90, 180],
      assessment_exp_correct: 10,
      review_exp_correct: 5,
      irt_se_threshold: 0.35,
      irt_min_answers_before_converge: 10,
      anti_cheat_fast_answer_ms: 800,
    }
    db.prepare(`
      INSERT INTO rulesets (id, name, is_active, config_json, created_at, updated_at)
      VALUES (?, ?, 1, ?, ?, ?)
    `).run(
      crypto.randomUUID(),
      'default',
      JSON.stringify(defaultRuleset),
      now,
      now,
    )
  }

  seedAchievements(db)

  return db
}
