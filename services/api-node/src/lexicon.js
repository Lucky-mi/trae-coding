import fs from 'node:fs'
import path from 'node:path'
import xlsx from 'xlsx'

export function defaultXlsxPaths(projectRoot) {
  return [
    path.join(projectRoot, '京师小学考纲.xlsx'),
    path.join(projectRoot, '京师初中考纲（不含小学）.xlsx'),
    path.join(projectRoot, '京师高中考纲（不含初中）.xlsx'),
  ]
}

export function inferStageFromFilename(name) {
  if (name.includes('高中')) return '高中'
  if (name.includes('初中')) return '初中'
  if (name.includes('小学')) return '小学'
  return '未知'
}

export function loadLexicon(projectRoot) {
  const out = []
  for (const p of defaultXlsxPaths(projectRoot)) {
    if (!fs.existsSync(p)) {
      console.log('Missing file:', p)
      continue
    }
    const stage = inferStageFromFilename(path.basename(p))
    const items = loadXlsx(p, stage)
    console.log(`Loaded ${items.length} items for stage ${stage} from ${path.basename(p)}`)
    out.push(...items)
  }
  return assignLevels(dedupItems(out), projectRoot)
}

function loadXlsx(filePath, stage) {
  const wb = xlsx.readFile(filePath, { cellDates: false })
  const out = []
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName]
    if (!ws) continue
    const rows = xlsx.utils.sheet_to_json(ws, { defval: null })
    if (!rows.length) continue
    const columns = normalizeColumns(Object.keys(rows[0] || {}))
    const colWord = pickCol(columns, ['word', '单词', '词汇', '英文'])
    if (!colWord) {
      console.log('Skipping sheet', sheetName, 'because no word column found in', columns)
      continue
    }
    const colMeaning = pickCol(columns, [
      'meaning_zh',
      '译文',
      '中文',
      '释义',
      '中文释义',
      '翻译',
      '意义',
    ])
    const colLevel = pickCol(columns, ['level', '级', '等级', '层级'])
    const colPos = pickCol(columns, ['pos', '词性'])
    const colPhonetic = pickCol(columns, ['phonetic', '音标', '音标(英)', '音标(美)'])

    for (const raw of rows) {
      const row = normalizeRowKeys(raw)
      const w0 = asStr(row[colWord])
      if (!w0) continue
      const word = cleanWord(w0)
      const meaning = colMeaning ? asStr(row[colMeaning]) : ''
      const level = colLevel ? normalizeLevel(asStr(row[colLevel])) : ''
      const phonetic = colPhonetic ? normalizePhonetic(asStr(row[colPhonetic])) : ''
      const pos =
        (colPos ? normalizePos(asStr(row[colPos])) : '') ||
        (meaning ? extractPosFromMeaning(meaning) : '')
      out.push({
        word,
        meaning_zh: meaning || null,
        stage,
        level: level || null,
        pos: pos || null,
        phonetic: phonetic || null,
      })
    }
  }
  return out
}

function normalizeColumns(cols) {
  return cols.map((c) =>
    asStr(c).replace(/\r|\n/g, '').trim().replace(/\s+/g, ''),
  )
}

function normalizeRowKeys(row) {
  const out = {}
  for (const [k, v] of Object.entries(row)) {
    const nk = asStr(k).replace(/\r|\n/g, '').trim().replace(/\s+/g, '')
    out[nk] = v
  }
  return out
}

function pickCol(cols, candidates) {
  for (const c of candidates) {
    const exact = cols.find((col) => col.toLowerCase() === c.toLowerCase())
    if (exact) return exact
  }
  for (const col of cols) {
    for (const c of candidates) {
      if (col.toLowerCase().includes(c.toLowerCase())) return col
    }
  }
  return null
}

function asStr(v) {
  if (v == null) return ''
  const s = String(v).trim()
  if (!s) return ''
  const low = s.toLowerCase()
  if (low === 'nan' || low === 'none' || low === 'null') return ''
  return s
}

function cleanWord(v) {
  return v.trim()
}

function normalizeLevel(v) {
  const s = v.trim()
  if (!s) return s
  const s2 = s.replace('级别', '级').replace('等级', '级')
  const m = /(小学|初中|高中)?\s*(\d+)\s*级/.exec(s2)
  if (m) {
    const n = Number(m[2])
    const prefix = m[1]
    return prefix ? `${prefix} ${n}级` : `${n}级`
  }
  const m2 = /(\d+)/.exec(s2)
  if (m2) return `${Number(m2[1])}级`
  return s2
}

function normalizePos(v) {
  const s = v.trim().toLowerCase()
  return s
    .replaceAll('名词', 'n')
    .replaceAll('动词', 'v')
    .replaceAll('形容词', 'adj')
    .replaceAll('副词', 'adv')
}

function normalizePhonetic(v) {
  const s = v.trim()
  if (!s) return s
  if (s.startsWith('/') && s.endsWith('/') && s.length >= 2) return s.slice(1, -1)
  return s
}

function extractPosFromMeaning(meaning) {
  const m = /^\s*([a-zA-Z]{1,5})\./.exec(meaning)
  if (!m) return ''
  const raw = m[1].toLowerCase()
  const known = new Set([
    'n',
    'v',
    'vi',
    'vt',
    'adj',
    'adv',
    'prep',
    'conj',
    'pron',
    'num',
    'art',
    'interj',
    'aux',
  ])
  if (!known.has(raw)) return raw
  return raw
}

function dedupItems(items) {
  const seen = new Set()
  const out = []
  for (const it of items) {
    const k = `${it.stage}::${it.word.toLowerCase()}`
    if (seen.has(k)) continue
    seen.add(k)
    out.push(it)
  }
  return out
}

function assignLevels(items, projectRoot) {
  const txtPath = path.join(projectRoot, 'services/api-node/data/freq-10k.txt')
  const fMap = new Map()
  try {
    const content = fs.readFileSync(txtPath, 'utf8')
    const lines = content.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const w = lines[i].trim().toLowerCase()
      if (w && !fMap.has(w)) {
        fMap.set(w, i + 1)
      }
    }
  } catch (e) {
    console.error('Failed to load freq map', e)
  }

  function getRank(w) {
    const wLow = w.toLowerCase()
    if (fMap.has(wLow)) return fMap.get(wLow)
    return 10000 + wLow.length * 100
  }

  function getCEFR(rank) {
    if (rank <= 1500) return 'A1 (入门)'
    if (rank <= 3000) return 'A2 (初级)'
    if (rank <= 5000) return 'B1 (中级)'
    if (rank <= 8000) return 'B2 (中高级)'
    if (rank <= 12000) return 'C1 (高级)'
    return 'C2 (精通)'
  }

  for (const it of items) {
    const r = getRank(it.word)
    it.level = getCEFR(r)
  }
  return items
}
