import type { ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './lib/auth'
import { Shell } from './components/Shell'
import { Spinner } from './components/ui'
import { LandingPage } from './pages/Landing'
import { LoginPage, RegisterPage } from './pages/AuthPages'
import { DashboardPage } from './pages/Dashboard'
import { BoardPage } from './pages/BoardPage'
import { ApplicationDetailPage } from './pages/ApplicationDetail'
import { ResumesPage } from './pages/Resumes'
import { CoverLetterPage, InterviewPage, TailorPage } from './pages/Prepare'
import { CalendarPage } from './pages/CalendarPage'
import { SettingsPage } from './pages/Settings'

export function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<Guest><LoginPage /></Guest>} />
      <Route path="/register" element={<Guest><RegisterPage /></Guest>} />
      <Route path="/app" element={<Protected><Shell><DashboardPage /></Shell></Protected>} />
      <Route path="/app/board" element={<Protected><Shell><BoardPage /></Shell></Protected>} />
      <Route path="/app/applications/:id" element={<Protected><Shell><ApplicationDetailPage /></Shell></Protected>} />
      <Route path="/app/resumes" element={<Protected><Shell><ResumesPage /></Shell></Protected>} />
      <Route path="/app/tailor" element={<Protected><Shell><TailorPage /></Shell></Protected>} />
      <Route path="/app/cover-letters" element={<Protected><Shell><CoverLetterPage /></Shell></Protected>} />
      <Route path="/app/interviews" element={<Protected><Shell><InterviewPage /></Shell></Protected>} />
      <Route path="/app/calendar" element={<Protected><Shell><CalendarPage /></Shell></Protected>} />
      <Route path="/app/settings" element={<Protected><Shell><SettingsPage /></Shell></Protected>} />
      <Route path="*" element={<main className="p-8"><h1 className="text-2xl">That page does not exist.</h1></main>} />
    </Routes>
  )
}

function Protected({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth()
  const location = useLocation()
  if (!ready) return <Spinner label="Loading your board" />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return children
}

function Guest({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth()
  if (!ready) return <Spinner label="Loading your board" />
  if (user) return <Navigate to="/app/board" replace />
  return children
}
