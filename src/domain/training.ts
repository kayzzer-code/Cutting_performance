import { isoDate } from './dates'
import { calculateDay } from './calculations'
import type { AppState, CalculationSettings, DailyLog, DayType, ExerciseDefinition, ExerciseLog, LoadConvention, Profile, SetLog, TemplateExercise, TrainingSession, TrainingTemplate } from './types'

export const dayLabels: Record<DayType, string> = { upper: 'Upper', lower: 'Lower', 'shoulders-arms': 'Épaules-bras', rest: 'Repos' }
export const conventionLabels: Record<LoadConvention, string> = { total: 'Charge totale', 'per-dumbbell': 'Par haltère (non doublée)', machine: 'Pile machine', bodyweight: 'Poids du corps', assisted: 'Charge d’assistance', unknown: 'Convention inconnue' }
export const uid = (prefix = 'id') => `${prefix}-${crypto.randomUUID()}`
export const clone = <T,>(value: T): T => structuredClone(value)
export const normalized = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
export function typeOfTemplate(template?: TrainingTemplate): DayType { return template?.dayType ?? 'rest' }
export function templateForDate(state: AppState, date: string) {
  return state.plannedSessions?.[date]?.template ?? state.templates.find(t => t.id === state.schedule[date])
}
export function planFor(state: AppState, templateId: string) {
  const template = state.templates.find(t => t.id === templateId)
  const dayType = typeOfTemplate(template)
  const plan = state.settings.dayTypePlans[dayType]
  return { dayType, plannedBaseCalories: plan.calories, targetSteps: plan.steps }
}
export function trainingLog(state: AppState, date: string): DailyLog {
  const planned = state.plannedSessions?.[date]
  const plan = planned ? { plannedBaseCalories: planned.typeBaseCalories, targetSteps: planned.typeTargetSteps } : planFor(state, state.schedule[date] ?? 'rest')
  const log = state.logs[date]
  return log ? { ...plan, ...log } : { date, meals: [], activities: [], ...plan }
}
export function reconfigureState(state: AppState, profile: Profile, settings: CalculationSettings): AppState {
  const next = { ...state, profile, settings, logs: { ...state.logs }, plannedSessions: { ...state.plannedSessions } }
  for (const [date, templateId] of Object.entries(state.schedule)) {
    if (date < isoDate()) continue
    const old = state.plannedSessions?.[date]
    const oldPlan = planFor(state, templateId)
    const type = old?.dayType ?? oldPlan.dayType
    const log = trainingLog(state, date)
    const manualBase = (log.plannedBaseCalories ?? 0) - (old?.typeBaseCalories ?? oldPlan.plannedBaseCalories)
    const manualSteps = (log.targetSteps ?? 0) - (old?.typeTargetSteps ?? oldPlan.targetSteps)
    const plan = settings.dayTypePlans[type]
    next.logs[date] = { ...log, plannedBaseCalories: plan.calories + manualBase, targetSteps: Math.max(0, plan.steps + manualSteps) }
    if (old) next.plannedSessions[date] = { ...old, typeBaseCalories: plan.calories, typeTargetSteps: plan.steps }
  }
  return next
}
export function previewSchedule(state: AppState, changes: Record<string, string>, replaceManual = false): AppState {
  const next = { ...state, logs: { ...state.logs }, schedule: { ...state.schedule }, plannedSessions: { ...state.plannedSessions } }
  for (const [date, templateId] of Object.entries(changes)) {
    const template = state.templates.find(t => t.id === templateId)
    if (templateId !== 'rest' && !template) throw new Error('Modèle introuvable')
    const log = trainingLog(state, date)
    const old = state.plannedSessions?.[date]
    const oldPlan = planFor(state, state.schedule[date] ?? 'rest')
    const manual = (log.plannedBaseCalories ?? oldPlan.plannedBaseCalories) - (old?.typeBaseCalories ?? oldPlan.plannedBaseCalories)
    const manualSteps = (log.targetSteps ?? oldPlan.targetSteps) - (old?.typeTargetSteps ?? oldPlan.targetSteps)
    const plan = planFor(state, templateId)
    next.schedule[date] = templateId
    next.plannedSessions![date] = { date, templateId, dayType: plan.dayType, template: template ? clone(template) : undefined, typeBaseCalories: plan.plannedBaseCalories, typeTargetSteps: plan.targetSteps }
    next.logs[date] = {
      ...log,
      plannedBaseCalories: plan.plannedBaseCalories + (replaceManual ? 0 : manual),
      targetSteps: Math.max(0, plan.targetSteps + (replaceManual ? 0 : manualSteps)),
      strengthActivity: log.strengthActivity
        ? { ...log.strengthActivity, plannedDayType: plan.dayType }
        : undefined,
    }
  }
  return next
}
export function scheduleDifference(state: AppState, next: AppState, date: string) {
  return calculateDay(trainingLog(next, date), next.profile, next.settings).adjustedCalorieTarget - calculateDay(trainingLog(state, date), state.profile, state.settings).adjustedCalorieTarget
}
export function targetText(e: TemplateExercise) {
  return e.setCount && e.repsMin ? `${e.setCount} × ${e.repsMin}${e.repsMax && e.repsMax !== e.repsMin ? `–${e.repsMax}` : ''}` : e.target || 'Prescription à renseigner'
}
export function newLine(def: ExerciseDefinition): TemplateExercise {
  return { id: uid('line'), exerciseId: def.id, name: def.name, equipmentId: def.equipmentId, convention: def.convention, target: '', setCount: 3, repsMin: 10, repsMax: 15, restSeconds: 90 }
}
export function blankSet(): SetLog { return { id: uid('set'), kind: 'work', completed: false } }
export function startSession(state: AppState, date: string, templateId: string): AppState {
  if (date > isoDate()) throw new Error('Impossible de saisir une performance future.')
  const log = trainingLog(state, date)
  if (log.training) return state // Idempotent: no implicit replacement, including completed sessions.
  const template = templateForDate(state, date) ?? state.templates.find(t => t.id === templateId)
  if (!template?.exercises.length) throw new Error('Ajoute des exercices au modèle avant de démarrer.')
  if (template.exercises.some(e => !e.setCount)) throw new Error('Prescription ancienne non reconnue : complète le nombre de séries dans le modèle puis replanifie-le.')
  const now = Date.now()
  const training: TrainingSession = { id: uid('session'), date, templateId: template.id, templateVersion: template.version, name: template.name, status: 'in-progress', startedAt: now, runningSince: now, elapsedMs: 0, autoRest: true,
    exercises: template.exercises.map(e => ({ ...clone(e), templateLineId: e.id, id: uid('exercise-log'), sets: Array.from({ length: e.setCount! }, blankSet) })) }
  return { ...state, logs: { ...state.logs, [date]: { ...log, training } } }
}
export function changeSession(state: AppState, date: string, update: (session: TrainingSession) => TrainingSession): AppState {
  if (date > isoDate()) throw new Error('Journal futur en lecture seule.')
  const log = trainingLog(state, date)
  if (!log.training) return state
  return { ...state, logs: { ...state.logs, [date]: { ...log, training: update(log.training) } } }
}
export function elapsed(session: TrainingSession, now = Date.now()) { return (session.elapsedMs ?? 0) + (session.runningSince ? Math.max(0, now - session.runningSince) : 0) }
export function validSet(set: SetLog, convention?: LoadConvention) {
  return Number.isInteger(set.reps) && (set.reps ?? 0) > 0 && (set.reps ?? 0) <= 1000 && (convention === 'bodyweight' || (set.loadKg !== undefined && Number.isFinite(set.loadKg) && set.loadKg >= 0 && set.loadKg <= 2000)) && (set.rir === undefined || Number.isFinite(set.rir) && set.rir >= 0 && set.rir <= 10)
}
export function workSets(e: ExerciseLog) { return e.sets.filter(s => s.completed && s.kind !== 'warmup' && validSet(s, e.convention)) }
export function volume(e: ExerciseLog): number | null {
  if (!e.convention || ['unknown', 'assisted', 'bodyweight'].includes(e.convention)) return null
  return workSets(e).reduce((sum, set) => sum + (set.loadKg ?? 0) * (set.reps ?? 0), 0)
}
export function replaceExercise(state: AppState, date: string, lineId: string, def: ExerciseDefinition, global: boolean): AppState {
  const session = state.logs[date]?.training
  const original = session?.exercises.find(e => e.id === lineId)
  if (!session || !original || original.replacedById) return state
  const replacement: ExerciseLog = { ...clone(original), ...newLine(def), id: uid('exercise-log'), templateLineId: original.templateLineId, replacesId: original.id, replacedById: undefined,
    setCount: original.setCount, repsMin: original.repsMin, repsMax: original.repsMax, targetRir: original.targetRir, restSeconds: original.restSeconds, target: original.target,
    sets: original.sets.filter(s => !s.completed).map(() => blankSet()) }
  if (!replacement.sets.length) replacement.sets = [blankSet()]
  let next = changeSession(state, date, s => ({ ...s, exercises: s.exercises.flatMap(e => e.id === lineId ? [{ ...e, replacedById: replacement.id, sets: e.sets.filter(set => set.completed) }, replacement] : [e]) }))
  if (global) {
    const template = next.templates.find(t => t.id === session.templateId)
    if (template) next = saveTemplate(next, { ...template, exercises: template.exercises.map(e => e.id === original.templateLineId ? { ...e, exerciseId: def.id, name: def.name, equipmentId: def.equipmentId, convention: def.convention } : e) }, false)
  }
  return next
}
export function saveTemplate(state: AppState, draft: TrainingTemplate, updatePlanned: boolean): AppState {
  if (!draft.name.trim() || !draft.dayType) throw new Error('Nom et type de journée requis.')
  const previous = state.templates.find(t => t.id === draft.id)
  const template = { ...clone(draft), name: draft.name.trim(), version: (previous?.version ?? 0) + 1, createdAt: previous?.createdAt ?? new Date().toISOString(), updatedAt: new Date().toISOString() }
  let next: AppState = { ...state, templates: previous ? state.templates.map(t => t.id === template.id ? template : t) : [...state.templates, template] }
  if (updatePlanned) {
    const changes = Object.fromEntries(Object.entries(state.schedule).filter(([date, id]) => id === draft.id && date >= isoDate() && !state.logs[date]?.training))
    next = previewSchedule(next, changes)
  }
  return next
}
export function duplicateTemplate(template: TrainingTemplate): TrainingTemplate {
  return { ...clone(template), id: uid('template'), name: `${template.shortName} (copie)`, shortName: `${template.shortName} (copie)`, version: 0, archived: false, createdAt: undefined, updatedAt: undefined, exercises: template.exercises.map(e => ({ ...clone(e), id: uid('line') })) }
}
export function exerciseHistory(state: AppState, exerciseId: string, equipmentId: string, from = '0000-01-01', to = isoDate()) {
  return Object.values(state.logs).filter(log => log.date >= from && log.date <= to && log.training?.status === 'completed').flatMap(log => {
    const lines = log.training!.exercises.filter(e => e.exerciseId === exerciseId && e.equipmentId === equipmentId && workSets(e).length)
    if (!lines.length) return []
    const sets = lines.flatMap(workSets)
    const best = [...sets].sort((a, b) => (b.loadKg ?? 0) - (a.loadKg ?? 0) || (b.reps ?? 0) - (a.reps ?? 0))[0]
    const volumes = lines.map(volume)
    const rirs = sets.filter(s => s.rir !== undefined)
    return [{ date: log.date, sessionName: log.training!.name, lineId: lines[0].id, sets, best, volume: volumes.some(v => v === null) ? null : volumes.reduce<number>((sum, v) => sum + v!, 0), averageRir: rirs.length ? rirs.reduce((sum, s) => sum + s.rir!, 0) / rirs.length : null }]
  }).sort((a, b) => a.date.localeCompare(b.date))
}
