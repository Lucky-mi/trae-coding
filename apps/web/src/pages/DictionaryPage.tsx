import { useEffect, useState } from 'react'
import { searchWords, getMistakes } from '../api/client'
import type { WordEntry } from '../api/client'
import AppShell from '../components/AppShell'

type DictEntryData = {
  meanings: Array<{
    partOfSpeech: string
    definitions: Array<{ definition: string; example?: string }>
  }>
}

function WordRow({ w }: { w: WordEntry }) {
  const [expanded, setExpanded] = useState(false)
  const [dictData, setDictData] = useState<DictEntryData | null>(null)
  const [loadingDict, setLoadingDict] = useState(false)

  async function playTTS(text: string) {
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'en-US'
    utterance.rate = 0.9
    window.speechSynthesis.speak(utterance)
  }

  async function toggleExpand() {
    setExpanded(!expanded)
    if (!expanded && !dictData && !loadingDict) {
      setLoadingDict(true)
      try {
        const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${w.word}`)
        if (res.ok) {
          const data = await res.json()
          setDictData(data[0])
        }
      } catch (e) {
        console.error(e)
      } finally {
        setLoadingDict(false)
      }
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-panel-900 p-6 shadow-glow backdrop-blur transition hover:bg-white/5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold text-white">{w.word}</span>
            <button
              onClick={() => playTTS(w.word)}
              className="flex h-6 w-6 items-center justify-center rounded-full bg-white/5 text-brand-300 transition hover:bg-white/10 hover:text-brand-200"
              title="播放发音"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3">
                <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 001.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06zM18.584 5.106a.75.75 0 011.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 11-1.06-1.06 8.25 8.25 0 000-11.668.75.75 0 010-1.06z" />
                <path d="M15.932 7.757a.75.75 0 011.061 0 6 6 0 010 8.486.75.75 0 01-1.06-1.061 4.5 4.5 0 000-6.364.75.75 0 010-1.06z" />
              </svg>
            </button>
            {w.phonetic && <span className="text-sm text-white/40 font-mono">/{w.phonetic}/</span>}
          </div>
          <div className="mt-2 flex items-start gap-2">
            {w.pos && <span className="text-sm font-semibold text-brand-400">{w.pos}.</span>}
            <span className="text-sm text-white/80">{w.meaning_zh}</span>
          </div>
        </div>
        <div className="text-right flex flex-col items-end gap-2">
          <div className="text-xs text-white/40">{w.stage} {w.level || ''}</div>
          {w.fail_count !== undefined && (
            <div className="inline-flex items-center gap-1 rounded bg-red-500/20 px-2 py-1 text-xs font-medium text-red-400">
              答错 {w.fail_count} 次
            </div>
          )}
          <button
            onClick={toggleExpand}
            className="text-xs text-brand-300 hover:text-brand-200 transition underline mt-1"
          >
            {expanded ? '收起语境' : '查看语境例句'}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-2 rounded-xl bg-black/20 p-4 border border-white/5">
          {loadingDict ? (
            <div className="text-xs text-white/50">正在拉取在线词典数据...</div>
          ) : dictData ? (
            <div className="space-y-4">
              {dictData.meanings.slice(0, 2).map((m, i) => (
                <div key={i}>
                  <div className="text-xs font-bold text-brand-400/80 mb-1 italic">{m.partOfSpeech}</div>
                  <ul className="list-inside list-disc space-y-2 text-sm text-white/70">
                    {m.definitions.slice(0, 2).map((d, j) => (
                      <li key={j}>
                        <span>{d.definition}</span>
                        {d.example && (
                          <div className="mt-1 text-brand-200/80 italic">"{d.example}"</div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-white/50">暂无该词汇的在线语境数据</div>
          )}
        </div>
      )}
    </div>
  )
}

export default function DictionaryPage() {
  const [activeTab, setActiveTab] = useState<'mistakes' | 'search'>('mistakes')
  const [words, setWords] = useState<WordEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (activeTab === 'mistakes') {
      setLoading(true)
      getMistakes().then(data => {
        setWords(data)
        setLoading(false)
      }).catch(() => setLoading(false))
    } else {
      if (!query.trim()) {
        setWords([])
        return
      }
      setLoading(true)
      searchWords(query).then(data => {
        setWords(data)
        setLoading(false)
      }).catch(() => setLoading(false))
    }
  }, [activeTab, query])

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h1 className="text-2xl font-bold text-white">词汇中心</h1>
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 p-1 backdrop-blur">
            <button
              onClick={() => setActiveTab('mistakes')}
              className={`rounded-full px-6 py-2 text-sm font-medium transition ${
                activeTab === 'mistakes' ? 'bg-brand-500 text-white shadow-glow' : 'text-white/60 hover:text-white/80'
              }`}
            >
              我的错题本
            </button>
            <button
              onClick={() => setActiveTab('search')}
              className={`rounded-full px-6 py-2 text-sm font-medium transition ${
                activeTab === 'search' ? 'bg-brand-500 text-white shadow-glow' : 'text-white/60 hover:text-white/80'
              }`}
            >
              全库搜索
            </button>
          </div>
        </div>

        {activeTab === 'search' && (
          <div className="mt-8">
            <input
              type="text"
              placeholder="输入英文或中文释义搜索..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-panel-900 px-6 py-4 text-white placeholder-white/30 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 shadow-glow backdrop-blur"
            />
          </div>
        )}

        <div className="mt-8 grid gap-4">
          {loading ? (
            <div className="text-white/50 text-center py-12">加载中...</div>
          ) : words.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center text-white/50">
              {activeTab === 'mistakes' ? '太棒了，你目前没有错题记录！' : '输入关键词开始搜索词库'}
            </div>
          ) : (
            words.map((w) => (
              <WordRow key={w.id} w={w} />
            ))
          )}
        </div>
      </div>
    </AppShell>
  )
}
