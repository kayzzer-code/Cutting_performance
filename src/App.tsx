import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AppLayout } from './components/Layout'

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

function TrainingAlias() {
  const { search } = useLocation()
  return <Navigate to={`/seances/journal${search}`} replace />
}

export default function App() {
  return (
    <Suspense fallback={<div className="route-loader"><span /> Chargement…</div>}>
    <Routes>
      <Route path="/onboarding/*" element={<OnboardingPage />} />
      <Route element={<AppLayout />}>
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
      </Route>
      <Route path="*" element={<Navigate to="/aujourdhui" replace />} />
    </Routes>
    </Suspense>
  )
}
