import { Link } from 'react-router-dom'
import AppShell from '../components/AppShell'

export default function HomePage() {
  return (
    <AppShell>
      <section className="grid items-center gap-10 md:grid-cols-2">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-panel-900 px-4 py-2 text-xs text-white/75 shadow-glow backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/90" />
            <span>匿名测评 + 云端同步（可选）</span>
          </div>
          <h1 className="text-balance text-4xl font-semibold leading-[1.05] tracking-[-0.02em] text-white md:text-6xl">
            30 分钟给出你的词汇画像
          </h1>
          <p className="text-pretty text-base leading-7 text-white/70 md:text-lg">
            分学段分级别精确抽题，带倒计时与进度条。结束后生成图表报告、错题本与复测建议。
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/setup"
              className="rounded-full bg-gradient-to-r from-brand-500 to-fuchsia-500 px-6 py-3 text-sm font-semibold text-white shadow-glow transition hover:brightness-110"
            >
              开始测评
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-3 pt-4 text-xs text-white/60">
            <div className="rounded-2xl border border-white/10 bg-panel-900 px-4 py-3 backdrop-blur">
              <div className="text-white/85">题目分布</div>
              <div className="pt-1">按学段/级别配额</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-panel-900 px-4 py-3 backdrop-blur">
              <div className="text-white/85">干扰项</div>
              <div className="pt-1">词形/词性相近</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-panel-900 px-4 py-3 backdrop-blur">
              <div className="text-white/85">错题复测</div>
              <div className="pt-1">间隔重复策略</div>
            </div>
          </div>
        </div>

        <div className="relative">
          <div className="absolute -inset-6 rounded-[2rem] bg-gradient-to-b from-white/10 to-transparent blur-2xl" />
          <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-panel-900 p-6 shadow-glow backdrop-blur">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-white/85">
                测评进行中
              </div>
              <div className="text-xs text-white/55">00:42</div>
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-[62%] rounded-full bg-gradient-to-r from-brand-400 to-fuchsia-400" />
            </div>
            <div className="mt-6 space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="text-xs text-white/55">题目 12 / 24</div>
                <div className="mt-2 text-lg font-semibold text-white">
                  “abandon” 的中文意思是？
                </div>
              </div>
              <div className="grid gap-3">
                {['放弃', '收集', '隐藏', '选择'].map((t) => (
                  <div
                    key={t}
                    className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-sm text-white/80 transition hover:bg-white/10"
                  >
                    {t}
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-6 flex items-center justify-between text-xs text-white/55">
              <span>自适应难度：开启</span>
              <span className="animate-floaty">准备就绪</span>
            </div>
          </div>
        </div>
      </section>
    </AppShell>
  )
}

