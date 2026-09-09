import { describe, expect, it } from 'vitest'
import { createInitialState } from './seed'
import { BACKUP_KEY, loadStoredState, migrateState, STORAGE_KEY } from './storage'
import { blankSet, changeSession, duplicateTemplate, exerciseHistory, newLine, planFor, previewSchedule, reconfigureState, replaceExercise, saveTemplate, startSession, trainingLog, validSet, volume } from './training'
import { addDays, isoDate } from './dates'
import { calculateDay, calculateWeeklyMargin } from './calculations'
import type { ExerciseDefinition, ExerciseLog } from './types'

const date = isoDate()
const initial = () => migrateState(createInitialState(date))
const def: ExerciseDefinition = { id: 'exercise-custom', name: 'Presse test', equipmentId: 'Machine A', convention: 'machine' }
const model = () => ({ id: 'custom-without-prefix', name: 'Jambes perso', shortName: 'Jambes perso', dayType: 'lower' as const, exercises: [newLine(def)] })
function prepared() { const state = saveTemplate(initial(), model(), false); return previewSchedule(state, { [date]: 'custom-without-prefix' }) }

describe('migration et sauvegarde récupérable', () => {
  it('préserve les mesures, paramètres et prescriptions anciennes sans inventer de données', () => {
    const state = createInitialState(date)
    state.settings.walkKcalPer1000 = 37
    state.logs[date].caloriesConsumed = 0
    state.logs[date].weightKg = 89.7
    state.logs[date].training = { id: 'old-session', date, name: 'Historique inconnu', templateId: 'missing', status: 'completed', exercises: [{ id: 'old-e', name: 'Exercice historique', target: 'selon tolérance', sets: [{ id: 'set-old', reps: 13, loadKg: 31, completed: true }] }] }
    const next = migrateState(state)
    expect(next.logs[date].caloriesConsumed).toBe(0)
    expect(next.logs[date].weightKg).toBe(89.7)
    expect(next.settings.walkKcalPer1000).toBe(37)
    expect(next.logs[date].training?.exercises[0].target).toBe('selon tolérance')
    expect(next.logs[date].training?.exercises[0].setCount).toBeUndefined()
    expect(next.logs[date].training?.exercises[0].sets[0]).toMatchObject({ id: 'set-old', reps: 13, loadKg: 31, completed: true })
    expect(migrateState(next)).toEqual(next)
  })
  it('sauvegarde le JSON brut avant la migration, et ne le remplace pas si la sauvegarde échoue', () => {
    const raw = JSON.stringify(createInitialState(date)); const map = new Map([[STORAGE_KEY, raw]])
    const storage = { getItem: (key: string) => map.get(key) ?? null, setItem: (key: string, value: string) => { map.set(key, value) } }
    expect(loadStoredState(storage).state.schemaVersion).toBe(6)
    expect(map.get(BACKUP_KEY)).toBe(raw)
    loadStoredState(storage)
    expect(map.get(BACKUP_KEY)).toBe(raw)
    map.set(STORAGE_KEY, raw); map.delete(BACKUP_KEY)
    expect(() => loadStoredState({ ...storage, setItem: () => { throw new Error('Quota') } })).toThrow('Quota')
    expect(map.get(STORAGE_KEY)).toBe(raw)
  })
  it('met Upper A à jour sans réécrire les séances historiques', () => {
    const state = previewSchedule(migrateState(createInitialState(date)), { [date]: 'upper-a' })
    const oldTemplate = state.templates.find(template => template.id === 'upper-a')!
    const oldHistorical = structuredClone(oldTemplate)
    const legacy = {
      ...state,
      schemaVersion: 4,
      templates: state.templates.map(template => template.id === 'upper-a' ? { ...template, exercises: template.exercises.slice(0, 2) } : template),
      logs: {
        ...state.logs,
        [addDays(date, -1)]: {
          date: addDays(date, -1), meals: [], activities: [],
          training: { id: 'upper-a-history', date: addDays(date, -1), templateId: 'upper-a', name: oldTemplate.name, status: 'completed' as const, exercises: oldHistorical.exercises.map(exercise => ({ ...exercise, sets: [] })) },
        },
      },
    }
    const next = migrateState(legacy)
    expect(next.templates.find(template => template.id === 'upper-a')?.exercises.map(exercise => exercise.exerciseId)).toEqual([
      'incline-bench-dumbbell-row',
      'pulldown-neutral',
      'dumbbell-fly',
      'cable-fly',
      'cable-curl',
      'pushdown',
    ])
    expect(next.plannedSessions?.[date]?.template?.exercises.map(exercise => exercise.exerciseId)).toEqual([
      'incline-bench-dumbbell-row', 'pulldown-neutral', 'dumbbell-fly', 'cable-fly', 'cable-curl', 'pushdown',
    ])
    expect(next.logs[addDays(date, -1)].training?.exercises.map(exercise => exercise.exerciseId)).toEqual(oldHistorical.exercises.map(exercise => exercise.exerciseId))
  })
  it('refuse un état corrompu sans effacement silencieux', () => {
    expect(() => migrateState({ schemaVersion: 2, templates: [], logs: null })).toThrow()
    const map = new Map([[STORAGE_KEY, '{broken']])
    expect(() => loadStoredState({ getItem: key => map.get(key) ?? null, setItem: (key, value) => { map.set(key, value) } })).toThrow()
    expect(map.get(STORAGE_KEY)).toBe('{broken')
  })
})
describe('planning et calories', () => {
  it('un modèle modifié ne retype pas les occurrences déjà planifiées, même sans journal', () => {
    let state = prepared()
    const future = addDays(date, 40)
    state = previewSchedule(state, { [future]: 'custom-without-prefix' })
    delete state.logs[future]
    const t = state.templates.find(t => t.id === 'custom-without-prefix')!
    state = saveTemplate(state, { ...t, dayType: 'upper' }, false)
    expect(trainingLog(state, future).plannedBaseCalories).toBe(state.settings.dayTypePlans.lower.calories)
    const settings = structuredClone(state.settings)
    settings.dayTypePlans.lower.calories += 150
    const next = reconfigureState(state, state.profile, settings)
    expect(next.logs[future].plannedBaseCalories).toBe(settings.dayTypePlans.lower.calories)
    expect(next.plannedSessions![future].template?.dayType).toBe('lower')
  })
  it('utilise le type explicite d’un modèle personnalisé et le plan repos', () => {
    const state = prepared()
    expect(planFor(state, 'custom-without-prefix').plannedBaseCalories).toBe(state.settings.dayTypePlans.lower.calories)
    expect(previewSchedule(state, { [date]: 'rest' }).logs[date].plannedBaseCalories).toBe(state.settings.dayTypePlans.rest.calories)
  })
  it('préserve nutrition, pas, cardio, poids et offsets manuels dans un aperçu indépendant', () => {
    const state = prepared(); const log = state.logs[date]
    log.plannedBaseCalories! += 100; log.totalSteps = 29000; log.weightKg = 89; log.caloriesConsumed = 3000
    log.activities = [{ id: 'run', date, type: 'running', durationMin: 96, distanceKm: 17 }]
    log.meals = [{ id: 'meal', name: 'Repas', calories: 3000 }]
    const next = previewSchedule(state, { [date]: 'upper-a' })
    expect(state.schedule[date]).toBe('custom-without-prefix')
    expect(next.logs[date]).toMatchObject({ activities: log.activities, meals: log.meals, caloriesConsumed: 3000, totalSteps: 29000, weightKg: 89, plannedBaseCalories: state.settings.dayTypePlans.upper.calories + 100 })
    expect(previewSchedule(state, { [date]: 'upper-a' }, true).logs[date].plannedBaseCalories).toBe(state.settings.dayTypePlans.upper.calories)
    const calculation = calculateDay(next.logs[date], next.profile, next.settings)
    expect(calculation.runningSteps).toBe(16320)
    expect(calculation.walkingSteps).toBe(12680)
    expect(calculation.adjustedCalorieTarget).toBeGreaterThan(calculation.plannedBaseCalories)
  })
  it('rebase une séance réellement déclarée quand le planning change, sans doubler son profil', () => {
    const state = previewSchedule(prepared(), { [date]: 'rest' })
    state.logs[date].strengthActivity = {
      performed: true, plannedDayType: 'rest', dayType: 'shoulders-arms',
      templateId: 'shoulders-arms', templateName: 'Épaules-bras', source: 'manual',
    }
    expect(calculateDay(state.logs[date], state.profile, state.settings).plannedBaseCalories).toBe(state.settings.dayTypePlans['shoulders-arms'].calories)
    const next = previewSchedule(state, { [date]: 'shoulders-arms' })
    expect(next.logs[date].strengthActivity?.plannedDayType).toBe('shoulders-arms')
    expect(calculateDay(next.logs[date], next.profile, next.settings).strengthTrainingBaseAdjustmentKcal).toBe(0)
    expect(calculateDay(next.logs[date], next.profile, next.settings).plannedBaseCalories).toBe(next.settings.dayTypePlans['shoulders-arms'].calories)
  })
  it('ne rajoute pas de dépenses de musculation et distingue pas absents, zéro et nutrition absente', () => {
    const state = prepared(); const base = calculateDay(state.logs[date], state.profile, state.settings)
    expect(base.appliedAdjustmentKcal).toBe(0)
    const started = startSession(state, date, state.schedule[date])
    expect(calculateDay(started.logs[date], state.profile, state.settings)).toEqual(base)
    const journalLinked = calculateDay({ ...started.logs[date], strengthActivity: { performed: true, plannedDayType: 'lower', dayType: 'lower', templateId: 'custom-without-prefix', source: 'journal' } }, state.profile, state.settings)
    expect(journalLinked.strengthTrainingBaseAdjustmentKcal).toBe(0)
    expect(journalLinked.adjustedCalorieTarget).toBe(base.adjustedCalorieTarget)
    const zero = calculateDay({ ...state.logs[date], totalSteps: 0 }, state.profile, state.settings)
    expect(zero.appliedAdjustmentKcal).toBe(state.settings.negativeCap)
    expect(calculateWeeklyMargin([state.logs[date]], state.profile, state.settings)).toBe(0)
    expect(calculateWeeklyMargin([{ ...state.logs[date], caloriesConsumed: 0 }], state.profile, state.settings)).toBe(base.adjustedCalorieTarget)
  })
})
describe('occurrences et performances', () => {
  it('démarre une seule occurrence avec valeurs vides et refuse le futur', () => {
    const state = prepared(); const next = startSession(state, date, state.schedule[date])
    expect(startSession(next, date, state.schedule[date])).toBe(next)
    expect(next.logs[date].training?.exercises[0].sets[0]).toMatchObject({ completed: false })
    expect(next.logs[date].training?.exercises[0].sets[0].loadKg).toBeUndefined()
    expect(() => startSession(state, addDays(date, 1), state.schedule[date])).toThrow()
  })
  it('duplique des identifiants de lignes, sans partager les objets', () => {
    const source = model(); const copy = duplicateTemplate(source)
    expect(copy.id).not.toBe(source.id)
    expect(copy.exercises[0].id).not.toBe(source.exercises[0].id)
    copy.exercises[0].name = 'Different'
    expect(source.exercises[0].name).toBe('Presse test')
  })
  it('une modification globale laisse les anciennes occurrences intactes', () => {
    let state = prepared(); const t = state.templates.find(t => t.id === state.schedule[date])!
    state = startSession(state, date, t.id)
    const updated = saveTemplate(state, { ...t, name: 'Nouveau nom', exercises: [] }, true)
    expect(updated.logs[date].training?.name).toBe('Jambes perso')
    expect(updated.logs[date].training?.exercises).toHaveLength(1)
    expect(updated.plannedSessions?.[date]?.template?.exercises).toHaveLength(1)
  })
  it('sépare les séries originales validées de celles du remplaçant', () => {
    let state = startSession(prepared(), date, 'custom-without-prefix')
    const line = state.logs[date].training!.exercises[0]
    state = changeSession(state, date, s => ({ ...s, exercises: [{ ...line, sets: [{ ...blankSet(), loadKg: 100, reps: 12, completed: true }, blankSet()] }] }))
    const replacement: ExerciseDefinition = { ...def, id: 'another', name: 'Autre presse', equipmentId: 'Machine B' }
    const next = replaceExercise(state, date, line.id, replacement, false)
    const exercises = next.logs[date].training!.exercises
    expect(exercises).toHaveLength(2)
    expect(exercises[0].sets[0].loadKg).toBe(100)
    expect(exercises[0].exerciseId).toBe(def.id)
    expect(exercises[1].sets[0].loadKg).toBeUndefined()
    expect(exercises[1].exerciseId).toBe('another')
    expect(next.templates.find(t => t.id === 'custom-without-prefix')?.exercises[0].exerciseId).toBe(def.id)
  })
  it('volume : travail validé seulement, et convention inconnue non inventée', () => {
    const e: ExerciseLog = { ...newLine(def), sets: [{ id: 'a', loadKg: 30, reps: 12, completed: true }, { id: 'b', loadKg: 30, reps: 12, completed: false }, { id: 'c', loadKg: 10, reps: 20, completed: true, kind: 'warmup' }] }
    expect(volume(e)).toBe(360)
    expect(volume({ ...e, convention: 'per-dumbbell' })).toBe(360)
    expect(volume({ ...e, convention: 'bodyweight' })).toBeNull()
    expect(volume({ ...e, convention: 'unknown' })).toBeNull()
    expect(validSet({ id: 'a', reps: 0, loadKg: 10, completed: true })).toBe(false)
  })
  it('statistiques : séances terminées, même exercice et matériel, période réelle', () => {
    let state = startSession(prepared(), date, 'custom-without-prefix')
    state = changeSession(state, date, s => ({ ...s, exercises: s.exercises.map(e => ({ ...e, sets: [{ id: 'a', completed: true, loadKg: 80, reps: 12 }] })) }))
    expect(exerciseHistory(state, def.id, 'Machine A')).toHaveLength(0)
    state = changeSession(state, date, s => ({ ...s, status: 'completed' }))
    expect(exerciseHistory(state, def.id, 'Machine A')).toHaveLength(1)
    expect(exerciseHistory(state, def.id, 'Machine B')).toHaveLength(0)
    expect(exerciseHistory(state, 'another', 'Machine A')).toHaveLength(0)
    expect(exerciseHistory(state, def.id, 'Machine A', addDays(date, 1))).toHaveLength(0)
  })
})
