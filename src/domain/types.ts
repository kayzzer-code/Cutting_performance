export type ActivityType =
  | 'running'
  | 'cycling'
  | 'jump-rope'
  | 'rowing'
  | 'elliptical'
  | 'stair-climber'
  | 'other'

export interface Activity {
  id: string
  date: string
  type: ActivityType
  durationMin: number
  distanceKm?: number
  met?: number
  averageWatts?: number
  level?: number
  stepRateSpm?: number
  note?: string
}

export interface Meal {
  id: string
  name: string
  calories: number
  proteinG?: number
  carbohydratesG?: number
  fatG?: number
  fiberG?: number
  quantity?: number
  quantityUnit?: 'g' | 'ml'
  mealSlot?: 'breakfast' | 'lunch' | 'snack' | 'dinner'
  barcode?: string
  brand?: string
  imageUrl?: string
  source?: 'open-food-facts' | 'manual'
  caloriesPer100?: number
  proteinPer100G?: number
  carbohydratesPer100G?: number
  fatPer100G?: number
  fiberPer100G?: number
}

export interface SetLog {
  id: string
  reps?: number
  loadKg?: number
  rir?: number
  completed: boolean
  kind?: 'work' | 'warmup'
}

export type DayType = 'upper' | 'lower' | 'shoulders-arms' | 'rest'
export type LoadConvention = 'total' | 'per-dumbbell' | 'machine' | 'bodyweight' | 'assisted' | 'unknown'
export type MuscleGroup =
  | 'chest' | 'lats' | 'upper-back' | 'traps'
  | 'front-delts' | 'side-delts' | 'rear-delts'
  | 'biceps' | 'brachialis' | 'forearms' | 'triceps'
  | 'quads' | 'hamstrings' | 'glutes' | 'adductors' | 'abductors'
  | 'calves' | 'abs' | 'lower-back'
export type MuscleRole = 'primary' | 'secondary' | 'stabilizer'
export interface MuscleContribution {
  muscleId: MuscleGroup
  role: MuscleRole
  coefficient: number
}
export interface ExerciseDefinition {
  id: string
  name: string
  equipmentId: string
  convention: LoadConvention
  muscleGroup?: string
  aliases?: string[]
  movementFamily?: string
  muscleContributions?: MuscleContribution[]
  laterality?: 'bilateral' | 'unilateral'
  defaultRestSeconds?: number
  isCustom?: boolean
  favourite?: boolean
  archived?: boolean
}
export interface TemplateExercise {
  id: string
  exerciseId?: string
  name: string
  target: string
  note?: string
  equipmentId?: string
  convention?: LoadConvention
  setCount?: number
  repsMin?: number
  repsMax?: number
  targetRir?: number
  restSeconds?: number
  movementFamily?: string
  muscleContributions?: MuscleContribution[]
  laterality?: 'bilateral' | 'unilateral'
}

export interface ExerciseLog extends TemplateExercise {
  templateLineId?: string
  replacesId?: string
  replacedById?: string
  sets: SetLog[]
}

export interface TrainingSession {
  id: string
  date: string
  templateId: string
  name: string
  status: 'planned' | 'in-progress' | 'completed'
  exercises: ExerciseLog[]
  templateVersion?: number
  startedAt?: number
  completedAt?: number
  runningSince?: number
  elapsedMs?: number
  restUntil?: number
  restRemainingMs?: number
  autoRest?: boolean
}

export interface StrengthActivity {
  performed: boolean
  plannedDayType: DayType
  dayType: DayType
  templateId?: string
  templateName?: string
  durationMin?: number
  exerciseCount?: number
  workingSetCount?: number
  source: 'manual' | 'journal'
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
  strengthActivity?: StrengthActivity
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
  exercises: TemplateExercise[]
  description?: string
  dayType?: Exclude<DayType, 'rest'>
  version?: number
  createdAt?: string
  updatedAt?: string
  archived?: boolean
}

export interface PlannedSession {
  date: string
  templateId: string
  dayType: DayType
  template?: TrainingTemplate
  typeBaseCalories: number
  typeTargetSteps: number
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
  catalogue?: ExerciseDefinition[]
  plannedSessions?: Record<string, PlannedSession>
  revision?: number
}

export interface DayCalculation {
  scheduledBaseCalories: number
  scheduledTargetSteps: number
  plannedBaseCalories: number
  targetSteps: number
  strengthTrainingBaseAdjustmentKcal: number
  strengthTrainingStepsAdjustment: number
  effectiveDayType?: DayType
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
