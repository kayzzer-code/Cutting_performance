/* oxlint-disable react/only-export-components -- le hook et son provider partagent volontairement le même contexte */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { isoDate } from '../domain/dates'
import { createInitialState, defaultPlanForTemplate } from '../domain/seed'
import type {
  Activity,
  AppState,
  CalculationSettings,
  DailyLog,
  Profile,
  SetLog,
  TrainingSession,
} from '../domain/types'

const STORAGE_KEY = 'cutting-performance-app:v1'

function loadState(): AppState {
  const initial = createInitialState()
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved) as AppState
      return {
        ...initial,
        ...parsed,
        schedule: { ...initial.schedule, ...parsed.schedule },
        profile: { ...initial.profile, ...parsed.profile },
        settings: {
          ...initial.settings,
          ...parsed.settings,
          dayTypePlans: { ...initial.settings.dayTypePlans, ...parsed.settings?.dayTypePlans },
        },
      }
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY)
  }
  return initial
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function ensureLog(state: AppState, date: string): DailyLog {
  return state.logs[date] ?? {
    date,
    meals: [],
    activities: [],
    ...defaultPlanForTemplate(state.schedule[date] ?? 'rest', state.settings.dayTypePlans),
  }
}

interface AppContextValue {
  state: AppState
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
  const [state, setState] = useState<AppState>(loadState)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  const updateProfile = useCallback((patch: Partial<Profile>) => {
    setState((current) => ({ ...current, profile: { ...current.profile, ...patch } }))
  }, [])

  const updateSettings = useCallback((patch: Partial<CalculationSettings>) => {
    setState((current) => ({ ...current, settings: { ...current.settings, ...patch } }))
  }, [])

  const applyConfiguration = useCallback((profile: Profile, settings: CalculationSettings) => {
    const today = isoDate()
    setState((current) => ({
      ...current,
      profile,
      settings,
      logs: Object.fromEntries(Object.entries(current.logs).map(([date, log]) => {
        if (date < today) return [date, log]
        const plan = defaultPlanForTemplate(current.schedule[date] ?? 'rest', settings.dayTypePlans)
        return [date, { ...log, ...plan }]
      })),
    }))
  }, [])

  const updateLog = useCallback((date: string, patch: Partial<DailyLog>) => {
    setState((current) => ({
      ...current,
      logs: {
        ...current.logs,
        [date]: { ...ensureLog(current, date), ...patch },
      },
    }))
  }, [])

  const addActivity = useCallback((date: string, activity: Omit<Activity, 'id' | 'date'>) => {
    setState((current) => {
      const log = ensureLog(current, date)
      return {
        ...current,
        logs: {
          ...current.logs,
          [date]: {
            ...log,
            activities: [...log.activities, { ...activity, id: createId('activity'), date }],
          },
        },
      }
    })
  }, [])

  const removeActivity = useCallback((date: string, id: string) => {
    setState((current) => {
      const log = ensureLog(current, date)
      return {
        ...current,
        logs: {
          ...current.logs,
          [date]: { ...log, activities: log.activities.filter((item) => item.id !== id) },
        },
      }
    })
  }, [])

  const setCalories = useCallback((date: string, calories: number) => {
    updateLog(date, { caloriesConsumed: calories })
  }, [updateLog])

  const addMeal = useCallback((date: string, name: string, calories: number) => {
    setState((current) => {
      const log = ensureLog(current, date)
      return {
        ...current,
        logs: {
          ...current.logs,
          [date]: {
            ...log,
            meals: [...log.meals, { id: createId('meal'), name, calories }],
            caloriesConsumed: (log.caloriesConsumed ?? 0) + calories,
          },
        },
      }
    })
  }, [])

  const setWeight = useCallback((date: string, weight: number) => {
    setState((current) => {
      const log = ensureLog(current, date)
      const logs = { ...current.logs, [date]: { ...log, weightKg: weight } }
      const latestWeight = Object.values(logs)
        .filter((item) => item.weightKg !== undefined)
        .sort((a, b) => b.date.localeCompare(a.date))[0]?.weightKg
      return {
        ...current,
        profile: { ...current.profile, currentWeightKg: latestWeight ?? current.profile.currentWeightKg },
        logs,
      }
    })
  }, [])

  const startTraining = useCallback((date: string, templateId: string) => {
    setState((current) => {
      const log = ensureLog(current, date)
      const template = current.templates.find((item) => item.id === templateId)
      if (!template) return current
      const training: TrainingSession = {
        id: createId('training'),
        date,
        templateId,
        name: template.name,
        status: 'in-progress',
        exercises: template.exercises.map((exercise) => ({
          ...exercise,
          sets: Array.from({ length: Number.parseInt(exercise.target, 10) || 3 }, () => ({
            id: createId('set'),
            reps: 12,
            loadKg: 0,
            rir: 2,
            completed: false,
          })),
        })),
      }
      return {
        ...current,
        logs: { ...current.logs, [date]: { ...log, training } },
      }
    })
  }, [])

  const updateTrainingSet = useCallback((date: string, exerciseId: string, setId: string, patch: Partial<SetLog>) => {
    setState((current) => {
      const log = ensureLog(current, date)
      if (!log.training) return current
      return {
        ...current,
        logs: {
          ...current.logs,
          [date]: {
            ...log,
            training: {
              ...log.training,
              exercises: log.training.exercises.map((exercise) =>
                exercise.id === exerciseId
                  ? { ...exercise, sets: exercise.sets.map((set) => set.id === setId ? { ...set, ...patch } : set) }
                  : exercise,
              ),
            },
          },
        },
      }
    })
  }, [])

  const addTrainingSet = useCallback((date: string, exerciseId: string) => {
    setState((current) => {
      const log = ensureLog(current, date)
      if (!log.training) return current
      return {
        ...current,
        logs: {
          ...current.logs,
          [date]: {
            ...log,
            training: {
              ...log.training,
              exercises: log.training.exercises.map((exercise) => exercise.id === exerciseId
                ? { ...exercise, sets: [...exercise.sets, { id: createId('set'), reps: 12, loadKg: 0, rir: 2, completed: false }] }
                : exercise),
            },
          },
        },
      }
    })
  }, [])

  const completeTraining = useCallback((date: string) => {
    setState((current) => {
      const log = ensureLog(current, date)
      if (!log.training) return current
      return {
        ...current,
        logs: { ...current.logs, [date]: { ...log, training: { ...log.training, status: 'completed' } } },
      }
    })
  }, [])

  const updateSchedule = useCallback((date: string, templateId: string) => {
    setState((current) => {
      const log = ensureLog(current, date)
      return {
        ...current,
        schedule: { ...current.schedule, [date]: templateId },
        logs: {
          ...current.logs,
          [date]: { ...log, ...defaultPlanForTemplate(templateId, current.settings.dayTypePlans) },
        },
      }
    })
  }, [])

  const setWeeklyStrategy = useCallback((weeklyStrategy: AppState['weeklyStrategy']) => {
    setState((current) => ({ ...current, weeklyStrategy }))
  }, [])

  const completeOnboarding = useCallback(() => {
    setState((current) => ({ ...current, onboardingComplete: true }))
  }, [])

  const resetApp = useCallback(() => setState(createInitialState()), [])

  const value = useMemo<AppContextValue>(() => ({
    state,
    updateProfile,
    updateSettings,
    applyConfiguration,
    updateLog,
    addActivity,
    removeActivity,
    setCalories,
    addMeal,
    setWeight,
    startTraining,
    updateTrainingSet,
    addTrainingSet,
    completeTraining,
    updateSchedule,
    setWeeklyStrategy,
    completeOnboarding,
    resetApp,
  }), [
    state, updateProfile, updateSettings, applyConfiguration, updateLog, addActivity, removeActivity,
    setCalories, addMeal, setWeight, startTraining, updateTrainingSet, addTrainingSet,
    completeTraining, updateSchedule, setWeeklyStrategy, completeOnboarding, resetApp,
  ])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp doit être utilisé dans AppProvider')
  return context
}
