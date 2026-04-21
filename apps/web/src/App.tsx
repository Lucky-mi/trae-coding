import { Navigate, Route, Routes } from 'react-router-dom'
import HomePage from './pages/HomePage'
import SetupPage from './pages/SetupPage'
import QuizPage from './pages/QuizPage'
import ResultPage from './pages/ResultPage'
import AuthPage from './pages/AuthPage'
import HistoryPage from './pages/HistoryPage'
import LeaderboardPage from './pages/LeaderboardPage'
import DictionaryPage from './pages/DictionaryPage'
import ReviewPage from './pages/ReviewPage'
import { ProtectedRoute } from './components/ProtectedRoute'

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/leaderboard" element={<LeaderboardPage />} />
      
      {/* 受保护路由 */}
      <Route path="/setup" element={<ProtectedRoute><SetupPage /></ProtectedRoute>} />
      <Route path="/quiz" element={<ProtectedRoute><QuizPage /></ProtectedRoute>} />
      <Route path="/result" element={<ProtectedRoute><ResultPage /></ProtectedRoute>} />
      <Route path="/history" element={<ProtectedRoute><HistoryPage /></ProtectedRoute>} />
      <Route path="/dictionary" element={<ProtectedRoute><DictionaryPage /></ProtectedRoute>} />
      <Route path="/review" element={<ProtectedRoute><ReviewPage /></ProtectedRoute>} />
      
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
