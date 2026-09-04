/* oxlint-disable react/only-export-components */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { createInitialState } from '../domain/seed'
import { BACKUP_KEY, exportLocalData, loadStoredState, migrateState, STORAGE_KEY } from '../domain/storage'
import { blankSet, changeSession, elapsed, previewSchedule, reconfigureState, startSession, trainingLog, uid } from '../domain/training'
import type { Activity, AppState, CalculationSettings, DailyLog, Profile, SetLog } from '../domain/types'

interface AppContextValue {
  state: AppState
  storageStatus: string
  transact: (update: (state: AppState) => AppState) => boolean
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
  const [loaded] = useState(() => {
    try { return { ...loadStoredState(localStorage), error: '' } }
    catch (error) { return { state: null, raw: null, error: String(error) } }
  })
  const [state, renderState] = useState<AppState | null>(loaded.state)
  const current = useRef(state)
  const lastRaw = useRef(loaded.raw)
  const unsaved = useRef(false)
  const [storageStatus, setStorageStatus] = useState('Sauvegardé localement')
  const [error, setError] = useState(loaded.error)
  const [conflict, setConflict] = useState(false)
  const transact = useCallback((update: (value: AppState) => AppState): boolean => {
    if (!current.current || conflict) return false
    try {
      if (localStorage.getItem(STORAGE_KEY) !== lastRaw.current) { setConflict(true); setStorageStatus('Conflit entre onglets'); return false }
      const next = update(current.current)
      if (next === current.current && !unsaved.current) return true
      const versioned = { ...next, revision: (current.current.revision ?? 0) + 1 }
      current.current = versioned
      renderState(versioned)
      unsaved.current = true
      const serialized = JSON.stringify(versioned)
      localStorage.setItem(STORAGE_KEY, serialized)
      lastRaw.current = serialized
      unsaved.current = false
      setStorageStatus('Sauvegardé localement'); setError('')
      return true
    } catch (cause) { setError(String(cause)); setStorageStatus(unsaved.current ? 'Échec de sauvegarde — données conservées en mémoire' : 'Action non enregistrée'); return false }
  }, [conflict])

  useEffect(() => {
    function changed(event: StorageEvent) {
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
  if (!state) return <main className="storage-recovery"><h1>Ton journal est protégé</h1><p>Le stockage n’a pas pu être ouvert. Aucune donnée existante n’a été effacée.</p><pre>{error}</pre><button onClick={() => exportLocalData(localStorage.getItem(STORAGE_KEY) ?? '')}>Exporter les données brutes</button><button onClick={() => window.location.reload()}>Réessayer</button><p>Une sauvegarde antérieure peut être disponible sous la clé {BACKUP_KEY}.</p></main>
  const value: AppContextValue = {
    state, transact, storageStatus,
    updateProfile: patch => { transact(s => ({ ...s, profile: { ...s.profile, ...patch } })) },
    updateSettings: patch => { transact(s => ({ ...s, settings: { ...s.settings, ...patch } })) },
    applyConfiguration: (profile, settings) => { transact(s => reconfigureState(s, profile, settings)) },
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
    {(error || conflict) && <div className="storage-alert" role="alert"><strong>{conflict ? 'Une autre version du journal existe. Sauvegarde bloquée pour éviter son écrasement.' : storageStatus}</strong><span>{error}</span><button onClick={() => exportLocalData(JSON.stringify(current.current))}>Exporter ma version</button>{!conflict && <button onClick={() => transact(s => s)}>Réessayer la sauvegarde</button>}<button onClick={() => window.location.reload()}>Recharger la version enregistrée</button></div>}
    {children}
  </AppContext.Provider>
}
export function useApp(): AppContextValue {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp doit être utilisé dans AppProvider')
  return context
}
