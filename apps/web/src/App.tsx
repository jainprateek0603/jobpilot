import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './lib/auth'
import { Shell } from './components/Shell'
import { Spinner } from './components/ui'
import { LandingPage } from './pages/Landing'
import { ForgotPasswordPage, LoginPage, RegisterPage, ResetPasswordPage } from './pages/AuthPages'

const DashboardPage = lazy(() => import('./pages/Dashboard').then((module) => ({ default: module.DashboardPage })))
const BoardPage = lazy(() => import('./pages/BoardPage').then((module) => ({ default: module.BoardPage })))
const ApplicationDetailPage = lazy(() => import('./pages/ApplicationDetail').then((module) => ({ default: module.ApplicationDetailPage })))
const ResumesPage = lazy(() => import('./pages/Resumes').then((module) => ({ default: module.ResumesPage })))
const TailorPage = lazy(() => import('./pages/Prepare').then((module) => ({ default: module.TailorPage })))
const CoverLetterPage = lazy(() => import('./pages/Prepare').then((module) => ({ default: module.CoverLetterPage })))
const InterviewPage = lazy(() => import('./pages/Prepare').then((module) => ({ default: module.InterviewPage })))
const CalendarPage = lazy(() => import('./pages/CalendarPage').then((module) => ({ default: module.CalendarPage })))
const SettingsPage = lazy(() => import('./pages/Settings').then((module) => ({ default: module.SettingsPage })))

export function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<Guest><LoginPage /></Guest>} />
      <Route path="/register" element={<Guest><RegisterPage /></Guest>} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/app" element={<Protected><Shell><Page><DashboardPage /></Page></Shell></Protected>} />
      <Route path="/app/board" element={<Protected><Shell><Page><BoardPage /></Page></Shell></Protected>} />
      <Route path="/app/applications/:id" element={<Protected><Shell><Page><ApplicationDetailPage /></Page></Shell></Protected>} />
      <Route path="/app/resumes" element={<Protected><Shell><Page><ResumesPage /></Page></Shell></Protected>} />
      <Route path="/app/tailor" element={<Protected><Shell><Page><TailorPage /></Page></Shell></Protected>} />
      <Route path="/app/cover-letters" element={<Protected><Shell><Page><CoverLetterPage /></Page></Shell></Protected>} />
      <Route path="/app/interviews" element={<Protected><Shell><Page><InterviewPage /></Page></Shell></Protected>} />
      <Route path="/app/calendar" element={<Protected><Shell><Page><CalendarPage /></Page></Shell></Protected>} />
      <Route path="/app/settings" element={<Protected><Shell><Page><SettingsPage /></Page></Shell></Protected>} />
      <Route path="*" element={<main className="p-8"><h1 className="text-2xl">That page does not exist.</h1></main>} />
    </Routes>
  )
}

function Page({ children }: { children: ReactNode }) {
  return <Suspense fallback={<Spinner label="Loading" />}>{children}</Suspense>
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
