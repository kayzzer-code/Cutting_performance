import { muscleMeta } from './exerciseCatalogue'
import { elapsed, volume, workSets } from './training'
import type { AppState, ExerciseLog, MuscleGroup, TrainingSession } from './types'

export interface MuscleVolumeSummary {
  muscleId: MuscleGroup
  label: string
  shortLabel: string
  color: string
  directSets: number
  effectiveSets: number
  attributedTonnage: number | null
  contributors: { exerciseId: string; name: string; sets: number; effectiveSets: number; attributedTonnage: number | null }[]
}

export interface SessionSummary {
  workingSets: number
  repetitions: number
  tonnage: number | null
  durationMs: number
}

export function setTonnage(loadKg: number | undefined, reps: number | undefined, convention: ExerciseLog['convention']): number | null {
  if (!convention || ['unknown', 'assisted', 'bodyweight'].includes(convention)) return null
  if (loadKg === undefined || reps === undefined || !Number.isFinite(loadKg) || !Number.isFinite(reps)) return null
  return loadKg * reps
}

export function summarizeSession(session: TrainingSession, now = Date.now()): SessionSummary {
  const sets = session.exercises.flatMap(workSets)
  const exerciseVolumes = session.exercises.filter(exercise => workSets(exercise).length).map(volume)
  return {
    workingSets: sets.length,
    repetitions: sets.reduce((sum, set) => sum + (set.reps ?? 0), 0),
    tonnage: exerciseVolumes.some(value => value === null) ? null : exerciseVolumes.reduce<number>((sum, value) => sum + (value ?? 0), 0),
    durationMs: elapsed(session, now),
  }
}

export function aggregateMuscleVolume(exercises: ExerciseLog[]): MuscleVolumeSummary[] {
  const totals = new Map<MuscleGroup, MuscleVolumeSummary>()
  for (const exercise of exercises) {
    const sets = workSets(exercise)
    if (!sets.length) continue
    const exerciseVolume = volume(exercise)
    for (const item of exercise.muscleContributions ?? []) {
      if (!Number.isFinite(item.coefficient) || item.coefficient < 0) continue
      const meta = muscleMeta(item.muscleId)
      const current = totals.get(item.muscleId) ?? {
        muscleId: item.muscleId,
        label: meta.label,
        shortLabel: meta.shortLabel,
        color: meta.color,
        directSets: 0,
        effectiveSets: 0,
        attributedTonnage: 0,
        contributors: [],
      }
      const directSets = item.role === 'primary' ? sets.length : 0
      const effectiveSets = sets.length * item.coefficient
      const attributedTonnage = exerciseVolume === null ? null : exerciseVolume * item.coefficient
      current.directSets += directSets
      current.effectiveSets += effectiveSets
      current.attributedTonnage = current.attributedTonnage === null || attributedTonnage === null ? null : current.attributedTonnage + attributedTonnage
      const exerciseId = exercise.exerciseId ?? exercise.id
      const contributor = current.contributors.find(item => item.exerciseId === exerciseId && item.name === exercise.name)
      if (contributor) {
        contributor.sets += sets.length
        contributor.effectiveSets += effectiveSets
        contributor.attributedTonnage = contributor.attributedTonnage === null || attributedTonnage === null ? null : contributor.attributedTonnage + attributedTonnage
      } else current.contributors.push({ exerciseId, name: exercise.name, sets: sets.length, effectiveSets, attributedTonnage })
      totals.set(item.muscleId, current)
    }
  }
  return [...totals.values()].sort((a, b) => b.effectiveSets - a.effectiveSets || a.label.localeCompare(b.label, 'fr'))
}

export function completedSessions(state: AppState, from: string, to: string, templateId?: string): TrainingSession[] {
  return Object.values(state.logs)
    .filter(log => log.date >= from && log.date <= to && log.training?.status === 'completed' && (!templateId || log.training.templateId === templateId))
    .map(log => log.training!)
    .sort((a, b) => a.date.localeCompare(b.date))
}

export function summarizeSessions(sessions: TrainingSession[]): SessionSummary {
  const summaries = sessions.map(session => summarizeSession(session, session.completedAt ?? Date.now()))
  return {
    workingSets: summaries.reduce((sum, item) => sum + item.workingSets, 0),
    repetitions: summaries.reduce((sum, item) => sum + item.repetitions, 0),
    tonnage: summaries.some(item => item.tonnage === null) ? null : summaries.reduce((sum, item) => sum + (item.tonnage ?? 0), 0),
    durationMs: summaries.reduce((sum, item) => sum + item.durationMs, 0),
  }
}

export function aggregateMusclesForSessions(sessions: TrainingSession[]): MuscleVolumeSummary[] {
  return aggregateMuscleVolume(sessions.flatMap(session => session.exercises))
}
