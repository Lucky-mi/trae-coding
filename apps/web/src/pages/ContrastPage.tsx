import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import AppShell from '../components/AppShell'
import { getWordContrast } from '../api/client'
import type { WordContrastOut } from '../api/client'

export default function ContrastPage() {
  const { wordId = '', otherId = '' } = useParams()
  const [data, setData] = useState<WordContrastOut | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    setError('')
    getWordContrast(wordId, otherId)
      .then(setData)
      .catch((err: Error) => setError(err.message || '加载辨析失败'))
      .finally(() => setLoading(false))
  }, [wordId, otherId])

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="rounded-[2rem] border border-white/10 bg-panel-900 p-6 shadow-glow backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-xs text-white/55">易混词辨析</div>
              <h1 className="mt-2 text-3xl font-semibold text-white">词语对照理解</h1>
              <p className="mt-2 text-sm text-white/60">不只告诉你“像”，还告诉你为什么像、该怎么记。</p>
            </div>
            <Link to="/dictionary" className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 hover:bg-white/10">
              返回词汇中心
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="text-sm text-white/55">正在生成辨析内容...</div>
        ) : error ? (
          <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 p-5 text-sm text-rose-100">{error}</div>
        ) : data ? (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              {[data.base_word, data.target_word].map((item, index) => (
                <div key={item.id} className={`rounded-[1.75rem] border p-5 backdrop-blur ${
                  index === 0 ? 'border-brand-400/20 bg-brand-400/10' : 'border-fuchsia-400/20 bg-fuchsia-400/10'
                }`}>
                  <div className="text-xs text-white/45">{index === 0 ? '当前词' : '对照词'}</div>
                  <div className="mt-2 text-2xl font-bold text-white">{item.word}</div>
                  {item.phonetic ? <div className="mt-1 font-mono text-sm text-white/45">/{item.phonetic}/</div> : null}
                  <div className="mt-4 flex items-start gap-2">
                    {item.pos ? <span className="text-sm font-semibold text-brand-200">{item.pos}.</span> : null}
                    <span className="text-sm text-white/80">{item.meaning_zh}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-panel-900 p-6 shadow-glow backdrop-blur">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">相似度分析</div>
                  <div className="mt-1 text-xs text-white/55">{data.reason}</div>
                </div>
                <div className="rounded-full border border-fuchsia-400/20 bg-fuchsia-400/10 px-4 py-2 text-sm text-fuchsia-100">
                  相似度 {data.similarity_score}%
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {data.bullets.map((item) => (
                  <div key={item} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">
                    {item}
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
                <div className="text-xs font-semibold text-emerald-200">记忆建议</div>
                <div className="mt-2 text-sm text-white/85">{data.memory_tip}</div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </AppShell>
  )
}
