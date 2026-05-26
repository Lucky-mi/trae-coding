import { useEffect, useMemo, useState } from 'react'
import AppShell from '../components/AppShell'
import { activateAdminRuleset, createAdminRuleset, getAdminRulesets } from '../api/client'
import { useAuth } from '../store/useAuth'

type RulesetItem = {
  id: string
  name: string
  is_active: number
  config: Record<string, unknown>
  created_at: number
  updated_at: number
}

const DEFAULT_RULESET = {
  srs_intervals_days: [0, 1, 3, 7, 15, 30, 90, 180],
  assessment_exp_correct: 10,
  review_exp_correct: 5,
  irt_se_threshold: 0.35,
  irt_min_answers_before_converge: 10,
  anti_cheat_fast_answer_ms: 800,
}

export default function AdminPage() {
  const { user } = useAuth()
  const [rulesets, setRulesets] = useState<RulesetItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [configText, setConfigText] = useState(JSON.stringify(DEFAULT_RULESET, null, 2))

  async function loadRulesets() {
    setLoading(true)
    setError('')
    try {
      const data = await getAdminRulesets()
      setRulesets(data)
    } catch (err: any) {
      setError(err.message || '加载规则集失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRulesets()
  }, [])

  const activeRuleset = useMemo(
    () => rulesets.find((item) => item.is_active === 1) || null,
    [rulesets],
  )

  async function handleCreate() {
    setSaving(true)
    setError('')
    try {
      const config = JSON.parse(configText)
      await createAdminRuleset(name.trim() || `ruleset-${Date.now()}`, config)
      setName('')
      await loadRulesets()
    } catch (err: any) {
      setError(err.message || '创建规则集失败')
    } finally {
      setSaving(false)
    }
  }

  async function handleActivate(id: string) {
    setSaving(true)
    setError('')
    try {
      await activateAdminRuleset(id)
      await loadRulesets()
    } catch (err: any) {
      setError(err.message || '激活规则集失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-[2rem] border border-white/10 bg-panel-900 p-6 shadow-glow backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-xs text-white/55">后台管理</div>
              <h1 className="mt-2 text-3xl font-semibold text-white">规则集管理</h1>
              <p className="mt-2 text-sm text-white/65">
                当前登录身份：{user?.username} · {user?.role || 'user'}
              </p>
            </div>
            {activeRuleset && (
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
                当前生效规则：{activeRuleset.name}
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[2rem] border border-white/10 bg-panel-900 p-6 shadow-glow backdrop-blur">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">已有规则集</h2>
              <button
                type="button"
                onClick={loadRulesets}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/70 hover:bg-white/10"
              >
                刷新
              </button>
            </div>

            {loading ? (
              <div className="mt-6 text-sm text-white/55">正在加载规则集...</div>
            ) : (
              <div className="mt-6 grid gap-4">
                {rulesets.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-base font-semibold text-white">{item.name}</div>
                        <div className="mt-1 text-xs text-white/45">
                          更新时间：{new Date(item.updated_at).toLocaleString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {item.is_active === 1 ? (
                          <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-200">
                            生效中
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => handleActivate(item.id)}
                            className="rounded-full border border-brand-400/20 bg-brand-400/10 px-3 py-1 text-xs text-brand-200 hover:bg-brand-400/20 disabled:opacity-50"
                          >
                            激活
                          </button>
                        )}
                      </div>
                    </div>
                    <pre className="mt-4 overflow-x-auto rounded-2xl border border-white/10 bg-black/20 p-4 text-xs text-white/75">
                      {JSON.stringify(item.config, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-panel-900 p-6 shadow-glow backdrop-blur">
            <h2 className="text-xl font-semibold text-white">新建规则集</h2>
            <p className="mt-2 text-sm text-white/60">
              可以先复制默认规则，微调 SRS、经验值、IRT 收敛阈值等参数。
            </p>

            <div className="mt-6 grid gap-4">
              <div>
                <label className="text-sm font-medium text-white/80">规则集名称</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-400"
                  placeholder="例如：more-strict-irt"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-white/80">配置 JSON</label>
                <textarea
                  value={configText}
                  onChange={(e) => setConfigText(e.target.value)}
                  rows={16}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 font-mono text-xs text-white outline-none focus:border-brand-400"
                />
              </div>
              {error ? <div className="text-sm text-rose-300">{error}</div> : null}
              <button
                type="button"
                disabled={saving}
                onClick={handleCreate}
                className="rounded-full bg-gradient-to-r from-brand-500 to-fuchsia-500 px-5 py-3 text-sm font-semibold text-white shadow-glow disabled:opacity-50"
              >
                {saving ? '提交中...' : '创建规则集'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
