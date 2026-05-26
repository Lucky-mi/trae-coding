import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../components/AppShell'
import { useSession } from '../store/useSession'
import type { SessionState } from '../store/useSession'

type Stage = '小学' | '初中' | '高中'

export default function SetupPage() {
  const navigate = useNavigate()
  const guestId = useSession((s: SessionState) => s.guestId)
  const [stage, setStage] = useState<Stage>('小学')
  const [perLevelCount, setPerLevelCount] = useState(4)
  const [timeLimitSec, setTimeLimitSec] = useState(15 * 60)
  const [enableTimer, setEnableTimer] = useState(true)
  const [adaptive, setAdaptive] = useState(true)

  const totalEstimate = useMemo(() => {
    const levels = stage === '高中' ? 3 : 6
    return levels * perLevelCount
  }, [stage, perLevelCount])

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl">
        <div className="rounded-[2rem] border border-white/10 bg-panel-900 p-6 shadow-glow backdrop-blur md:p-8">
          <div className="flex items-start justify-between gap-6">
            <div>
              <div className="text-xs text-white/55">测评设置</div>
              <h2 className="mt-2 text-2xl font-semibold text-white">
                选择范围与模式
              </h2>
              <p className="mt-2 text-sm leading-6 text-white/65">
                先按配额抽题跑通闭环，后续会根据词库字段自动推导级别枚举与题量。
              </p>
            </div>
            <div className="hidden rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-white/60 md:block">
              预计题量：{totalEstimate}
            </div>
          </div>

          <div className="mt-8 grid gap-5">
            <div>
              <div className="text-sm font-semibold text-white/85">学段</div>
              <div className="mt-3 grid grid-cols-3 gap-3">
                {(['小学', '初中', '高中'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStage(s)}
                    className={[
                      'rounded-2xl border px-4 py-3 text-sm font-semibold backdrop-blur transition',
                      s === stage
                        ? 'border-brand-400/50 bg-white/10 text-white shadow-glow'
                        : 'border-white/10 bg-white/5 text-white/75 hover:bg-white/10',
                    ].join(' ')}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
                <div className="text-sm font-semibold text-white/85">
                  每级题量
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <input
                    type="range"
                    min={2}
                    max={8}
                    value={perLevelCount}
                    onChange={(e) => setPerLevelCount(Number(e.target.value))}
                    className="w-full"
                  />
                  <div className="w-10 text-right text-sm text-white/75">
                    {perLevelCount}
                  </div>
                </div>
              </label>

              <label className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-white/85">
                    限时
                  </div>
                  <button
                    type="button"
                    onClick={() => setEnableTimer((v) => !v)}
                    className={[
                      'rounded-full border px-3 py-1 text-xs font-semibold transition',
                      enableTimer
                        ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200'
                        : 'border-white/10 bg-white/5 text-white/60',
                    ].join(' ')}
                  >
                    {enableTimer ? '开启' : '关闭'}
                  </button>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <input
                    type="range"
                    min={5 * 60}
                    max={40 * 60}
                    step={60}
                    value={timeLimitSec}
                    disabled={!enableTimer}
                    onChange={(e) => setTimeLimitSec(Number(e.target.value))}
                    className="w-full disabled:opacity-40"
                  />
                  <div className="w-14 text-right text-sm text-white/75">
                    {Math.round(timeLimitSec / 60)}m
                  </div>
                </div>
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <button
                type="button"
                onClick={() => setAdaptive((v) => !v)}
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-left transition hover:bg-white/10"
              >
                <div>
                  <div className="text-sm font-semibold text-white/85">
                    自适应难度
                  </div>
                  <div className="mt-1 text-xs text-white/55">
                    基于答题表现动态调整 level
                  </div>
                </div>
                <div
                  className={[
                    'rounded-full border px-3 py-1 text-xs font-semibold',
                    adaptive
                      ? 'border-brand-400/30 bg-brand-400/10 text-brand-200'
                      : 'border-white/10 bg-white/5 text-white/60',
                  ].join(' ')}
                >
                  {adaptive ? '开启' : '关闭'}
                </div>
              </button>

              <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
                <div className="text-sm font-semibold text-white/85">
                  预计题量
                </div>
                <div className="mt-2 text-3xl font-semibold text-white">
                  {totalEstimate}
                </div>
                <div className="mt-1 text-xs text-white/55">
                  先用默认 level 数做估算，词库解析后会精确计算
                </div>
              </div>
            </div>

            <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() =>
                  navigate('/quiz', {
                    state: {
                      stage,
                      perLevelCount,
                      timeLimitSec: enableTimer ? timeLimitSec : null,
                      adaptive,
                      guestId,
                    },
                  })
                }
                className="w-full rounded-full bg-gradient-to-r from-brand-500 to-fuchsia-500 px-6 py-3 text-sm font-semibold text-white shadow-glow transition hover:brightness-110 md:w-auto"
              >
                开始
              </button>
              <div className="text-xs text-white/50">
                题库来自本地 API（默认 http://localhost:8000），请确保已启动服务
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
