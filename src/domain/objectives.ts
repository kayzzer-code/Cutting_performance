import { addDays, fromIso, isoDate } from './dates'
import type { AppState, FitnessGoal, GoalType, Profile } from './types'

export const goalTypeLabels: Record<GoalType, string> = {
  'fat-loss': 'Perte de masse grasse',
  'lean-gain': 'Prise de masse contrôlée',
  maintenance: 'Maintien & forme',
  strength: 'Force',
  endurance: 'Cardio & endurance',
  event: 'Préparation d’un événement',
}

export function makeGoalId() {
  return `goal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function profileFromGoal(previous: Profile, goal: FitnessGoal): Profile {
  return {
    ...previous,
    heightCm: goal.heightCm,
    referenceWeightKg: goal.referenceWeightKg,
    currentWeightKg: goal.referenceWeightKg,
    targetWeightKg: goal.targetWeightKg,
    bodyFatPercent: goal.referenceBodyFatPercent,
    trainingLevel: goal.trainingLevel,
    weeklyLossTargetKg: -goal.targetWeightChangeKgPerWeek,
  }
}

export function goalFromProfile(profile: Profile, state?: Pick<AppState, 'logs'>, today = isoDate()): FitnessGoal {
  const datesWithData = state ? Object.values(state.logs)
    .filter(log => log.weightKg !== undefined || log.caloriesConsumed !== undefined || log.totalSteps !== undefined || log.activities.length > 0 || !!log.training || !!log.strengthActivity)
    .map(log => log.date).sort() : []
  const startDate = datesWithData[0] ?? today
  const weeks = Math.abs(profile.referenceWeightKg - profile.targetWeightKg) / Math.max(.1, Math.abs(profile.weeklyLossTargetKg))
  return {
    id: 'goal-initial-cut',
    name: `Sèche vers ${profile.targetWeightKg.toLocaleString('fr-FR')} kg`,
    type: 'fat-loss',
    status: 'active',
    startDate,
    targetDate: addDays(startDate, Math.max(7, Math.round(weeks * 7))),
    createdAt: startDate,
    referenceWeightKg: profile.referenceWeightKg,
    targetWeightKg: profile.targetWeightKg,
    referenceBodyFatPercent: profile.bodyFatPercent,
    heightCm: profile.heightCm,
    trainingLevel: profile.trainingLevel,
    targetWeightChangeKgPerWeek: -Math.abs(profile.weeklyLossTargetKg),
    priorities: ['body-composition'],
    objectiveNote: 'Préserver la masse musculaire et les performances pendant la sèche.',
  }
}

export function defaultGoal(type: GoalType, profile: Profile, today = isoDate()): FitnessGoal {
  const targetDelta = type === 'fat-loss' ? -5 : type === 'lean-gain' ? 3 : 0
  const rate = type === 'fat-loss' ? -.6 : type === 'lean-gain' ? .2 : 0
  const priorities = type === 'strength' ? ['strength'] : type === 'endurance' ? ['cardio'] : type === 'event' ? ['event', 'cardio'] : ['body-composition']
  return {
    id: makeGoalId(),
    name: goalTypeLabels[type],
    type,
    status: 'active',
    startDate: today,
    targetDate: addDays(today, type === 'event' ? 168 : 84),
    createdAt: today,
    referenceWeightKg: profile.currentWeightKg,
    targetWeightKg: profile.currentWeightKg + targetDelta,
    referenceBodyFatPercent: profile.bodyFatPercent,
    targetBodyFatPercent: type === 'fat-loss' ? Math.max(5, profile.bodyFatPercent - 5) : undefined,
    maxBodyFatIncreasePercent: type === 'lean-gain' ? 1 : undefined,
    heightCm: profile.heightCm,
    trainingLevel: profile.trainingLevel,
    targetWeightChangeKgPerWeek: rate,
    priorities: priorities as FitnessGoal['priorities'],
    enduranceDiscipline: type === 'event' ? 'ironman' : type === 'endurance' ? 'general' : undefined,
  }
}

export function goalDateCount(start: string, end: string) {
  return Math.max(1, Math.round((fromIso(end).getTime() - fromIso(start).getTime()) / 86_400_000) + 1)
}

export function goalProgress(goal: FitnessGoal, currentWeightKg: number, today = isoDate()) {
  if (goal.type === 'fat-loss' || goal.type === 'lean-gain') {
    const total = goal.targetWeightKg - goal.referenceWeightKg
    if (Math.abs(total) < .01) return 100
    return Math.max(0, Math.min(100, (currentWeightKg - goal.referenceWeightKg) / total * 100))
  }
  if (!goal.targetDate) return 0
  return Math.max(0, Math.min(100, goalDateCount(goal.startDate, today) / goalDateCount(goal.startDate, goal.targetDate) * 100))
}

export function goalStats(state: AppState, goal: FitnessGoal, today = isoDate()) {
  const end = goal.endedAt ?? today
  const logs = Object.values(state.logs).filter(log => log.date >= goal.startDate && log.date <= end)
  const tracked = logs.filter(log => log.weightKg !== undefined || log.caloriesConsumed !== undefined || log.totalSteps !== undefined || log.activities.length > 0 || !!log.training || !!log.strengthActivity)
  const weights = logs.filter(log => log.weightKg !== undefined).sort((a, b) => a.date.localeCompare(b.date))
  const calorieLogs = logs.filter(log => log.caloriesConsumed !== undefined)
  const cardioMinutes = logs.reduce((sum, log) => sum + log.activities.reduce((day, activity) => day + activity.durationMin, 0), 0)
  const trainingSessions = logs.filter(log => log.training?.status === 'completed' || log.strengthActivity?.performed).length
  const firstWeight = weights[0]?.weightKg ?? goal.referenceWeightKg
  const currentWeight = weights.at(-1)?.weightKg ?? (goal.status === 'active' ? state.profile.currentWeightKg : firstWeight)
  return {
    durationDays: goalDateCount(goal.startDate, end), trackedDays: tracked.length,
    averageCalories: calorieLogs.length ? Math.round(calorieLogs.reduce((sum, log) => sum + (log.caloriesConsumed ?? 0), 0) / calorieLogs.length) : undefined,
    calorieDays: calorieLogs.length, trainingSessions, cardioMinutes, firstWeight, currentWeight,
    weightChange: currentWeight - firstWeight, progress: goalProgress(goal, currentWeight, end),
  }
}
