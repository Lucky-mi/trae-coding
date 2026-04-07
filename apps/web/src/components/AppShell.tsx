import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

export default function AppShell(props: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <div className="pointer-events-none fixed inset-0 opacity-[0.22] [background-image:radial-gradient(rgba(255,255,255,0.10)_1px,transparent_1px)] [background-size:22px_22px]" />
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <Link
          to="/"
          className="group inline-flex items-center gap-2 rounded-full border border-white/10 bg-panel-800 px-4 py-2 text-sm text-white/90 shadow-glow backdrop-blur"
        >
          <span className="h-2 w-2 rounded-full bg-brand-400 shadow-[0_0_20px_rgba(167,139,250,0.65)]" />
          <span className="font-semibold tracking-wide">WordGauge</span>
          <span className="text-white/50 transition group-hover:text-white/70">
            单词测评
          </span>
        </Link>
        <div className="hidden items-center gap-2 md:flex">
          <Link
            to="/setup"
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 backdrop-blur transition hover:bg-white/10"
          >
            开始测评
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-6 pb-16">{props.children}</main>
    </div>
  )
}
