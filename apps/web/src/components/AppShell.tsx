import { useEffect, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { logout } from '../api/client'
import { useAuth } from '../store/useAuth'

export default function AppShell(props: { children: ReactNode }) {
  const navigate = useNavigate()
  const token = localStorage.getItem('wordgauge-token')
  const { user, fetchUser } = useAuth()

  useEffect(() => {
    if (token && !user) {
      fetchUser()
    }
  }, [token, user, fetchUser])

  function handleLogout() {
    logout()
    navigate('/')
  }

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
          {token ? (
            <>
              {user && (
                <div className="mr-2 text-sm text-white/70">
                  <span className="font-semibold text-brand-300">{user.username}</span>，你好
                </div>
              )}
              <Link
                to="/history"
                className="rounded-full border border-white/10 bg-transparent px-4 py-2 text-sm text-white/60 backdrop-blur transition hover:text-white/80 hover:bg-white/5"
              >
                历史记录
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-full border border-white/10 bg-transparent px-4 py-2 text-sm text-white/60 backdrop-blur transition hover:text-white/80 hover:bg-white/5"
              >
                退出登录
              </button>
              <Link
                to="/setup"
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 backdrop-blur transition hover:bg-white/10"
              >
                开始测评
              </Link>
            </>
          ) : (
            <Link
              to="/auth"
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 backdrop-blur transition hover:bg-white/10"
            >
              登录 / 注册
            </Link>
          )}
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-6 pb-16">{props.children}</main>
    </div>
  )
}
