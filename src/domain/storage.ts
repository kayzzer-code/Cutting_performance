import { createInitialState } from './seed'
import { isIsoDate, isoDate } from './dates'
import { clone, planFor } from './training'
import { mergeExerciseCatalogue } from './exerciseCatalogue'
import { goalFromProfile } from './objectives'
import type { AppState, ExerciseDefinition, FitnessGoal, TemplateExercise } from './types'

export const STORAGE_KEY = 'cutting-performance-app:v1'
export const BACKUP_KEY = `${STORAGE_KEY}:backup-before-v6`
const CURRENT_SCHEMA_VERSION = 6
const legacyTypes = { 'upper-a': 'upper', 'upper-b': 'upper', 'lower-a': 'lower', 'lower-b': 'lower', 'shoulders-arms': 'shoulders-arms' } as const
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(`Données locales invalides : ${message}`) }

export function migrateState(input: unknown): AppState {
  assert(record(input), 'état absent')
  const sourceSchemaVersion = Number(input.schemaVersion)
  assert([1, 2, 3, 4, 5, 6].includes(sourceSchemaVersion), 'version non prise en charge')
  assert(record(input.logs) && record(input.schedule) && record(input.profile) && record(input.settings) && Array.isArray(input.templates), 'structure du journal')
  for (const template of input.templates) {
    assert(record(template) && typeof template.id === 'string' && typeof template.name === 'string' && Array.isArray(template.exercises), 'modèle de séance')
    for (const e of template.exercises) assert(record(e) && typeof e.id === 'string' && typeof e.name === 'string' && typeof e.target === 'string', 'exercice de modèle')
  }
  for (const [date, log] of Object.entries(input.logs)) {
    assert(isIsoDate(date) && record(log) && log.date === date && Array.isArray(log.activities) && Array.isArray(log.meals), 'journée')
    for (const activity of log.activities) {
      assert(record(activity) && typeof activity.id === 'string' && ['running', 'cycling', 'jump-rope', 'rowing', 'elliptical', 'stair-climber', 'other'].includes(String(activity.type)), 'activité')
      assert(typeof activity.durationMin === 'number' && Number.isFinite(activity.durationMin) && activity.durationMin >= 0, 'durée d’activité')
      for (const field of ['distanceKm', 'met', 'averageWatts', 'level', 'stepRateSpm']) assert(activity[field] === undefined || typeof activity[field] === 'number' && Number.isFinite(activity[field]), `activité ${field}`)
      assert(activity.averageWatts === undefined || typeof activity.averageWatts === 'number' && activity.averageWatts > 0 && activity.averageWatts <= 3000, 'watts moyens vélo')
      assert(activity.level === undefined || typeof activity.level === 'number' && Number.isInteger(activity.level) && activity.level >= 1 && activity.level <= 25, 'niveau escalier')
      assert(activity.stepRateSpm === undefined || typeof activity.stepRateSpm === 'number' && activity.stepRateSpm > 0 && activity.stepRateSpm <= 300, 'cadence escalier')
    }
    for (const meal of log.meals) {
      assert(record(meal) && typeof meal.id === 'string' && typeof meal.name === 'string' && typeof meal.calories === 'number' && Number.isFinite(meal.calories) && meal.calories >= 0, 'repas')
      for (const field of ['proteinG', 'carbohydratesG', 'fatG', 'fiberG', 'quantity', 'caloriesPer100', 'proteinPer100G', 'carbohydratesPer100G', 'fatPer100G', 'fiberPer100G']) assert(meal[field] === undefined || typeof meal[field] === 'number' && Number.isFinite(meal[field]) && meal[field] >= 0, `repas ${field}`)
      assert(meal.quantityUnit === undefined || ['g', 'ml'].includes(String(meal.quantityUnit)), 'unité du repas')
      assert(meal.mealSlot === undefined || ['breakfast', 'lunch', 'snack', 'dinner'].includes(String(meal.mealSlot)), 'moment du repas')
      assert(meal.source === undefined || ['open-food-facts', 'manual'].includes(String(meal.source)), 'source du repas')
      for (const field of ['barcode', 'brand', 'imageUrl']) assert(meal[field] === undefined || typeof meal[field] === 'string', `repas ${field}`)
    }
    for (const field of ['plannedBaseCalories', 'targetSteps', 'totalSteps', 'caloriesConsumed', 'weightKg']) assert(log[field] === undefined || typeof log[field] === 'number' && Number.isFinite(log[field]), field)
    if (log.strengthActivity) {
      assert(record(log.strengthActivity) && typeof log.strengthActivity.performed === 'boolean', 'séance de musculation déclarée')
      assert(['lower', 'upper', 'shoulders-arms', 'rest'].includes(String(log.strengthActivity.plannedDayType)), 'type de séance planifiée')
      assert(['lower', 'upper', 'shoulders-arms', 'rest'].includes(String(log.strengthActivity.dayType)), 'type de séance réalisée')
      assert(['manual', 'journal'].includes(String(log.strengthActivity.source)), 'source de séance réalisée')
      for (const field of ['durationMin', 'exerciseCount', 'workingSetCount']) assert(log.strengthActivity[field] === undefined || typeof log.strengthActivity[field] === 'number' && Number.isFinite(log.strengthActivity[field]) && log.strengthActivity[field] >= 0, `séance ${field}`)
      for (const field of ['templateId', 'templateName']) assert(log.strengthActivity[field] === undefined || typeof log.strengthActivity[field] === 'string', `séance ${field}`)
    }
    if (log.training) {
      assert(record(log.training) && Array.isArray(log.training.exercises) && ['planned', 'in-progress', 'completed'].includes(String(log.training.status)), 'séance historique')
      assert(typeof log.training.id === 'string' && typeof log.training.name === 'string' && typeof log.training.templateId === 'string', 'identité de séance')
      for (const key of ['startedAt', 'completedAt', 'runningSince', 'elapsedMs', 'restUntil', 'restRemainingMs']) assert(log.training[key] === undefined || typeof log.training[key] === 'number' && Number.isFinite(log.training[key]), `horodatage ${key}`)
      for (const e of log.training.exercises) {
        assert(record(e) && typeof e.id === 'string' && typeof e.name === 'string' && Array.isArray(e.sets), 'exercice historique')
        for (const s of e.sets) {
          assert(record(s) && typeof s.id === 'string' && typeof s.completed === 'boolean', 'série historique')
          for (const key of ['loadKg', 'reps', 'rir']) assert(s[key] === undefined || typeof s[key] === 'number' && Number.isFinite(s[key]), `série ${key}`)
        }
      }
    }
  }
  for (const [date, id] of Object.entries(input.schedule)) assert(isIsoDate(date) && typeof id === 'string', 'planning')
  const initial = createInitialState()
  const state = clone(input) as unknown as AppState
  state.profile = { ...initial.profile, ...state.profile }
  state.settings = { ...initial.settings, ...state.settings, dayTypePlans: { ...initial.settings.dayTypePlans, ...state.settings.dayTypePlans } }
  if (!Array.isArray(state.goals) || state.goals.length === 0) {
    const initialGoal = goalFromProfile(state.profile, state)
    state.goals = [initialGoal]
    state.activeGoalId = initialGoal.id
  }
  const goalTypes = ['fat-loss', 'lean-gain', 'maintenance', 'strength', 'endurance', 'event']
  const goalStatuses = ['active', 'completed', 'cancelled']
  for (const goal of state.goals) {
    assert(typeof goal.id === 'string' && typeof goal.name === 'string', 'identité d’objectif')
    assert(goalTypes.includes(goal.type) && goalStatuses.includes(goal.status), 'type ou statut d’objectif')
    assert(isIsoDate(goal.startDate) && (goal.targetDate === undefined || isIsoDate(goal.targetDate)) && (goal.endedAt === undefined || isIsoDate(goal.endedAt)), 'dates d’objectif')
    for (const field of ['referenceWeightKg', 'targetWeightKg', 'referenceBodyFatPercent', 'heightCm', 'targetWeightChangeKgPerWeek'] as (keyof FitnessGoal)[]) assert(typeof goal[field] === 'number' && Number.isFinite(goal[field] as number), `objectif ${field}`)
    assert(Array.isArray(goal.priorities), 'priorités d’objectif')
  }
  if (state.activeGoalId && !state.goals.some(goal => goal.id === state.activeGoalId && goal.status === 'active')) state.activeGoalId = state.goals.find(goal => goal.status === 'active')?.id
  for (const value of Object.values(state.profile)) assert(typeof value !== 'number' || Number.isFinite(value), 'profil')
  for (const plan of Object.values(state.settings.dayTypePlans)) assert(record(plan) && typeof plan.calories === 'number' && Number.isFinite(plan.calories) && typeof plan.steps === 'number' && Number.isFinite(plan.steps), 'plan calorique')
  if (state.schemaVersion >= 3) {
    assert(Array.isArray(state.catalogue) && record(state.plannedSessions), 'catalogue ou occurrences')
    for (const t of state.templates) {
      assert(['upper', 'lower', 'shoulders-arms'].includes(t.dayType ?? ''), 'type de journée')
      for (const e of t.exercises) {
        assert(typeof e.exerciseId === 'string' && typeof e.equipmentId === 'string', 'référence d’exercice')
        for (const field of ['setCount', 'repsMin', 'repsMax', 'targetRir', 'restSeconds'] as const) assert(e[field] === undefined || typeof e[field] === 'number' && Number.isFinite(e[field]), `prescription ${field}`)
      }
      assert(new Set(t.exercises.map(e => e.id)).size === t.exercises.length, 'identifiant de ligne dupliqué')
    }
    for (const e of state.catalogue) assert(record(e) && typeof e.id === 'string' && typeof e.name === 'string' && typeof e.equipmentId === 'string' && ['total', 'per-dumbbell', 'machine', 'bodyweight', 'assisted', 'unknown'].includes(e.convention), 'catalogue')
    assert(new Set(state.templates.map(t => t.id)).size === state.templates.length, 'identifiant de modèle dupliqué')
    assert(new Set(state.catalogue.map(e => e.id)).size === state.catalogue.length, 'identifiant de catalogue dupliqué')
    for (const [date, p] of Object.entries(state.plannedSessions)) {
      assert(isIsoDate(date) && record(p) && p.date === date && typeof p.templateId === 'string' && ['lower', 'upper', 'shoulders-arms', 'rest'].includes(p.dayType), 'occurrence planifiée')
      assert(Number.isFinite(p.typeBaseCalories) && Number.isFinite(p.typeTargetSteps), 'base de planning')
      if (p.template) assert(typeof p.template.name === 'string' && Array.isArray(p.template.exercises) && p.template.exercises.every(e => typeof e.id === 'string' && typeof e.name === 'string'), 'copie du modèle planifié')
    }
  } else {
    const catalogue: ExerciseDefinition[] = []
    function upgradeLine(e: TemplateExercise, templateId: string, index: number): TemplateExercise {
      // Exact legacy IDs, not names, keep variants independent. Unknown prescriptions stay intact.
      const exerciseId = e.exerciseId ?? e.id
      if (!catalogue.some(d => d.id === exerciseId)) catalogue.push({ id: exerciseId, name: e.name, equipmentId: e.equipmentId ?? 'legacy-unspecified', convention: e.convention ?? 'unknown' })
      const parsed = e.target.match(/^\s*(\d+)\s*[×x]\s*(\d+)(?:\s*[–—-]\s*(\d+))?/)
      return { ...e, id: `line:${templateId}:${index}:${e.id}`, exerciseId, equipmentId: e.equipmentId ?? 'legacy-unspecified', convention: e.convention ?? 'unknown', setCount: parsed ? Number(parsed[1]) : undefined, repsMin: parsed ? Number(parsed[2]) : undefined, repsMax: parsed ? Number(parsed[3] ?? parsed[2]) : undefined }
    }
    state.templates = state.templates.map(t => ({ ...t, dayType: t.dayType ?? legacyTypes[t.id as keyof typeof legacyTypes] ?? 'upper', version: t.version ?? 1, exercises: t.exercises.map((e, i) => upgradeLine(e, t.id, i)) }))
    for (const log of Object.values(state.logs)) if (log.training) {
      const t = state.templates.find(t => t.id === log.training!.templateId)
      log.training.exercises = log.training.exercises.map((e, i) => {
        const upgraded = upgradeLine(e, log.training!.templateId, i)
        return { ...upgraded, id: e.id, templateLineId: t?.exercises.find(l => l.exerciseId === upgraded.exerciseId)?.id, sets: e.sets.map(s => ({ ...s, kind: s.kind ?? 'work' })) }
      })
    }
    state.catalogue = catalogue
    state.plannedSessions = Object.fromEntries(Object.entries(state.schedule).map(([date, templateId]) => {
      const plan = planFor(state, templateId)
      const template = state.templates.find(t => t.id === templateId)
      return [date, { date, templateId, dayType: plan.dayType, template: template ? clone(template) : undefined, typeBaseCalories: plan.plannedBaseCalories, typeTargetSteps: plan.targetSteps }]
    }))
  }

  state.catalogue = mergeExerciseCatalogue(state.catalogue ?? [])
  const hydrateLine = <T extends TemplateExercise>(line: T, preserveHistoricalIdentity = false): T => {
    const definition = state.catalogue?.find(item => item.id === line.exerciseId)
    if (!definition) return line
    return {
      ...line,
      equipmentId: !line.equipmentId || (!preserveHistoricalIdentity && line.equipmentId === 'legacy-unspecified') ? definition.equipmentId : line.equipmentId,
      convention: !line.convention || (!preserveHistoricalIdentity && line.convention === 'unknown') ? definition.convention : line.convention,
      movementFamily: line.movementFamily ?? definition.movementFamily,
      muscleContributions: line.muscleContributions?.length ? line.muscleContributions : clone(definition.muscleContributions ?? []),
      laterality: line.laterality ?? definition.laterality,
      restSeconds: line.restSeconds ?? definition.defaultRestSeconds ?? 90,
    }
  }
  state.templates = state.templates.map(template => ({ ...template, exercises: template.exercises.map(line => hydrateLine(line)) }))
  if (sourceSchemaVersion < 5) {
    const requested = initial.templates.find(template => template.id === 'upper-a')
    const previous = state.templates.find(template => template.id === 'upper-a')
    if (requested) {
      const exercises = requested.exercises.map((line, index) => {
        const definition = state.catalogue?.find(item => item.id === line.id)
        const parsed = line.target.match(/^\s*(\d+)\s*[×x]\s*(\d+)(?:\s*[–—-]\s*(\d+))?/)
        return hydrateLine({
          ...line,
          id: `line:upper-a:v5:${index}:${line.id}`,
          exerciseId: line.id,
          equipmentId: definition?.equipmentId ?? 'legacy-unspecified',
          convention: definition?.convention ?? 'unknown',
          setCount: parsed ? Number(parsed[1]) : undefined,
          repsMin: parsed ? Number(parsed[2]) : undefined,
          repsMax: parsed ? Number(parsed[3] ?? parsed[2]) : undefined,
        })
      })
      const upperA = {
        ...previous,
        ...requested,
        dayType: 'upper' as const,
        version: (previous?.version ?? 1) + 1,
        exercises,
      }
      state.templates = previous
        ? state.templates.map(template => template.id === upperA.id ? upperA : template)
        : [...state.templates, upperA]
      state.plannedSessions = Object.fromEntries(Object.entries(state.plannedSessions ?? {}).map(([date, planned]) => [date, planned.templateId === 'upper-a' && date >= isoDate() && !state.logs[date]?.training ? { ...planned, template: clone(upperA) } : planned]))
    }
  }
  for (const log of Object.values(state.logs)) if (log.training) log.training.exercises = log.training.exercises.map(exercise => ({ ...hydrateLine(exercise, true), sets: exercise.sets.map(set => ({ ...set, kind: set.kind ?? 'work' })) }))
  state.plannedSessions = Object.fromEntries(Object.entries(state.plannedSessions ?? {}).map(([date, planned]) => [date, { ...planned, template: planned.template ? { ...planned.template, exercises: planned.template.exercises.map(line => hydrateLine(line)) } : undefined }]))
  for (const definition of state.catalogue) {
    for (const item of definition.muscleContributions ?? []) {
      assert(typeof item.muscleId === 'string' && ['primary', 'secondary', 'stabilizer'].includes(item.role) && Number.isFinite(item.coefficient) && item.coefficient >= 0 && item.coefficient <= 1, 'contribution musculaire')
    }
  }
  state.schemaVersion = CURRENT_SCHEMA_VERSION
  state.revision = state.revision ?? 0
  return state
}

export function loadStoredState(storage: Pick<Storage, 'getItem' | 'setItem'>): { state: AppState; raw: string | null } {
  const raw = storage.getItem(STORAGE_KEY)
  const parsed = raw ? JSON.parse(raw) : createInitialState()
  if (raw && parsed.schemaVersion !== CURRENT_SCHEMA_VERSION && !storage.getItem(BACKUP_KEY)) storage.setItem(BACKUP_KEY, raw)
  const state = migrateState(parsed)
  if (raw && parsed.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    // Backup must succeed BEFORE replacing the original; a quota error leaves it untouched.
    storage.setItem(STORAGE_KEY, JSON.stringify(state))
    return { state, raw: JSON.stringify(state) }
  }
  if (!raw) { storage.setItem(STORAGE_KEY, JSON.stringify(state)); return { state, raw: JSON.stringify(state) } }
  return { state, raw }
}

export function exportLocalData(value: string, filename = 'cutting-performance-sauvegarde.json') {
  const url = URL.createObjectURL(new Blob([value], { type: 'application/json' }))
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
