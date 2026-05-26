import crypto from 'node:crypto'

function stringify(payload) {
  try {
    return JSON.stringify(payload)
  } catch {
    return JSON.stringify({ level: 'error', event: 'logger_stringify_failed' })
  }
}

export function logEvent(level, event, payload = {}) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    event,
    ...payload,
  }
  const line = stringify(entry)
  if (level === 'error') {
    console.error(line)
    return
  }
  if (level === 'warn') {
    console.warn(line)
    return
  }
  console.log(line)
}

export function requestLogger(req, res, next) {
  req.requestId = crypto.randomUUID().slice(0, 8)
  req.requestStartedAt = Date.now()

  logEvent('info', 'request_started', {
    req_id: req.requestId,
    method: req.method,
    path: req.path,
    ip: req.ip,
  })

  res.on('finish', () => {
    logEvent('info', 'request_finished', {
      req_id: req.requestId,
      method: req.method,
      path: req.path,
      status_code: res.statusCode,
      duration_ms: Date.now() - req.requestStartedAt,
      user_id: req.user?.id || null,
    })
  })

  next()
}

export function requestMeta(req, extra = {}) {
  return {
    req_id: req.requestId,
    method: req.method,
    path: req.path,
    user_id: req.user?.id || null,
    username: req.user?.username || null,
    ...extra,
  }
}
