import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login, register } from '../api/client'
import AppShell from '../components/AppShell'
import { useAuth } from '../store/useAuth'

export default function AuthPage() {
  const navigate = useNavigate()
  const { fetchUser, bindGuestHistory } = useAuth()
  const [isLogin, setIsLogin] = useState(true)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (localStorage.getItem('wordgauge-token')) {
      navigate('/setup', { replace: true })
    }
  }, [navigate])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (isLogin) {
        await login(username, password)
      } else {
        await register(username, password)
      }
      await fetchUser()
      await bindGuestHistory()
      navigate('/setup', { replace: true })
    } catch (err: any) {
      setError(err.message || '操作失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-md">
        <div className="rounded-[2rem] border border-white/10 bg-panel-900 p-8 shadow-glow backdrop-blur">
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-white">
              {isLogin ? '登录 WordGauge' : '注册新账号'}
            </h2>
            <p className="mt-2 text-sm text-white/60">
              {isLogin ? '欢迎回来，继续你的词汇测评之旅' : '创建账号，同步你的学习进度与错题本'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 grid gap-5">
            <div>
              <label className="text-sm font-medium text-white/80">用户名</label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/30 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                placeholder="输入用户名"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-white/80">密码</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/30 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                placeholder="输入密码"
              />
            </div>

            {error && <div className="text-sm text-red-400">{error}</div>}

            <button
              type="submit"
              disabled={loading}
              className="mt-4 w-full rounded-xl bg-gradient-to-r from-brand-500 to-fuchsia-500 py-3 font-semibold text-white shadow-glow transition hover:brightness-110 disabled:opacity-50"
            >
              {loading ? '处理中...' : isLogin ? '登录' : '注册'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-white/60">
            {isLogin ? '还没有账号？' : '已有账号？'}
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="ml-2 font-medium text-brand-400 hover:text-brand-300 hover:underline"
            >
              {isLogin ? '立即注册' : '去登录'}
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
