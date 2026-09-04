import { describe, expect, it } from 'vitest'
import { calculateDay, calculateWeeklyMargin, rollingAverage, suggestedCalorieAdjustment } from './calculations'
import { adaptSettingsToProfile, estimatedBmr, targetDailyDeficit } from './planning'
import { createInitialState } from './seed'
import type { DailyLog } from './types'

describe('moteur de calcul calorique', () => {
  const state = createInitialState('2026-08-27')

  it('évite le double comptage des pas pendant une course', () => {
    const log: DailyLog = {
      date: '2026-08-26', plannedBaseCalories: 3_200, targetSteps: 15_000,
      totalSteps: 29_000, caloriesConsumed: 3_000, meals: [],
      activities: [{ id: 'run', date: '2026-08-26', type: 'running', durationMin: 96, distanceKm: 17 }],
    }
    const result = calculateDay(log, state.profile, state.settings)
    expect(result.runningSteps).toBe(16_320)
    expect(result.walkingSteps).toBe(12_680)
    expect(result.walkingKcal).toBe(431)
    expect(result.runningKcal).toBe(1_530)
    expect(result.actualActivityKcal).toBe(1_961)
    expect(result.plannedActivityKcal).toBe(510)
    expect(result.activityDeltaKcal).toBe(1_451)
    expect(result.appliedAdjustmentKcal).toBe(1_150)
    expect(result.adjustedCalorieTarget).toBe(4_350)
    expect(result.nutritionGapKcal).toBe(-1_350)
  })

  it('conserve la cible de base lorsque les pas cibles sont réalisés', () => {
    const result = calculateDay({ date: '2026-08-27', totalSteps: 18_000, meals: [], activities: [] }, state.profile, state.settings)
    expect(result.plannedActivityKcal).toBe(612)
    expect(result.actualActivityKcal).toBe(612)
    expect(result.adjustedCalorieTarget).toBe(3_100)
  })

  it('ne traite pas une activité non renseignée comme zéro pas', () => {
    const result = calculateDay({ date: '2026-08-27', meals: [], activities: [] }, state.profile, state.settings)
    expect(result.actualActivityKcal).toBe(result.plannedActivityKcal)
    expect(result.activityDeltaKcal).toBe(0)
    expect(result.adjustedCalorieTarget).toBe(3_100)
  })

  it('ajoute le cardio sans pas sur la dépense nette', () => {
    const result = calculateDay({
      date: '2026-08-27', totalSteps: 18_000, meals: [],
      activities: [{ id: 'bike', date: '2026-08-27', type: 'cycling', durationMin: 20, met: 6.8 }],
    }, state.profile, state.settings)
    expect(result.otherCardioKcal).toBe(174)
    expect(result.appliedAdjustmentKcal).toBe(150)
    expect(result.adjustedCalorieTarget).toBe(3_250)
  })

  it('bascule un repos vers le profil épaules-bras sans convertir les séries en calories', () => {
    const result = calculateDay({
      date: '2026-08-27', plannedBaseCalories: 2_850, targetSteps: 18_000,
      meals: [], activities: [],
      strengthActivity: {
        performed: true, plannedDayType: 'rest', dayType: 'shoulders-arms',
        templateId: 'shoulders-arms', templateName: 'Épaules-bras', durationMin: 60,
        exerciseCount: 6, workingSetCount: 16, source: 'manual',
      },
    }, state.profile, state.settings)
    expect(result.scheduledBaseCalories).toBe(2_850)
    expect(result.strengthTrainingBaseAdjustmentKcal).toBe(50)
    expect(result.strengthTrainingStepsAdjustment).toBe(-1_000)
    expect(result.plannedBaseCalories).toBe(2_900)
    expect(result.targetSteps).toBe(17_000)
    expect(result.adjustedCalorieTarget).toBe(2_900)
  })

  it('rebascule une séance planifiée mais non faite vers le profil repos', () => {
    const result = calculateDay({
      date: '2026-08-27', plannedBaseCalories: 3_200, targetSteps: 15_000,
      meals: [], activities: [],
      strengthActivity: { performed: false, plannedDayType: 'lower', dayType: 'rest', source: 'manual' },
    }, state.profile, state.settings)
    expect(result.strengthTrainingBaseAdjustmentKcal).toBe(-350)
    expect(result.strengthTrainingStepsAdjustment).toBe(3_000)
    expect(result.plannedBaseCalories).toBe(2_850)
    expect(result.targetSteps).toBe(18_000)
    expect(result.adjustedCalorieTarget).toBe(2_850)
  })

  it('préserve les ajustements manuels lorsqu’une séance imprévue est déclarée', () => {
    const result = calculateDay({
      date: '2026-08-27', plannedBaseCalories: 2_950, targetSteps: 20_000,
      meals: [], activities: [],
      strengthActivity: { performed: true, plannedDayType: 'rest', dayType: 'upper', source: 'manual' },
    }, state.profile, state.settings)
    expect(result.plannedBaseCalories).toBe(3_200)
    expect(result.targetSteps).toBe(20_000)
  })

  it('n’interprète pas les jours nutrition non renseignés comme zéro', () => {
    const margin = calculateWeeklyMargin([
      { date: '2026-08-24', totalSteps: 18_000, caloriesConsumed: 3_000, meals: [], activities: [] },
      { date: '2026-08-25', totalSteps: 18_000, meals: [], activities: [] },
    ], state.profile, state.settings)
    expect(margin).toBe(100)
  })
})

describe('tendance de poids', () => {
  it('attend cinq mesures avant de publier une moyenne glissante', () => {
    const result = rollingAverage([
      { date: '1', weight: 91 }, { date: '2', weight: 90.9 }, { date: '3', weight: 90.8 },
      { date: '4', weight: 90.7 }, { date: '5', weight: 90.6 },
    ])
    expect(result[3].average).toBeUndefined()
    expect(result[4].average).toBeCloseTo(90.8)
  })

  it('limite les suggestions à 200 kcal et les arrondit à 50', () => {
    expect(suggestedCalorieAdjustment(0.8, 0.8)).toBe(0)
    expect(Math.abs(suggestedCalorieAdjustment(0, 0.8))).toBeLessThanOrEqual(200)
    expect(Math.abs(suggestedCalorieAdjustment(0, 0.8) % 50)).toBe(0)
  })
})

describe('adaptation du plan', () => {
  it('recalcule les journées lorsque la masse grasse et le rythme visé changent', () => {
    const state = createInitialState('2026-08-27')
    const nextProfile = { ...state.profile, bodyFatPercent: 25, weeklyLossTargetKg: 1 }
    const settings = adaptSettingsToProfile(state.profile, nextProfile, state.settings)
    expect(settings.dayTypePlans.upper.calories).toBe(2_850)
    expect(settings.dayTypePlans['shoulders-arms'].calories).toBe(2_650)
    expect(settings.baseCalories).toBe(settings.dayTypePlans.upper.calories)
  })

  it('calcule un déficit et un métabolisme cohérents à partir du profil', () => {
    const state = createInitialState('2026-08-27')
    expect(estimatedBmr(state.profile)).toBeGreaterThan(1_800)
    expect(targetDailyDeficit(state.profile)).toBeCloseTo(880)
  })

  it('démarre sans journaux fictifs', () => {
    const state = createInitialState('2026-08-27')
    expect(Object.values(state.logs).every((log) => log.caloriesConsumed === undefined && log.weightKg === undefined && log.activities.length === 0)).toBe(true)
  })
})
