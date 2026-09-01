import { roundTo } from './calculations'
import type { CalculationSettings, Profile } from './types'

export const KCAL_PER_KG_ESTIMATE = 7_700

export function estimatedBmr(profile: Profile): number {
  const bodyFat = Math.min(60, Math.max(3, profile.bodyFatPercent)) / 100
  const leanMassKg = Math.max(1, profile.currentWeightKg * (1 - bodyFat))
  return 370 + 21.6 * leanMassKg
}

export function targetDailyDeficit(profile: Profile): number {
  return profile.weeklyLossTargetKg * KCAL_PER_KG_ESTIMATE / 7
}

export function adaptSettingsToProfile(
  previousProfile: Profile,
  nextProfile: Profile,
  settings: CalculationSettings,
): CalculationSettings {
  const previousBmr = estimatedBmr(previousProfile)
  const nextBmr = estimatedBmr(nextProfile)
  const metabolicRatio = Math.min(1.15, Math.max(0.85, nextBmr / Math.max(1, previousBmr)))
  const previousDeficit = targetDailyDeficit(previousProfile)
  const nextDeficit = targetDailyDeficit(nextProfile)

  const dayTypePlans = Object.fromEntries(
    Object.entries(settings.dayTypePlans).map(([key, plan]) => {
      const estimatedMaintenance = (plan.calories + previousDeficit) * metabolicRatio
      return [key, {
        ...plan,
        calories: Math.max(1_600, roundTo(estimatedMaintenance - nextDeficit, settings.roundingStep)),
      }]
    }),
  ) as CalculationSettings['dayTypePlans']

  return {
    ...settings,
    baseCalories: dayTypePlans.upper.calories,
    dayTypePlans,
  }
}
