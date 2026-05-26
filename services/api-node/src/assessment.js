export function sortLevels(levels) {
  function getCefrRank(lv) {
    const s = String(lv || '').trim()
    if (s.startsWith('A1')) return 1
    if (s.startsWith('A2')) return 2
    if (s.startsWith('B1')) return 3
    if (s.startsWith('B2')) return 4
    if (s.startsWith('C1')) return 5
    if (s.startsWith('C2')) return 6
    return 99
  }

  return [...levels].sort((a, b) => {
    return getCefrRank(a) - getCefrRank(b)
  })
}

export function levenshtein(a, b) {
  const matrix = Array(a.length + 1).fill(null).map(() => Array(b.length + 1).fill(null))
  for (let i = 0; i <= a.length; i += 1) matrix[i][0] = i
  for (let j = 0; j <= b.length; j += 1) matrix[0][j] = j
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const indicator = a[i - 1] === b[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + indicator
      )
    }
  }
  return matrix[a.length][b.length]
}

function normalizeWordShape(word) {
  return String(word || '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')
    .replace(/[^a-z]/g, '')
    .trim()
}

function relatedReason(base, candidate, dist) {
  const reasons = []
  if (candidate.pos && base.pos && candidate.pos === base.pos) reasons.push('同词性')
  if (dist <= 2) reasons.push('拼写极近')
  else if (dist <= 4) reasons.push('词形相近')
  if ((candidate.meaning_zh || '').includes('n.') && (base.meaning_zh || '').includes('n.')) reasons.push('语义类别接近')
  return reasons.join(' · ') || '容易混淆'
}

function splitMeaningParts(meaning) {
  return String(meaning || '')
    .replace(/[.;；]/g, ',')
    .split(/[,，/]/)
    .map((item) => item.replace(/^n\.|^v\.|^adj\.|^adv\./i, '').trim())
    .filter(Boolean)
}

function formatShapeDiff(a, b) {
  const aNorm = normalizeWordShape(a)
  const bNorm = normalizeWordShape(b)
  if (aNorm === bNorm) return '词形几乎一致'
  if (aNorm.startsWith(bNorm) || bNorm.startsWith(aNorm)) return '一个更像另一个的完整写法'
  return '词形和拼写非常接近'
}

export function findRelatedWords({ wordRow, pool, limit = 6 }) {
  const baseShape = normalizeWordShape(wordRow.word)
  const scored = pool
    .filter((x) => x.id !== wordRow.id && x.word && x.meaning_zh)
    .map((x) => {
      const candidateShape = normalizeWordShape(x.word)
      const dist = levenshtein(baseShape, candidateShape)
      let score = dist
      if (wordRow.pos && x.pos === wordRow.pos) score -= 2
      if (x.stage === wordRow.stage) score -= 1
      return {
        ...x,
        _distance: dist,
        _score: score,
      }
    })
    .sort((a, b) => a._score - b._score)
    .slice(0, limit)

  return scored.map((item) => ({
    id: item.id,
    word: item.word,
    meaning_zh: item.meaning_zh,
    phonetic: item.phonetic || null,
    pos: item.pos || null,
    stage: item.stage || null,
    level: item.level || null,
    similarity_score: Math.max(0, 100 - item._distance * 12),
    reason: relatedReason(wordRow, item, item._distance),
  }))
}

export function buildContrastAnalysis(baseWord, targetWord) {
  const dist = levenshtein(normalizeWordShape(baseWord.word), normalizeWordShape(targetWord.word))
  const baseMeanings = splitMeaningParts(baseWord.meaning_zh)
  const targetMeanings = splitMeaningParts(targetWord.meaning_zh)
  const sharedMeanings = baseMeanings.filter((item) => targetMeanings.includes(item))

  const bullets = [
    `${baseWord.word} 表示「${baseWord.meaning_zh}」`,
    `${targetWord.word} 表示「${targetWord.meaning_zh}」`,
    formatShapeDiff(baseWord.word, targetWord.word),
  ]
  if (baseWord.pos && targetWord.pos && baseWord.pos === targetWord.pos) {
    bullets.push(`两者都常见于 ${baseWord.pos} 词性，做题时更容易混淆`)
  }
  if (sharedMeanings.length > 0) {
    bullets.push(`它们都涉及「${sharedMeanings.join(' / ')}」这一语义范围`)
  } else {
    bullets.push('它们中文释义不同，辨析时先抓住中文核心含义')
  }

  const memoryTip = sharedMeanings.length > 0
    ? `记忆时把 ${baseWord.word} 和 ${targetWord.word} 放进同一语义家族对照记。`
    : `记忆时先固定 ${baseWord.word} 的核心中文，再和 ${targetWord.word} 做对照。`

  return {
    similarity_score: Math.max(0, 100 - dist * 12),
    reason: relatedReason(baseWord, targetWord, dist),
    bullets,
    memory_tip: memoryTip,
  }
}

export function buildSingleMcq({ wordRow, pool, rng }) {
  const correct = wordRow.meaning_zh

  // Pool contains { id, word, meaning_zh, pos }
  const cand = pool.filter(x => x.id !== wordRow.id && x.meaning_zh && x.meaning_zh !== correct)

  // Calculate scores: lower is better (more similar shape = stronger distractor)
  for (const x of cand) {
    let score = levenshtein(wordRow.word.toLowerCase(), x.word.toLowerCase())
    if (wordRow.pos && x.pos === wordRow.pos) {
      score -= 3 // Bonus for matching Part of Speech
    }
    x._score = score
  }

  cand.sort((a, b) => a._score - b._score)

  const outMeanings = []
  for (const x of cand) {
    if (!outMeanings.includes(x.meaning_zh)) {
      outMeanings.push(x.meaning_zh)
    }
    if (outMeanings.length >= 3) break
  }

  while (outMeanings.length < 3 && cand.length > 0) {
    const p = cand[Math.floor(rng() * cand.length)]
    if (!outMeanings.includes(p.meaning_zh)) outMeanings.push(p.meaning_zh)
  }

  const options = Array.from(new Set([...outMeanings, correct]))
  while(options.length < 4 && cand.length > 0) {
     const p = cand[Math.floor(rng() * cand.length)]
     if (!options.includes(p.meaning_zh)) options.push(p.meaning_zh)
  }
  
  shuffle(options, rng)

  return {
    id: wordRow.id,
    word: wordRow.word,
    phonetic: wordRow.phonetic || null,
    pos: wordRow.pos || null,
    options,
    answerIndex: options.indexOf(correct),
    level: wordRow.level || null,
    kind: 'mcq',
  }
}

export function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    const t = arr[i]
    arr[i] = arr[j]
    arr[j] = t
  }
  return arr
}

export function getMulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
