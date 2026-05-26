import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'node:crypto'
import { logEvent, requestMeta } from './logger.js'
import { getUserProgressSummary } from './progress.js'

const JWT_SECRET = process.env.JWT_SECRET || 'wordgauge-v1-secret-key-change-me'
const ACCESS_TOKEN_EXPIRES_IN = '7d'
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex')
}

function issueTokens(db, user) {
  const token = jwt.sign({ sub: user.id, username: user.username }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES_IN })
  const refreshToken = crypto.randomUUID() + crypto.randomUUID()
  const now = Date.now()
  db.prepare(`
    INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at, revoked_at)
    VALUES (?, ?, ?, ?, ?, NULL)
  `).run(
    crypto.randomUUID(),
    user.id,
    sha256(refreshToken),
    now + REFRESH_TOKEN_TTL_MS,
    now,
  )
  return { token, refreshToken }
}

export function registerHandler(db) {
  return (req, res) => {
    const { username, password } = req.body
    logEvent('info', 'auth_register_attempt', requestMeta(req, { register_username: username || null }))
    if (!username || !password) {
      logEvent('warn', 'auth_register_invalid_payload', requestMeta(req, { register_username: username || null }))
      return res.status(400).json({ detail: '用户名和密码不能为空' })
    }

    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username)
    if (existing) {
      logEvent('warn', 'auth_register_duplicate_username', requestMeta(req, { register_username: username }))
      return res.status(400).json({ detail: '用户名已被注册' })
    }

    const hash = bcrypt.hashSync(password, 10)
    const id = crypto.randomUUID()
    const role = db.prepare('SELECT COUNT(*) AS c FROM users').get().c === 0 ? 'admin' : 'user'
    db.prepare('INSERT INTO users (id, username, password_hash, created_at, exp, role, streak_days, last_active_at) VALUES (?, ?, ?, ?, 0, ?, 0, NULL)').run(
      id,
      username,
      hash,
      Date.now(),
      role,
    )

    const { token, refreshToken } = issueTokens(db, { id, username })
    logEvent('info', 'auth_register_success', requestMeta(req, { created_user_id: id, register_username: username, role }))
    res.json({ ok: true, token, refresh_token: refreshToken, user: { id, username, exp: 0, role, streak_days: 0, achievement_count: 0 } })
  }
}

export function loginHandler(db) {
  return (req, res) => {
    const { username, password } = req.body
    logEvent('info', 'auth_login_attempt', requestMeta(req, { login_username: username || null }))
    if (!username || !password) {
      logEvent('warn', 'auth_login_invalid_payload', requestMeta(req, { login_username: username || null }))
      return res.status(400).json({ detail: '用户名和密码不能为空' })
    }

    const user = db.prepare('SELECT id, username, password_hash, exp, role, streak_days FROM users WHERE username = ?').get(username)
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      logEvent('warn', 'auth_login_failed', requestMeta(req, { login_username: username || null }))
      return res.status(401).json({ detail: '用户名或密码错误' })
    }

    const { token, refreshToken } = issueTokens(db, user)
    logEvent('info', 'auth_login_success', requestMeta(req, { login_username: username, login_user_id: user.id, role: user.role || 'user' }))
    const summary = getUserProgressSummary(db, user.id)
    res.json({ ok: true, token, refresh_token: refreshToken, user: { id: user.id, username: user.username, exp: user.exp || 0, role: user.role || 'user', streak_days: summary.streak_days, achievement_count: summary.achievement_count } })
  }
}

export function refreshHandler(db) {
  return (req, res) => {
    const refreshToken = String(req.body?.refresh_token || '').trim()
    if (!refreshToken) {
      return res.status(400).json({ detail: 'refresh token required' })
    }
    const tokenHash = sha256(refreshToken)
    const row = db.prepare(`
      SELECT rt.*, u.username, u.role, u.exp
      FROM refresh_tokens rt
      JOIN users u ON rt.user_id = u.id
      WHERE rt.token_hash = ? AND rt.revoked_at IS NULL
    `).get(tokenHash)
    if (!row || row.expires_at < Date.now()) {
      logEvent('warn', 'auth_refresh_failed', requestMeta(req))
      return res.status(401).json({ detail: 'refresh token invalid or expired' })
    }

    db.prepare('UPDATE refresh_tokens SET revoked_at = ? WHERE id = ?').run(Date.now(), row.id)
    const issued = issueTokens(db, { id: row.user_id, username: row.username })
    logEvent('info', 'auth_refresh_success', requestMeta(req, { refresh_user_id: row.user_id }))
    res.json({
      ok: true,
      token: issued.token,
      refresh_token: issued.refreshToken,
      user: { id: row.user_id, username: row.username, exp: row.exp || 0, role: row.role || 'user', ...getUserProgressSummary(db, row.user_id) },
    })
  }
}

export function logoutHandler(db) {
  return (req, res) => {
    const refreshToken = String(req.body?.refresh_token || '').trim()
    if (refreshToken) {
      db.prepare('UPDATE refresh_tokens SET revoked_at = ? WHERE token_hash = ?').run(Date.now(), sha256(refreshToken))
    }
    logEvent('info', 'auth_logout', requestMeta(req))
    res.json({ ok: true })
  }
}

export function requireAuth(req, res, next) {
  const auth = req.headers.authorization || ''
  const token = auth.replace(/^Bearer\s+/i, '')
  if (!token) {
    logEvent('warn', 'auth_missing_token', requestMeta(req))
    return res.status(401).json({ detail: '未登录或 Token 缺失' })
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET)
    req.user = { id: payload.sub, username: payload.username }
    logEvent('info', 'auth_token_verified', requestMeta(req))
    next()
  } catch (e) {
    logEvent('warn', 'auth_token_invalid', requestMeta(req, { reason: e?.message || 'verify_failed' }))
    res.status(401).json({ detail: '登录已过期，请重新登录' })
  }
}

export function optionalAuth(req, _res, next) {
  const auth = req.headers.authorization || ''
  const token = auth.replace(/^Bearer\s+/i, '')
  if (!token) return next()
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    req.user = { id: payload.sub, username: payload.username }
  } catch {
    req.user = undefined
  }
  next()
}

export function requireAdmin(db) {
  return (req, res, next) => {
    const user = db.prepare('SELECT id, role FROM users WHERE id = ?').get(req.user.id)
    if (!user || user.role !== 'admin') {
      logEvent('warn', 'auth_admin_denied', requestMeta(req, { role: user?.role || null }))
      return res.status(403).json({ detail: '需要管理员权限' })
    }
    logEvent('info', 'auth_admin_granted', requestMeta(req, { role: user.role }))
    next()
  }
}

export function meHandler(db) {
  return (req, res) => {
    const user = db.prepare('SELECT id, username, exp, role FROM users WHERE id = ?').get(req.user.id)
    const summary = getUserProgressSummary(db, req.user.id)
    logEvent('info', 'auth_me_fetched', requestMeta(req, { role: user.role || 'user', exp: user.exp || 0, streak_days: summary.streak_days, achievement_count: summary.achievement_count }))
    res.json({ id: user.id, username: user.username, exp: user.exp || 0, role: user.role || 'user', streak_days: summary.streak_days, achievement_count: summary.achievement_count })
  }
}
