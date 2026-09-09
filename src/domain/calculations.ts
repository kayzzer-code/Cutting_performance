import type {
  Activity,
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

// Matrix Performance ClimbMill: official 25-level cadence table (steps/minute).
export const MATRIX_CLIMBMILL_STEPS_PER_MINUTE = [
  24, 30, 36, 42, 48, 54, 60, 66, 72, 78, 84, 90, 96,
  102, 108, 114, 120, 126, 132, 138, 143, 148, 153, 158, 162,
] as const

export function matrixClimbMillStepRate(level: number): number {
  const safeLevel = Math.min(25, Math.max(1, Math.round(level)))
  return MATRIX_CLIMBMILL_STEPS_PER_MINUTE[safeLevel - 1]
}

export function estimateOtherCardioKcal(activity: Activity, weightKg: number): number {
  const durationMin = Math.max(0, activity.durationMin)
  if (!durationMin || weightKg <= 0) return 0

  if (activity.type === 'cycling') {
    if (activity.averageWatts !== undefined && activity.averageWatts > 0) {
      // ACSM leg-cycling equation, expressed as net energy above rest.
      return durationMin * (0.05508 * activity.averageWatts + 0.0175 * weightKg)
    }
    // Keep previously saved MET-based rides stable after the watts migration.
    if (activity.met === undefined) return 0
  }

  if (activity.type === 'stair-climber') {
    const stepRate = activity.stepRateSpm
      ?? (activity.level === undefined ? 0 : matrixClimbMillStepRate(activity.level))
    if (stepRate <= 0) return 0
    const stepHeightMetres = 0.203
    const gravitationalAcceleration = 9.80665
    const assumedEfficiency = 0.25
    const verticalWorkJoules = weightKg * gravitationalAcceleration * stepHeightMetres * stepRate * durationMin
    return verticalWorkJoules / (4184 * assumedEfficiency)
  }

  if (activity.type === 'incline-treadmill') {
    const speedKmh = activity.speedKmh ?? 0
    const inclinePercent = activity.inclinePercent ?? 0
    if (speedKmh <= 0 || inclinePercent < 0) return 0
    // ACSM walking equation: VO2 = 3.5 + 0.1S + 1.8SG (S in m/min, G as a decimal).
    // We subtract the resting 3.5 mL/kg/min because the app reintegrates net activity energy.
    const netVo2 = Math.max(0, inclineTreadmillVo2(speedKmh, inclinePercent) - 3.5)
    return netVo2 * weightKg / 1000 * 5 * durationMin
  }

  const met = activity.met ?? DEFAULT_MET[activity.type] ?? 5
  return Math.max(0, met - 1) * weightKg * (durationMin / 60)
}

export function inclineTreadmillVo2(speedKmh: number, inclinePercent: number): number {
  const speedMetresPerMinute = Math.max(0, speedKmh) * 1000 / 60
  const grade = Math.max(0, inclinePercent) / 100
  return 3.5 + 0.1 * speedMetresPerMinute + 1.8 * speedMetresPerMinute * grade
}

export function inclineTreadmillMet(speedKmh: number, inclinePercent: number): number {
  return inclineTreadmillVo2(speedKmh, inclinePercent) / 3.5
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
  const scheduledBaseCalories = log.plannedBaseCalories ?? settings.baseCalories
  const scheduledTargetSteps = log.targetSteps ?? settings.targetSteps
  const strengthActivity = log.strengthActivity
  const effectiveDayType = strengthActivity
    ? strengthActivity.performed ? strengthActivity.dayType : 'rest'
    : undefined
  const plannedStrengthPlan = strengthActivity ? settings.dayTypePlans[strengthActivity.plannedDayType] : undefined
  const actualStrengthPlan = effectiveDayType ? settings.dayTypePlans[effectiveDayType] : undefined
  const strengthTrainingBaseAdjustmentKcal = plannedStrengthPlan && actualStrengthPlan
    ? actualStrengthPlan.calories - plannedStrengthPlan.calories
    : 0
  const strengthTrainingStepsAdjustment = plannedStrengthPlan && actualStrengthPlan
    ? actualStrengthPlan.steps - plannedStrengthPlan.steps
    : 0
  const plannedBaseCalories = scheduledBaseCalories + strengthTrainingBaseAdjustmentKcal
  const targetSteps = Math.max(0, scheduledTargetSteps + strengthTrainingStepsAdjustment)
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
    .reduce((sum, activity) => sum + estimateOtherCardioKcal(activity, weight), 0)

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
    scheduledBaseCalories,
    scheduledTargetSteps,
    plannedBaseCalories,
    targetSteps,
    strengthTrainingBaseAdjustmentKcal,
    strengthTrainingStepsAdjustment,
    effectiveDayType,
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
    'stair-climber': 'Escalier / Stairmaster',
    'incline-treadmill': 'Marche inclinée',
    other: 'Autre cardio',
  }[type] ?? type
}

export function activityDefaultMet(type: string): number {
  return DEFAULT_MET[type] ?? 5
}
