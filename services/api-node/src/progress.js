import crypto from 'node:crypto'

export const ACHIEVEMENT_DEFINITIONS = [
  {
    code: 'first_assessment_complete',
    title: '初次测评',
    description: '完成第一次正式词汇测评',
    icon: 'seedling',
    rarity: 'common',
    category: 'assessment',
  },
  {
    code: 'exp_100',
    title: '经验破百',
    description: '累计经验值达到 100',
    icon: 'sparkles',
    rarity: 'common',
    category: 'growth',
  },
  {
    code: 'streak_3',
    title: '三日连击',
    description: '连续学习 3 天',
    icon: 'flame',
    rarity: 'rare',
    category: 'streak',
  },
  {
    code: 'streak_7',
    title: '一周常青',
    description: '连续学习 7 天',
    icon: 'trophy',
    rarity: 'epic',
    category: 'streak',
  },
  {
    code: 'first_review_complete',
    title: '记忆回响',
    description: '完成第一次复习任务',
    icon: 'book-open',
    rarity: 'common',
    category: 'review',
  },
  {
    code: 'exp_300',
    title: '星火渐盛',
    description: '累计经验值达到 300',
    icon: 'stars',
    rarity: 'rare',
    category: 'growth',
  },
  {
    code: 'exp_1000',
    title: '枝叶繁茂',
    description: '累计经验值达到 1000',
    icon: 'crown',
    rarity: 'legendary',
    category: 'growth',
  },
  {
    code: 'assessment_5',
    title: '五次校准',
    description: '累计完成 5 次测评',
    icon: 'target',
    rarity: 'rare',
    category: 'assessment',
  },
  {
    code: 'review_20',
    title: '复习能手',
    description: '累计完成 20 次复习答题',
    icon: 'bolt',
    rarity: 'epic',
    category: 'review',
  },
  {
    code: 'accuracy_90',
    title: '精准猎手',
    description: '单次测评正确率达到 90%',
    icon: 'gem',
    rarity: 'epic',
    category: 'assessment',
  },
  {
    code: 'streak_14',
    title: '半月常青',
    description: '连续学习 14 天',
    icon: 'sun',
    rarity: 'legendary',
    category: 'streak',
  },
]

const ACHIEVEMENT_MAP = new Map(ACHIEVEMENT_DEFINITIONS.map((item) => [item.code, item]))

function getUtcDayNumber(ts) {
  return Math.floor(ts / 86400000)
}

export function seedAchievements(db) {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO achievements (id, code, title, description, icon, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  const now = Date.now()
  for (const item of ACHIEVEMENT_DEFINITIONS) {
    insert.run(crypto.randomUUID(), item.code, item.title, item.description, item.icon, now)
  }
}

export function touchUserActivity(db, userId, now = Date.now(), source = 'unknown') {
  const user = db.prepare('SELECT streak_days, last_active_at FROM users WHERE id = ?').get(userId)
  if (!user) return 0

  const today = getUtcDayNumber(now)
  const lastDay = user.last_active_at ? getUtcDayNumber(user.last_active_at) : null

  let streakDays = user.streak_days || 0
  if (lastDay === today) {
    return streakDays
  }
  if (lastDay === today - 1) {
    streakDays += 1
  } else {
    streakDays = 1
  }

  db.prepare('UPDATE users SET streak_days = ?, last_active_at = ? WHERE id = ?').run(streakDays, now, userId)
  db.prepare(`
    INSERT OR IGNORE INTO user_activity_days (id, user_id, day_key, source, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(crypto.randomUUID(), userId, today, source, now)
  return streakDays
}

function unlockAchievement(db, userId, code, meta = null, now = Date.now()) {
  const achievement = db.prepare('SELECT id, code, title, description, icon FROM achievements WHERE code = ?').get(code)
  if (!achievement) return null
  const result = db.prepare(`
    INSERT OR IGNORE INTO user_achievements (id, user_id, achievement_id, unlocked_at, meta_json)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    crypto.randomUUID(),
    userId,
    achievement.id,
    now,
    meta ? JSON.stringify(meta) : null,
  )
  if (!result.changes) return null
  return {
    ...achievement,
    rarity: ACHIEVEMENT_MAP.get(code)?.rarity || 'common',
    category: ACHIEVEMENT_MAP.get(code)?.category || 'growth',
  }
}

export function evaluateAchievements(db, userId, now = Date.now()) {
  const unlocked = []
  const user = db.prepare('SELECT exp, streak_days FROM users WHERE id = ?').get(userId)
  if (!user) return unlocked

  const completedAssessments = db.prepare(
    "SELECT COUNT(*) AS c FROM assessment_sessions WHERE user_id = ? AND status = 'completed'"
  ).get(userId).c
  const completedReviews = db.prepare('SELECT COUNT(*) AS c FROM user_activity_days WHERE user_id = ? AND source = ?').get(userId, 'review').c
  const bestAccuracy = db.prepare(`
    SELECT MAX(CAST(correct_count AS REAL) / NULLIF(total_count, 0)) AS best_accuracy
    FROM (
      SELECT session_id, SUM(is_correct) AS correct_count, COUNT(*) AS total_count
      FROM assessment_answers
      WHERE session_id IN (SELECT id FROM assessment_sessions WHERE user_id = ?)
      GROUP BY session_id
    )
  `).get(userId).best_accuracy || 0

  if (completedAssessments >= 1) {
    const item = unlockAchievement(db, userId, 'first_assessment_complete', null, now)
    if (item) unlocked.push(item)
  }
  if ((user.exp || 0) >= 100) {
    const item = unlockAchievement(db, userId, 'exp_100', { exp: user.exp }, now)
    if (item) unlocked.push(item)
  }
  if ((user.exp || 0) >= 300) {
    const item = unlockAchievement(db, userId, 'exp_300', { exp: user.exp }, now)
    if (item) unlocked.push(item)
  }
  if ((user.exp || 0) >= 1000) {
    const item = unlockAchievement(db, userId, 'exp_1000', { exp: user.exp }, now)
    if (item) unlocked.push(item)
  }
  if ((user.streak_days || 0) >= 3) {
    const item = unlockAchievement(db, userId, 'streak_3', { streak_days: user.streak_days }, now)
    if (item) unlocked.push(item)
  }
  if ((user.streak_days || 0) >= 7) {
    const item = unlockAchievement(db, userId, 'streak_7', { streak_days: user.streak_days }, now)
    if (item) unlocked.push(item)
  }
  if ((user.streak_days || 0) >= 14) {
    const item = unlockAchievement(db, userId, 'streak_14', { streak_days: user.streak_days }, now)
    if (item) unlocked.push(item)
  }
  if (completedAssessments >= 5) {
    const item = unlockAchievement(db, userId, 'assessment_5', { completed_assessments: completedAssessments }, now)
    if (item) unlocked.push(item)
  }
  if (completedReviews >= 1) {
    const item = unlockAchievement(db, userId, 'first_review_complete', { completed_reviews: completedReviews }, now)
    if (item) unlocked.push(item)
  }
  if (completedReviews >= 20) {
    const item = unlockAchievement(db, userId, 'review_20', { completed_reviews: completedReviews }, now)
    if (item) unlocked.push(item)
  }
  if (bestAccuracy >= 0.9) {
    const item = unlockAchievement(db, userId, 'accuracy_90', { best_accuracy: bestAccuracy }, now)
    if (item) unlocked.push(item)
  }

  return unlocked
}

export function getUserProgressSummary(db, userId) {
  const user = db.prepare('SELECT exp, streak_days, last_active_at FROM users WHERE id = ?').get(userId)
  if (!user) {
    return { exp: 0, streak_days: 0, achievement_count: 0, latest_achievements: [] }
  }

  const latestAchievements = db.prepare(`
    SELECT a.code, a.title, a.description, a.icon, ua.unlocked_at
    FROM user_achievements ua
    JOIN achievements a ON ua.achievement_id = a.id
    WHERE ua.user_id = ?
    ORDER BY ua.unlocked_at DESC
    LIMIT 6
  `).all(userId)
  const recentActivityDays = db.prepare(`
    SELECT day_key, source
    FROM user_activity_days
    WHERE user_id = ?
    ORDER BY day_key DESC
    LIMIT 21
  `).all(userId)

  return {
    exp: user.exp || 0,
    streak_days: user.streak_days || 0,
    last_active_at: user.last_active_at || null,
    achievement_count: db.prepare('SELECT COUNT(*) AS c FROM user_achievements WHERE user_id = ?').get(userId).c,
    latest_achievements: latestAchievements.map((item) => ({
      ...item,
      rarity: ACHIEVEMENT_MAP.get(item.code)?.rarity || 'common',
      category: ACHIEVEMENT_MAP.get(item.code)?.category || 'growth',
    })),
    recent_activity_days: recentActivityDays,
  }
}

export function getUserAchievements(db, userId) {
  const user = db.prepare('SELECT exp, streak_days FROM users WHERE id = ?').get(userId)
  if (!user) return []

  const completedAssessments = db.prepare(
    "SELECT COUNT(*) AS c FROM assessment_sessions WHERE user_id = ? AND status = 'completed'"
  ).get(userId).c
  const completedReviews = db.prepare('SELECT COUNT(*) AS c FROM user_activity_days WHERE user_id = ? AND source = ?').get(userId, 'review').c
  const bestAccuracy = db.prepare(`
    SELECT MAX(CAST(correct_count AS REAL) / NULLIF(total_count, 0)) AS best_accuracy
    FROM (
      SELECT session_id, SUM(is_correct) AS correct_count, COUNT(*) AS total_count
      FROM assessment_answers
      WHERE session_id IN (SELECT id FROM assessment_sessions WHERE user_id = ?)
      GROUP BY session_id
    )
  `).get(userId).best_accuracy || 0

  const all = db.prepare(`
    SELECT a.id, a.code, a.title, a.description, a.icon, ua.unlocked_at
    FROM achievements a
    LEFT JOIN user_achievements ua
      ON ua.achievement_id = a.id AND ua.user_id = ?
    ORDER BY a.created_at ASC
  `).all(userId)

  return all.map((item) => {
    const progress = getAchievementProgress(item.code, {
      exp: user.exp || 0,
      streak_days: user.streak_days || 0,
      completed_assessments: completedAssessments,
      completed_reviews: completedReviews,
      best_accuracy: bestAccuracy,
    })
    return {
      ...item,
      unlocked: !!item.unlocked_at,
      progress_current: progress.current,
      progress_target: progress.target,
      progress_label: progress.label,
      rarity: ACHIEVEMENT_MAP.get(item.code)?.rarity || 'common',
      category: ACHIEVEMENT_MAP.get(item.code)?.category || 'growth',
    }
  })
}

function getAchievementProgress(code, metrics) {
  switch (code) {
    case 'exp_100':
      return { current: Math.min(metrics.exp, 100), target: 100, label: `${metrics.exp}/100 Exp` }
    case 'exp_300':
      return { current: Math.min(metrics.exp, 300), target: 300, label: `${metrics.exp}/300 Exp` }
    case 'exp_1000':
      return { current: Math.min(metrics.exp, 1000), target: 1000, label: `${metrics.exp}/1000 Exp` }
    case 'streak_3':
      return { current: Math.min(metrics.streak_days, 3), target: 3, label: `${metrics.streak_days}/3 天` }
    case 'streak_7':
      return { current: Math.min(metrics.streak_days, 7), target: 7, label: `${metrics.streak_days}/7 天` }
    case 'streak_14':
      return { current: Math.min(metrics.streak_days, 14), target: 14, label: `${metrics.streak_days}/14 天` }
    case 'assessment_5':
      return { current: Math.min(metrics.completed_assessments, 5), target: 5, label: `${metrics.completed_assessments}/5 次测评` }
    case 'review_20':
      return { current: Math.min(metrics.completed_reviews, 20), target: 20, label: `${metrics.completed_reviews}/20 次复习` }
    case 'accuracy_90':
      return { current: Math.min(Math.round(metrics.best_accuracy * 100), 90), target: 90, label: `${Math.round(metrics.best_accuracy * 100)}%/90%` }
    case 'first_assessment_complete':
      return { current: Math.min(metrics.completed_assessments, 1), target: 1, label: `${metrics.completed_assessments}/1 次测评` }
    case 'first_review_complete':
      return { current: Math.min(metrics.completed_reviews, 1), target: 1, label: `${metrics.completed_reviews}/1 次复习` }
    default:
      return { current: 1, target: 1, label: '已达成' }
  }
}
