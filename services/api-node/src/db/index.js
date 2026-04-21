import Database from 'better-sqlite3'
import path from 'node:path'
import { schemaSQL } from './schema.js'

export function initDB(dbPath) {
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.exec(schemaSQL)
  return db
}
