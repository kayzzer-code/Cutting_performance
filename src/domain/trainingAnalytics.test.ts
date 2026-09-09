import { describe, expect, it } from 'vitest'
import { createInitialState } from './seed'
import { migrateState } from './storage'
import { aggregateMuscleVolume, setTonnage, summarizeSession } from './trainingAnalytics'
import type { ExerciseLog, TrainingSession } from './types'

const completedExercise = (patch: Partial<ExerciseLog> = {}): ExerciseLog => ({
  id: 'line-1',
  exerciseId: 'bench-press',
  name: 'Développé couché barre',
  target: '3 × 8–12',
  equipmentId: 'Barre',
  convention: 'total',
  muscleContributions: [
    { muscleId: 'chest', role: 'primary', coefficient: 1 },
    { muscleId: 'triceps', role: 'secondary', coefficient: 0.5 },
  ],
  sets: [
    { id: 'set-1', loadKg: 100, reps: 10, completed: true, kind: 'work' },
    { id: 'set-2', loadKg: 100, reps: 8, completed: true, kind: 'work' },
    { id: 'set-3', loadKg: 60, reps: 10, completed: true, kind: 'warmup' },
  ],
  ...patch,
})

describe('catalogue et migration v5', () => {
  it('enrichit les exercices existants sans remplacer les données utilisateur', () => {
    const state = createInitialState('2026-09-08')
    state.templates[0].exercises.find(exercise => exercise.id === 'cable-fly')!.name = 'Écarté poulie préféré'
    const migrated = migrateState(state)
    const enriched = migrated.catalogue?.find(exercise => exercise.id === 'cable-fly')
    expect(migrated.schemaVersion).toBe(6)
    expect(enriched?.name).toBe('Écarté poulie préféré')
    expect(enriched?.muscleContributions?.[0]).toMatchObject({ muscleId: 'chest', coefficient: 1 })
    expect(migrated.catalogue?.length).toBeGreaterThan(60)
  })
})

describe('analytics de musculation', () => {
  it('ne double jamais les haltères et exclut les conventions non calculables', () => {
    expect(setTonnage(30, 12, 'per-dumbbell')).toBe(360)
    expect(setTonnage(30, 12, 'total')).toBe(360)
    expect(setTonnage(30, 12, 'bodyweight')).toBeNull()
    expect(setTonnage(30, 12, 'assisted')).toBeNull()
    expect(setTonnage(30, 12, 'unknown')).toBeNull()
  })

  it('attribue séries directes, séries effectives et tonnage par muscle', () => {
    const rows = aggregateMuscleVolume([completedExercise()])
    expect(rows.find(row => row.muscleId === 'chest')).toMatchObject({ directSets: 2, effectiveSets: 2, attributedTonnage: 1800 })
    expect(rows.find(row => row.muscleId === 'triceps')).toMatchObject({ directSets: 0, effectiveSets: 1, attributedTonnage: 900 })
  })

  it('résume uniquement les séries de travail validées', () => {
    const session: TrainingSession = {
      id: 'session-1', date: '2026-09-08', templateId: 'upper-a', name: 'Upper A', status: 'completed',
      elapsedMs: 3_600_000, exercises: [completedExercise()],
    }
    expect(summarizeSession(session)).toEqual({ workingSets: 2, repetitions: 18, tonnage: 1800, durationMs: 3_600_000 })
  })
})
