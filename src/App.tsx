import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AppLayout } from './components/Layout'
import { useAuth } from './state/AuthContext'

const TodayPage = lazy(() => import('./pages/TodayPage').then((module) => ({ default: module.TodayPage })))
const ActivitiesPage = lazy(() => import('./pages/ActivitiesPage').then((module) => ({ default: module.ActivitiesPage })))
const NutritionPage = lazy(() => import('./pages/NutritionPage').then((module) => ({ default: module.NutritionPage })))
const WeekPage = lazy(() => import('./pages/WeekPage').then((module) => ({ default: module.WeekPage })))
const ProgressPage = lazy(() => import('./pages/ProgressPage').then((module) => ({ default: module.ProgressPage })))
const TrainingPage = lazy(() => import('./pages/SessionJournalPage').then((module) => ({ default: module.SessionJournalPage })))
const SessionsLibraryPage = lazy(() => import('./pages/SessionsLibraryPage').then((module) => ({ default: module.SessionsLibraryPage })))
const SessionEditorPage = lazy(() => import('./pages/SessionEditorPage').then((module) => ({ default: module.SessionEditorPage })))
const SessionsPlanningPage = lazy(() => import('./pages/SessionsPlanningPage').then((module) => ({ default: module.SessionsPlanningPage })))
const SessionsStatsPage = lazy(() => import('./pages/SessionsStatsPage').then((module) => ({ default: module.SessionsStatsPage })))
const ExercisesLibraryPage = lazy(() => import('./pages/ExercisesLibraryPage').then((module) => ({ default: module.ExercisesLibraryPage })))
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((module) => ({ default: module.SettingsPage })))
const OnboardingPage = lazy(() => import('./pages/OnboardingPage').then((module) => ({ default: module.OnboardingPage })))
const AuthPage = lazy(() => import('./pages/AuthPage').then((module) => ({ default: module.AuthPage })))

function TrainingAlias() {
  const { search } = useLocation()
  return <Navigate to={`/seances/journal${search}`} replace />
}

function Protected({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const location = useLocation()
  if (auth.loading) return <div className="route-loader"><span /> Connexion sécurisée…</div>
  if (auth.configured && !auth.user) return <Navigate to="/auth/connexion" replace state={{ from: `${location.pathname}${location.search}` }} />
  return children
}

export default function App() {
  return (
    <Suspense fallback={<div className="route-loader"><span /> Chargement…</div>}>
    <Routes>
      <Route path="/auth/connexion" element={<AuthPage mode="sign-in" />} />
      <Route path="/auth/inscription" element={<AuthPage mode="sign-up" />} />
      <Route path="/auth/mot-de-passe-oublie" element={<AuthPage mode="forgot" />} />
      <Route path="/auth/nouveau-mot-de-passe" element={<AuthPage mode="new-password" />} />
      <Route path="/onboarding/*" element={<Protected><OnboardingPage /></Protected>} />
      <Route element={<Protected><AppLayout /></Protected>}>
        <Route index element={<Navigate to="/aujourdhui" replace />} />
        <Route path="/aujourdhui" element={<TodayPage />} />
        <Route path="/activites" element={<ActivitiesPage />} />
        <Route path="/nutrition" element={<NutritionPage />} />
        <Route path="/semaine" element={<WeekPage />} />
        <Route path="/progression" element={<ProgressPage />} />
        <Route path="/musculation" element={<TrainingAlias />} />
        <Route path="/seances" element={<SessionsLibraryPage />} />
        <Route path="/seances/nouvelle" element={<SessionEditorPage />} />
        <Route path="/seances/exercices" element={<ExercisesLibraryPage />} />
        <Route path="/seances/planning" element={<SessionsPlanningPage />} />
        <Route path="/seances/journal" element={<TrainingPage />} />
        <Route path="/seances/statistiques" element={<SessionsStatsPage />} />
        <Route path="/seances/:templateId/modifier" element={<SessionEditorPage />} />
        <Route path="/seances/:templateId" element={<SessionEditorPage />} />
        <Route path="/parametres" element={<SettingsPage />} />
        <Route path="/objectifs" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/aujourdhui" replace />} />
    </Routes>
    </Suspense>
  )
}
