import type {
  CalculationSettings,
  DailyLog,
  DayCalculation,
  Profile,
} from './types'

const DEFAULT_MET: Record<string, number> = {
  cycling: 6.8,
  'jump-rope': 11.8,
  rowing: 7,
  elliptical: 5,
  other: 5,
}

export function roundTo(value: number, step: number): number {
  const rounded = step <= 0 ? Math.round(value) : Math.round(value / step) * step
  return Object.is(rounded, -0) ? 0 : rounded
}

export function estimateRunningSteps(log: DailyLog, cadence: number): number {
  return Math.round(
    log.activities
      .filter((activity) => activity.type === 'running')
      .reduce((sum, activity) => sum + activity.durationMin * cadence, 0),
  )
}

export function calculateDay(
  log: DailyLog,
  profile: Profile,
  settings: CalculationSettings,
): DayCalculation {
  const weight = log.weightKg ?? profile.currentWeightKg
  const plannedBaseCalories = log.plannedBaseCalories ?? settings.baseCalories
  const targetSteps = log.targetSteps ?? settings.targetSteps
  const runningSteps = estimateRunningSteps(log, settings.runCadenceSpm)
  const hasStepData = log.totalSteps !== undefined
  const walkingSteps = Math.max(0, (log.totalSteps ?? targetSteps + runningSteps) - runningSteps)
  const walkingKcal =
    (walkingSteps / 1000) *
    settings.walkKcalPer1000 *
    (weight / profile.referenceWeightKg)

  const runningKcal = log.activities
    .filter((activity) => activity.type === 'running')
    .reduce(
      (sum, activity) =>
        sum + (activity.distanceKm ?? 0) * weight * settings.runKcalPerKgKm,
      0,
    )

  const otherCardioKcal = log.activities
    .filter((activity) => activity.type !== 'running')
    .reduce((sum, activity) => {
      const met = activity.met ?? DEFAULT_MET[activity.type] ?? 5
      return sum + Math.max(0, met - 1) * weight * (activity.durationMin / 60)
    }, 0)

  const plannedActivityKcal =
    (targetSteps / 1000) *
    settings.walkKcalPer1000 *
    (weight / profile.referenceWeightKg)
  const actualActivityKcal = (hasStepData ? walkingKcal : plannedActivityKcal) + runningKcal + otherCardioKcal
  const activityDeltaKcal = actualActivityKcal - plannedActivityKcal
  const rawAdjustmentKcal = activityDeltaKcal * settings.reintegrationRate
  const cappedAdjustment = Math.min(
    settings.positiveCap,
    Math.max(settings.negativeCap, rawAdjustmentKcal),
  )
  const appliedAdjustmentKcal = roundTo(cappedAdjustment, settings.roundingStep)
  const adjustedCalorieTarget = Math.max(
    1200,
    roundTo(plannedBaseCalories + appliedAdjustmentKcal, settings.roundingStep),
  )

  return {
    plannedBaseCalories,
    targetSteps,
    runningSteps,
    walkingSteps,
    walkingKcal: Math.round(walkingKcal),
    runningKcal: Math.round(runningKcal),
    otherCardioKcal: Math.round(otherCardioKcal),
    plannedActivityKcal: Math.round(plannedActivityKcal),
    actualActivityKcal: Math.round(actualActivityKcal),
    activityDeltaKcal: Math.round(activityDeltaKcal),
    rawAdjustmentKcal: Math.round(rawAdjustmentKcal),
    appliedAdjustmentKcal,
    adjustedCalorieTarget,
    nutritionGapKcal:
      log.caloriesConsumed === undefined
        ? undefined
        : log.caloriesConsumed - adjustedCalorieTarget,
  }
}

export function calculateWeeklyMargin(
  logs: DailyLog[],
  profile: Profile,
  settings: CalculationSettings,
): number {
  return Math.round(
    logs.reduce((sum, log) => {
      if (log.caloriesConsumed === undefined) return sum
      const calculation = calculateDay(log, profile, settings)
      return sum + calculation.adjustedCalorieTarget - log.caloriesConsumed
    }, 0),
  )
}

export function rollingAverage(
  points: Array<{ date: string; weight: number }>,
  windowSize = 7,
  minimumEntries = 5,
): Array<{ date: string; weight: number; average?: number }> {
  return points.map((point, index) => {
    const window = points.slice(Math.max(0, index - windowSize + 1), index + 1)
    if (window.length < minimumEntries) return point
    return {
      ...point,
      average: window.reduce((sum, item) => sum + item.weight, 0) / window.length,
    }
  })
}

export function suggestedCalorieAdjustment(
  observedWeeklyLossKg: number,
  targetWeeklyLossKg: number,
): number {
  const raw = ((observedWeeklyLossKg - targetWeeklyLossKg) * 7700) / 7 * 0.5
  return Math.min(200, Math.max(-200, roundTo(raw, 50)))
}

export function activityLabel(type: string): string {
  return {
    running: 'Course à pied',
    cycling: 'Vélo',
    'jump-rope': 'Corde à sauter',
    rowing: 'Rameur',
    elliptical: 'Elliptique',
    other: 'Autre cardio',
  }[type] ?? type
}

export function activityDefaultMet(type: string): number {
  return DEFAULT_MET[type] ?? 5
}
