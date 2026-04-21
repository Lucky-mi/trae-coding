import jwt from 'jsonwebtoken'
const JWT_SECRET = process.env.JWT_SECRET || 'wordgauge-v1-secret-key-change-me'
const token = jwt.sign({ sub: 'sys', username: 'sys' }, JWT_SECRET, { expiresIn: '1h' })
console.log(token)
