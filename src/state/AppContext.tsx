/* oxlint-disable react/only-export-components */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { createInitialState } from '../domain/seed'
import { BACKUP_KEY, exportLocalData, loadStoredState, migrateState, RECOVERY_KEY, STORAGE_KEY } from '../domain/storage'
import { blankSet, changeSession, elapsed, previewSchedule, reconfigureState, startSession, trainingLog, uid } from '../domain/training'
import type { Activity, AppState, CalculationSettings, DailyLog, Profile, SetLog } from '../domain/types'
import { useAuth } from './AuthContext'

interface AppContextValue {
  state: AppState
  storageStatus: string
  storageAvailable: boolean
  hadStoredState: boolean
  transact: (update: (state: AppState) => AppState) => boolean
  replaceState: (state: AppState, status?: string) => void
  updateProfile: (profile: Partial<Profile>) => void
  updateSettings: (settings: Partial<CalculationSettings>) => void
  applyConfiguration: (profile: Profile, settings: CalculationSettings) => void
  updateLog: (date: string, patch: Partial<DailyLog>) => void
  addActivity: (date: string, activity: Omit<Activity, 'id' | 'date'>) => void
  removeActivity: (date: string, id: string) => void
  setCalories: (date: string, calories: number) => void
  addMeal: (date: string, name: string, calories: number) => void
  setWeight: (date: string, weight: number) => void
  startTraining: (date: string, templateId: string) => void
  updateTrainingSet: (date: string, exerciseId: string, setId: string, patch: Partial<SetLog>) => void
  addTrainingSet: (date: string, exerciseId: string) => void
  completeTraining: (date: string) => void
  updateSchedule: (date: string, templateId: string) => void
  setWeeklyStrategy: (strategy: AppState['weeklyStrategy']) => void
  completeOnboarding: () => void
  resetApp: () => void
}
const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const { configured, user } = useAuth()
  const [loaded] = useState(() => {
    let existingRaw: string | null = null
    try {
      existingRaw = localStorage.getItem(STORAGE_KEY)
      return { ...loadStoredState(localStorage), error: '', storageAvailable: true, hadStoredState: existingRaw !== null, recoverableRaw: existingRaw }
    } catch (error) {
      // Keep the original value untouched and continue in memory. Once the
      // user is authenticated, CloudSync can still restore the server copy.
      if (existingRaw === null) {
        try { existingRaw = localStorage.getItem(STORAGE_KEY) } catch { /* Storage itself is unavailable. */ }
      }
      return {
        state: migrateState(createInitialState()),
        raw: null,
        error: String(error),
        storageAvailable: false,
        hadStoredState: existingRaw !== null,
        recoverableRaw: existingRaw,
      }
    }
  })
  const [state, renderState] = useState<AppState>(loaded.state)
  const current = useRef(state)
  const lastRaw = useRef(loaded.raw)
  const storageAvailable = useRef(loaded.storageAvailable)
  const [isStorageAvailable, setIsStorageAvailable] = useState(loaded.storageAvailable)
  const recoverableRaw = useRef(loaded.recoverableRaw)
  const unsaved = useRef(false)
  const cloudAvailable = configured && Boolean(user)
  const [storageStatus, setStorageStatus] = useState(loaded.storageAvailable ? 'Sauvegardé localement' : cloudAvailable ? 'Copie locale indisponible — synchronisation cloud active' : 'Échec de sauvegarde — données conservées en mémoire')
  const [error, setError] = useState(loaded.error)
  const [conflict, setConflict] = useState(false)
  const markStorageUnavailable = useCallback((cause: unknown) => {
    storageAvailable.current = false
    setIsStorageAvailable(false)
    setError(String(cause))
    setStorageStatus(cloudAvailable ? 'Copie locale indisponible — synchronisation cloud active' : 'Échec de sauvegarde — données conservées en mémoire')
  }, [cloudAvailable])
  const transact = useCallback((update: (value: AppState) => AppState): boolean => {
    if (conflict) return false
    if (storageAvailable.current) {
      try {
        if (localStorage.getItem(STORAGE_KEY) !== lastRaw.current) { setConflict(true); setStorageStatus('Conflit entre onglets'); return false }
      } catch (cause) {
        markStorageUnavailable(cause)
      }
    }
    try {
      const next = update(current.current)
      if (next === current.current && !unsaved.current) return true
      const versioned = { ...next, revision: (current.current.revision ?? 0) + 1 }
      current.current = versioned
      renderState(versioned)
      unsaved.current = true
      const serialized = JSON.stringify(versioned)
      if (storageAvailable.current) {
        try {
          localStorage.setItem(STORAGE_KEY, serialized)
          lastRaw.current = serialized
        } catch (cause) {
          markStorageUnavailable(cause)
        }
      }
      unsaved.current = false
      setStorageStatus(storageAvailable.current ? 'Sauvegardé localement' : cloudAvailable ? 'Copie locale indisponible — synchronisation cloud active' : 'Échec de sauvegarde — données conservées en mémoire')
      if (storageAvailable.current) setError('')
      return storageAvailable.current || cloudAvailable
    } catch (cause) { setError(String(cause)); setStorageStatus(unsaved.current ? 'Échec de sauvegarde — données conservées en mémoire' : 'Action non enregistrée'); return false }
  }, [cloudAvailable, conflict, markStorageUnavailable])

  const replaceState = useCallback((value: AppState, status = 'Données cloud chargées') => {
    const next = migrateState(value)
    const serialized = JSON.stringify(next)
    if (storageAvailable.current || recoverableRaw.current !== null) {
      try {
        if (!storageAvailable.current && recoverableRaw.current !== null && !localStorage.getItem(RECOVERY_KEY)) {
          localStorage.setItem(RECOVERY_KEY, recoverableRaw.current)
        }
        localStorage.setItem(STORAGE_KEY, serialized)
        lastRaw.current = serialized
        recoverableRaw.current = null
        storageAvailable.current = true
        setIsStorageAvailable(true)
      } catch (cause) {
        markStorageUnavailable(cause)
      }
    }
    current.current = next
    unsaved.current = false
    renderState(next)
    setConflict(false)
    if (storageAvailable.current) setError('')
    setStorageStatus(storageAvailable.current ? status : `${status} — cache local indisponible`)
  }, [markStorageUnavailable])

  useEffect(() => {
    function changed(event: StorageEvent) {
      if (!storageAvailable.current) return
      if (event.key !== STORAGE_KEY || event.newValue === lastRaw.current) return
      if (unsaved.current || !event.newValue) { setConflict(true); setStorageStatus('Conflit entre onglets'); return }
      try {
        const next = migrateState(JSON.parse(event.newValue))
        current.current = next; lastRaw.current = event.newValue; renderState(next)
        setStorageStatus('Mis à jour depuis un autre onglet')
      } catch (cause) { setError(String(cause)); setConflict(true) }
    }
    function warn(event: BeforeUnloadEvent) { if (unsaved.current) { event.preventDefault(); event.returnValue = '' } }
    window.addEventListener('storage', changed); window.addEventListener('beforeunload', warn)
    return () => { window.removeEventListener('storage', changed); window.removeEventListener('beforeunload', warn) }
  }, [])

  const updateLog = (date: string, patch: Partial<DailyLog>) => { transact(s => ({ ...s, logs: { ...s.logs, [date]: { ...trainingLog(s, date), ...patch } } })) }
  const value: AppContextValue = {
    state, transact, replaceState, storageStatus, storageAvailable: isStorageAvailable, hadStoredState: loaded.hadStoredState,
    updateProfile: patch => { transact(s => ({ ...s, profile: { ...s.profile, ...patch } })) },
    updateSettings: patch => { transact(s => ({ ...s, settings: { ...s.settings, ...patch } })) },
    applyConfiguration: (profile, settings) => { transact(s => {
      const configured = reconfigureState(s, profile, settings)
      if (!s.activeGoalId) return configured
      return { ...configured, goals: configured.goals.map(goal => goal.id === s.activeGoalId ? {
        ...goal,
        referenceWeightKg: profile.referenceWeightKg,
        targetWeightKg: profile.targetWeightKg,
        referenceBodyFatPercent: profile.bodyFatPercent,
        heightCm: profile.heightCm,
        trainingLevel: profile.trainingLevel,
        targetWeightChangeKgPerWeek: -profile.weeklyLossTargetKg,
      } : goal) }
    }) },
    updateLog,
    addActivity: (date, activity) => { transact(s => { const log = trainingLog(s, date); return { ...s, logs: { ...s.logs, [date]: { ...log, activities: [...log.activities, { ...activity, id: uid('activity'), date }] } } } }) },
    removeActivity: (date, id) => { transact(s => { const log = trainingLog(s, date); return { ...s, logs: { ...s.logs, [date]: { ...log, activities: log.activities.filter(a => a.id !== id) } } } }) },
    setCalories: (date, calories) => updateLog(date, { caloriesConsumed: calories }),
    addMeal: (date, name, calories) => { transact(s => { const log = trainingLog(s, date); return { ...s, logs: { ...s.logs, [date]: { ...log, meals: [...log.meals, { id: uid('meal'), name, calories }], caloriesConsumed: (log.caloriesConsumed ?? 0) + calories } } } }) },
    setWeight: (date, weightKg) => { transact(s => { const logs = { ...s.logs, [date]: { ...trainingLog(s, date), weightKg } }; const last = Object.values(logs).filter(l => l.weightKg !== undefined).sort((a, b) => b.date.localeCompare(a.date))[0]; return { ...s, logs, profile: { ...s.profile, currentWeightKg: last?.weightKg ?? s.profile.currentWeightKg } } }) },
    startTraining: (date, templateId) => { transact(s => startSession(s, date, templateId)) },
    updateTrainingSet: (date, exerciseId, setId, patch) => { transact(s => changeSession(s, date, session => ({ ...session, exercises: session.exercises.map(e => e.id === exerciseId ? { ...e, sets: e.sets.map(set => set.id === setId ? { ...set, ...patch } : set) } : e) }))) },
    addTrainingSet: (date, exerciseId) => { transact(s => changeSession(s, date, session => ({ ...session, exercises: session.exercises.map(e => e.id === exerciseId ? { ...e, sets: [...e.sets, blankSet()] } : e) }))) },
    completeTraining: date => { transact(s => changeSession(s, date, session => ({ ...session, status: 'completed', completedAt: Date.now(), elapsedMs: elapsed(session), runningSince: undefined, restUntil: undefined, restRemainingMs: undefined }))) },
    updateSchedule: (date, templateId) => { transact(s => previewSchedule(s, { [date]: templateId })) },
    setWeeklyStrategy: weeklyStrategy => { transact(s => ({ ...s, weeklyStrategy })) },
    completeOnboarding: () => { transact(s => ({ ...s, onboardingComplete: true })) },
    resetApp: () => { transact(() => migrateState(createInitialState())) },
  }
  return <AppContext.Provider value={value}>
    {(error || conflict) && <div className="storage-alert" role="alert"><strong>{conflict ? 'Une autre version du journal existe. Sauvegarde bloquée pour éviter son écrasement.' : storageStatus}</strong><span>{error}</span><button onClick={() => exportLocalData(recoverableRaw.current ?? JSON.stringify(current.current), recoverableRaw.current ? 'cutting-performance-donnees-locales-brutes.json' : 'cutting-performance-sauvegarde.json')}>Exporter ma version</button>{isStorageAvailable && !conflict && <button onClick={() => transact(s => s)}>Réessayer la sauvegarde</button>}<button onClick={() => window.location.reload()}>Recharger</button>{!isStorageAvailable && <small>Aucune donnée locale existante n’a été effacée. Une sauvegarde antérieure peut aussi exister sous la clé {BACKUP_KEY}.</small>}</div>}
    {children}
  </AppContext.Provider>
}
export function useApp(): AppContextValue {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp doit être utilisé dans AppProvider')
  return context
}
