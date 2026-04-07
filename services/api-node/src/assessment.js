function sortLevels(levels) {
  function key(lv) {
    const s = String(lv || '').trim()
    let stageRank = 9
    if (s.startsWith('小学')) stageRank = 1
    else if (s.startsWith('初中')) stageRank = 2
    else if (s.startsWith('高中')) stageRank = 3
    let num = 999
    for (const token of s.split(/\s+/)) {
      if (token.endsWith('级')) {
        const t = token.slice(0, -1)
        if (/^\d+$/.test(t)) num = Number(t)
      }
    }
    return [stageRank, num, s]
  }

  return [...levels].sort((a, b) => {
    const ka = key(a)
    const kb = key(b)
    for (let i = 0; i < ka.length; i += 1) {
      if (ka[i] < kb[i]) return -1
      if (ka[i] > kb[i]) return 1
    }
    return 0
  })
}

export function buildQuiz({ stage, perLevelCount, items, rng }) {
  const pool = items.filter((x) => x.stage === stage && x.meaning_zh)
  if (!pool.length) {
    const err = new Error(`no words for stage=${stage}`)
    err.statusCode = 400
    throw err
  }

  const levelMap = new Map()
  for (const it of pool) {
    const level = it.level || '未知'
    if (!levelMap.has(level)) levelMap.set(level, [])
    levelMap.get(level).push(it)
  }

  const levels = sortLevels([...levelMap.keys()])
  const picked = []
  for (const lv of levels) {
    const group = levelMap.get(lv) || []
    shuffle(group, rng)
    picked.push(...group.slice(0, Math.min(perLevelCount, group.length)))
  }

  if (!picked.length) {
    shuffle(pool, rng)
    picked.push(...pool.slice(0, Math.min(perLevelCount * 6, pool.length)))
  }

  return picked.map((it, idx) => buildMcq({ it, pool, qIndex: idx, rng }))
}

export function summarizeByLevel(questions, answers) {
  const m = new Map()
  for (let i = 0; i < questions.length; i += 1) {
    const q = questions[i]
    const level = q.level || '未知'
    const cur = m.get(level) || { total: 0, correct: 0 }
    cur.total += 1
    if (i < answers.length && answers[i] === q.answerIndex) cur.correct += 1
    m.set(level, cur)
  }
  return [...m.entries()].map(([level, v]) => ({ level, total: v.total, correct: v.correct }))
}

function buildMcq({ it, pool, qIndex, rng }) {
  const phonetic = it.phonetic ? ` //${it.phonetic}//` : ''
  const grammar = it.pos ? ` //${it.pos}//` : ''
  const stem = `“${it.word}${phonetic}${grammar}” 的中文意思是？`
  const correct = it.meaning_zh
  const distractors = pickDistractorsMeaning({ it, pool, rng, k: 3 })
  const options = [...distractors, correct]
  shuffle(options, rng)
  return {
    id: `q${qIndex + 1}`,
    stem,
    options,
    answerIndex: options.indexOf(correct),
    level: it.level || null,
    kind: 'mcq',
  }
}

function pickDistractorsMeaning({ it, pool, rng, k }) {
  const cand = pool.filter((x) => x.word.toLowerCase() !== it.word.toLowerCase() && x.meaning_zh)
  const samePos = cand.filter((x) => it.pos && x.pos === it.pos)
  const out = []
  shuffle(samePos, rng)
  for (const x of samePos) {
    if (x.meaning_zh && !out.includes(x.meaning_zh)) out.push(x.meaning_zh)
    if (out.length >= k) return out
  }
  shuffle(cand, rng)
  for (const x of cand) {
    if (x.meaning_zh && !out.includes(x.meaning_zh)) out.push(x.meaning_zh)
    if (out.length >= k) return out
  }
  while (out.length < k) {
    const p = pickOne(cand, rng)
    if (p?.meaning_zh && !out.includes(p.meaning_zh)) out.push(p.meaning_zh)
  }
  return out.slice(0, k)
}

function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    const t = arr[i]
    arr[i] = arr[j]
    arr[j] = t
  }
}

function pickOne(items, rng) {
  return items[Math.floor(rng() * items.length)]
}
