import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/Layout'

const TodayPage = lazy(() => import('./pages/TodayPage').then((module) => ({ default: module.TodayPage })))
const ActivitiesPage = lazy(() => import('./pages/ActivitiesPage').then((module) => ({ default: module.ActivitiesPage })))
const NutritionPage = lazy(() => import('./pages/NutritionPage').then((module) => ({ default: module.NutritionPage })))
const WeekPage = lazy(() => import('./pages/WeekPage').then((module) => ({ default: module.WeekPage })))
const ProgressPage = lazy(() => import('./pages/ProgressPage').then((module) => ({ default: module.ProgressPage })))
const TrainingPage = lazy(() => import('./pages/TrainingPage').then((module) => ({ default: module.TrainingPage })))
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((module) => ({ default: module.SettingsPage })))
const OnboardingPage = lazy(() => import('./pages/OnboardingPage').then((module) => ({ default: module.OnboardingPage })))

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
        <Route path="/musculation" element={<TrainingPage />} />
        <Route path="/parametres" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/aujourdhui" replace />} />
    </Routes>
    </Suspense>
  )
}
