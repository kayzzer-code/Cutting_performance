export type ActivityType =
  | 'running'
  | 'cycling'
  | 'jump-rope'
  | 'rowing'
  | 'elliptical'
  | 'other'

export interface Activity {
  id: string
  date: string
  type: ActivityType
  durationMin: number
  distanceKm?: number
  met?: number
  note?: string
}

export interface Meal {
  id: string
  name: string
  calories: number
}

export interface SetLog {
  id: string
  reps: number
  loadKg: number
  rir: number
  completed: boolean
}

export interface ExerciseLog {
  id: string
  name: string
  target: string
  note?: string
  sets: SetLog[]
}

export interface TrainingSession {
  id: string
  date: string
  templateId: string
  name: string
  status: 'planned' | 'in-progress' | 'completed'
  exercises: ExerciseLog[]
}

export interface DailyLog {
  date: string
  plannedBaseCalories?: number
  targetSteps?: number
  totalSteps?: number
  caloriesConsumed?: number
  meals: Meal[]
  activities: Activity[]
  weightKg?: number
  training?: TrainingSession
}

export interface Profile {
  firstName: string
  experienceYears: number
  trainingLevel: 'beginner' | 'intermediate' | 'advanced'
  heightCm: number
  referenceWeightKg: number
  currentWeightKg: number
  targetWeightKg: number
  bodyFatPercent: number
  weeklyLossTargetKg: number
}

export interface CalculationSettings {
  calculationVersion: string
  baseCalories: number
  targetSteps: number
  walkKcalPer1000: number
  runKcalPerKgKm: number
  runCadenceSpm: number
  reintegrationRate: number
  positiveCap: number
  negativeCap: number
  roundingStep: number
  dayTypePlans: Record<'lower' | 'upper' | 'shoulders-arms' | 'rest', { calories: number; steps: number }>
}

export interface TrainingTemplate {
  id: string
  name: string
  shortName: string
  exercises: Array<{
    id: string
    name: string
    target: string
    note?: string
  }>
}

export interface AppState {
  schemaVersion: number
  onboardingComplete: boolean
  profile: Profile
  settings: CalculationSettings
  logs: Record<string, DailyLog>
  templates: TrainingTemplate[]
  schedule: Record<string, string>
  weeklyStrategy: 'flexible' | 'even' | 'free-meal'
}

export interface DayCalculation {
  plannedBaseCalories: number
  targetSteps: number
  runningSteps: number
  walkingSteps: number
  walkingKcal: number
  runningKcal: number
  otherCardioKcal: number
  plannedActivityKcal: number
  actualActivityKcal: number
  activityDeltaKcal: number
  rawAdjustmentKcal: number
  appliedAdjustmentKcal: number
  adjustedCalorieTarget: number
  nutritionGapKcal?: number
}
