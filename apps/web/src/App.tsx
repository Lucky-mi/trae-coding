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
import AdminPage from './pages/AdminPage'
import AchievementsPage from './pages/AchievementsPage'
import ContrastPage from './pages/ContrastPage'
import GardenPage from './pages/GardenPage'
import { ProtectedRoute } from './components/ProtectedRoute'

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/leaderboard" element={<LeaderboardPage />} />

      <Route path="/setup" element={<SetupPage />} />
      <Route path="/quiz" element={<QuizPage />} />
      <Route path="/result" element={<ResultPage />} />
      <Route path="/history" element={<ProtectedRoute><HistoryPage /></ProtectedRoute>} />
      <Route path="/achievements" element={<ProtectedRoute><AchievementsPage /></ProtectedRoute>} />
      <Route path="/garden" element={<ProtectedRoute><GardenPage /></ProtectedRoute>} />
      <Route path="/contrast/:wordId/:otherId" element={<ProtectedRoute><ContrastPage /></ProtectedRoute>} />
      <Route path="/dictionary" element={<ProtectedRoute><DictionaryPage /></ProtectedRoute>} />
      <Route path="/review" element={<ProtectedRoute><ReviewPage /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
      
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
