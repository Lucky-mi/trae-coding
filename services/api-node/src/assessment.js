export function sortLevels(levels) {
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

function levenshtein(a, b) {
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

export function buildSingleMcq({ wordRow, pool, rng }) {
  const posStr = wordRow.pos ? ` //${wordRow.pos}//` : ''
  const phonStr = wordRow.phonetic ? ` //${wordRow.phonetic}//` : ''
  const stem = `“${wordRow.word}${phonStr}${posStr}” 的中文意思是？`
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

  const options = [...outMeanings, correct]
  shuffle(options, rng)

  return {
    id: wordRow.id,
    stem,
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
