import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'node:crypto'

const JWT_SECRET = process.env.JWT_SECRET || 'wordgauge-v1-secret-key-change-me'

export function registerHandler(db) {
  return (req, res) => {
    const { username, password } = req.body
    if (!username || !password) {
      return res.status(400).json({ detail: '用户名和密码不能为空' })
    }

    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username)
    if (existing) {
      return res.status(400).json({ detail: '用户名已被注册' })
    }

    const hash = bcrypt.hashSync(password, 10)
    const id = crypto.randomUUID()
    db.prepare('INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)').run(id, username, hash, Date.now())

    const token = jwt.sign({ sub: id, username }, JWT_SECRET, { expiresIn: '7d' })
    res.json({ ok: true, token, user: { id, username } })
  }
}

export function loginHandler(db) {
  return (req, res) => {
    const { username, password } = req.body
    if (!username || !password) {
      return res.status(400).json({ detail: '用户名和密码不能为空' })
    }

    const user = db.prepare('SELECT id, username, password_hash FROM users WHERE username = ?').get(username)
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ detail: '用户名或密码错误' })
    }

    const token = jwt.sign({ sub: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' })
    res.json({ ok: true, token, user: { id: user.id, username: user.username } })
  }
}

export function requireAuth(req, res, next) {
  const auth = req.headers.authorization || ''
  const token = auth.replace(/^Bearer\s+/i, '')
  if (!token) {
    return res.status(401).json({ detail: '未登录或 Token 缺失' })
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET)
    req.user = { id: payload.sub, username: payload.username }
    next()
  } catch (e) {
    res.status(401).json({ detail: '登录已过期，请重新登录' })
  }
}
