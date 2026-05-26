import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../store/useAuth'
import { logout, logoutServer } from '../api/client'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [navOpen, setNavOpen] = useState(false)
  const location = useLocation()
  const { user, fetchUser } = useAuth()

  useEffect(() => {
    if (!user && localStorage.getItem('wordgauge-token')) {
      fetchUser()
    }
  }, [user, fetchUser])

  const handleLogout = async () => {
    try {
      await logoutServer()
    } catch {
      // ignore and clear local state anyway
    }
    logout()
    window.location.href = '/'
  }

  useEffect(() => {
    setNavOpen(false)
  }, [location.pathname])

  const links = [
    { to: '/', label: '首页' },
    { to: '/setup', label: '测评设定' },
    { to: '/history', label: '历史记录' },
    ...(user ? [{ to: '/achievements', label: '成就馆' }] : []),
    ...(user ? [{ to: '/garden', label: '花园馆' }] : []),
    { to: '/leaderboard', label: '天梯榜' },
    { to: '/dictionary', label: '词典与错题' },
    { to: '/review', label: '每日复习' },
    ...(user?.role === 'admin' ? [{ to: '/admin', label: '后台管理' }] : []),
  ]

  return (
    <div className="flex min-h-screen flex-col bg-transparent text-white font-sans">
      <header className="sticky top-0 z-50 border-b border-white/5 bg-panel-950/60 px-4 py-3 backdrop-blur-xl transition-all supports-[backdrop-filter]:bg-panel-950/40">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-fuchsia-500 shadow-glow">
              <span className="font-bold text-white">W</span>
            </div>
            <span className="text-lg font-bold tracking-tight text-white/90">
              Word<span className="text-brand-400">Gauge</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-6 md:flex">
            {links.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`text-sm font-medium transition ${
                  location.pathname === link.to
                    ? 'text-brand-300 drop-shadow-[0_0_8px_rgba(167,139,250,0.5)]'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                {link.label}
              </Link>
            ))}
            {user ? (
              <div className="ml-4 flex items-center gap-3 border-l border-white/10 pl-4">
                <div className="flex flex-col items-end">
                  <span className="text-sm font-semibold text-white/80">{user.username}</span>
                  <span className="text-xs text-brand-300">Exp: {user.exp || 0} · Streak: {user.streak_days || 0}d</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="text-sm font-medium text-white/60 hover:text-rose-400 ml-2"
                >
                  退出
                </button>
              </div>
            ) : (
              <div className="ml-4 flex items-center gap-3 border-l border-white/10 pl-4">
                <Link
                  to="/auth"
                  className="text-sm font-medium text-white/60 hover:text-brand-300"
                >
                  登录 / 注册
                </Link>
              </div>
            )}
          </nav>

          <button
            className="p-2 text-white/60 hover:text-white md:hidden"
            onClick={() => setNavOpen(!navOpen)}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="h-6 w-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
              />
            </svg>
          </button>
        </div>

        {navOpen && (
          <nav className="mx-auto mt-4 flex max-w-5xl flex-col gap-4 border-t border-white/10 pb-4 pt-4 md:hidden">
            {links.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`text-base font-medium ${
                  location.pathname === link.to
                    ? 'text-brand-300'
                    : 'text-white/70'
                }`}
              >
                {link.label}
              </Link>
            ))}
            {user ? (
              <div className="mt-2 flex flex-col gap-2 border-t border-white/10 pt-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-white/60">已登录: {user.username}</span>
                  <span className="text-xs font-semibold text-brand-300 bg-brand-500/20 px-2 py-1 rounded">Exp: {user.exp || 0} · {user.streak_days || 0}d</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="text-left text-base font-medium text-rose-400 mt-2"
                >
                  退出登录
                </button>
              </div>
            ) : (
              <div className="mt-2 flex flex-col gap-2 border-t border-white/10 pt-4">
                <Link
                  to="/auth"
                  className="text-left text-base font-medium text-brand-400"
                >
                  登录 / 注册
                </Link>
              </div>
            )}
          </nav>
        )}
      </header>

      <main className="flex-1 p-4 md:p-8 relative z-10">{children}</main>
    </div>
  )
}
