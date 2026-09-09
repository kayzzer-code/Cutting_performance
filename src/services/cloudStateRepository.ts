import type { SupabaseClient } from '@supabase/supabase-js'
import { createInitialState } from '../domain/seed'
import { migrateState } from '../domain/storage'
import type { AppState, ExerciseLog, FitnessGoal, Meal, SetLog, TemplateExercise, TrainingSession, TrainingTemplate } from '../domain/types'

export interface CloudStateInfo {
  exists: boolean
  revision: number
  updatedAt?: string
}

export interface CloudSaveResult {
  revision: number
  syncedAt: string
}

type SyncSource = 'local-import' | 'automatic' | 'manual'

function fail(error: { message: string } | null, context: string) {
  if (error) throw new Error(`${context} : ${error.message}`)
}

function numberOrUndefined(value: unknown) {
  return value === null || value === undefined ? undefined : Number(value)
}

function timestampOrUndefined(value: number | undefined) {
  return value === undefined ? undefined : new Date(value).toISOString()
}

function millisecondsOrUndefined(value: string | null | undefined) {
  if (!value) return undefined
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

async function upsertRows(client: SupabaseClient, table: string, rows: object[], onConflict: string) {
  if (!rows.length) return []
  const { data, error } = await client.from(table).upsert(rows, { onConflict }).select()
  fail(error, `Synchronisation de ${table}`)
  return data ?? []
}

async function selectRows(client: SupabaseClient, table: string, userId: string) {
  const rows: Record<string, unknown>[] = []
  const pageSize = 1000
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await client.from(table).select('*').eq('user_id', userId).range(from, from + pageSize - 1)
    fail(error, `Lecture de ${table}`)
    const page = (data ?? []) as Record<string, unknown>[]
    rows.push(...page)
    if (page.length < pageSize) break
  }
  return rows
}

export async function inspectCloudState(client: SupabaseClient, userId: string): Promise<CloudStateInfo> {
  const { data, error } = await client.from('profiles').select('cloud_revision,updated_at').eq('id', userId).maybeSingle()
  fail(error, 'Lecture du profil cloud')
  return data ? { exists: true, revision: Number(data.cloud_revision ?? 0), updatedAt: data.updated_at } : { exists: false, revision: 0 }
}

function templateExerciseFromRow(row: Record<string, unknown>): TemplateExercise {
  return {
    id: String(row.local_id),
    exerciseId: row.exercise_local_id ? String(row.exercise_local_id) : undefined,
    name: String(row.name),
    target: String(row.target ?? ''),
    note: row.note ? String(row.note) : undefined,
    equipmentId: row.equipment_id ? String(row.equipment_id) : undefined,
    convention: row.load_convention as TemplateExercise['convention'],
    setCount: numberOrUndefined(row.set_count), repsMin: numberOrUndefined(row.reps_min), repsMax: numberOrUndefined(row.reps_max),
    targetRir: numberOrUndefined(row.target_rir), restSeconds: numberOrUndefined(row.rest_seconds),
    movementFamily: row.movement_family ? String(row.movement_family) : undefined,
    muscleContributions: Array.isArray(row.muscle_contributions) ? row.muscle_contributions as TemplateExercise['muscleContributions'] : [],
    laterality: row.laterality as TemplateExercise['laterality'],
  }
}

export async function loadCloudState(client: SupabaseClient, userId: string): Promise<AppState | null> {
  const { data: profile, error: profileError } = await client.from('profiles').select('*').eq('id', userId).maybeSingle()
  fail(profileError, 'Lecture du profil cloud')
  if (!profile) return null

  const tableNames = [
    'goals', 'calculation_settings', 'goal_day_plans', 'custom_exercises', 'training_templates',
    'template_exercises', 'daily_logs', 'activities', 'meals', 'planned_sessions',
    'training_sessions', 'session_exercises', 'training_sets',
  ] as const
  const results = await Promise.all(tableNames.map(table => selectRows(client, table, userId)))
  const tables = Object.fromEntries(tableNames.map((name, index) => [name, results[index]])) as Record<typeof tableNames[number], Record<string, unknown>[]>

  const goalsByDatabaseId = new Map<number, FitnessGoal>()
  const goals = tables.goals.map((row): FitnessGoal => {
    const goal: FitnessGoal = {
      id: String(row.local_id), name: String(row.name), type: row.type as FitnessGoal['type'], status: row.status as FitnessGoal['status'],
      startDate: String(row.start_date), targetDate: row.target_date ? String(row.target_date) : undefined,
      endedAt: row.ended_at ? String(row.ended_at) : undefined, createdAt: String(row.created_at).slice(0, 10),
      referenceWeightKg: Number(row.reference_weight_kg), targetWeightKg: Number(row.target_weight_kg),
      referenceBodyFatPercent: Number(row.reference_body_fat_percent), targetBodyFatPercent: numberOrUndefined(row.target_body_fat_percent),
      maxBodyFatIncreasePercent: numberOrUndefined(row.max_body_fat_increase_percent), heightCm: Number(row.height_cm),
      trainingLevel: row.training_level as FitnessGoal['trainingLevel'], targetWeightChangeKgPerWeek: Number(row.target_weight_change_kg_per_week),
      priorities: Array.isArray(row.priorities) ? row.priorities as FitnessGoal['priorities'] : [],
      enduranceDiscipline: row.endurance_discipline as FitnessGoal['enduranceDiscipline'], eventName: row.event_name ? String(row.event_name) : undefined,
      strengthExercise: row.strength_exercise ? String(row.strength_exercise) : undefined, strengthTargetKg: numberOrUndefined(row.strength_target_kg),
      objectiveNote: row.objective_note ? String(row.objective_note) : undefined,
    }
    goalsByDatabaseId.set(Number(row.id), goal)
    return goal
  })
  const activeGoal = goalsByDatabaseId.get(Number(profile.active_goal_id)) ?? goals.find(goal => goal.status === 'active') ?? goals[0]
  const settingsRow = tables.calculation_settings.find(row => Number(row.goal_id) === Number(profile.active_goal_id)) ?? tables.calculation_settings[0]
  const dayPlans = Object.fromEntries(tables.goal_day_plans.filter(row => !settingsRow || Number(row.goal_id) === Number(settingsRow.goal_id)).map(row => [String(row.day_type), { calories: Number(row.calories), steps: Number(row.steps) }]))

  const templatesByDatabaseId = new Map<number, TrainingTemplate>()
  const templates = tables.training_templates.map((row): TrainingTemplate => {
    const template: TrainingTemplate = {
      id: String(row.local_id), name: String(row.name), shortName: String(row.short_name), description: row.description ? String(row.description) : undefined,
      dayType: row.day_type as TrainingTemplate['dayType'], version: Number(row.template_version), archived: Boolean(row.archived),
      createdAt: String(row.created_at), updatedAt: String(row.updated_at), exercises: [],
    }
    templatesByDatabaseId.set(Number(row.id), template)
    return template
  })
  for (const row of [...tables.template_exercises].sort((a, b) => Number(a.position) - Number(b.position))) {
    templatesByDatabaseId.get(Number(row.template_id))?.exercises.push(templateExerciseFromRow(row))
  }

  const dailyLogsByDatabaseId = new Map<number, AppState['logs'][string]>()
  const logs: AppState['logs'] = {}
  for (const row of tables.daily_logs) {
    const date = String(row.log_date)
    const log: AppState['logs'][string] = {
      date, plannedBaseCalories: numberOrUndefined(row.planned_base_calories), targetSteps: numberOrUndefined(row.target_steps),
      totalSteps: numberOrUndefined(row.total_steps), caloriesConsumed: numberOrUndefined(row.calories_consumed), weightKg: numberOrUndefined(row.weight_kg),
      strengthActivity: row.strength_activity as AppState['logs'][string]['strengthActivity'], meals: [], activities: [],
    }
    logs[date] = log
    dailyLogsByDatabaseId.set(Number(row.id), log)
  }
  for (const row of tables.activities) {
    const log = dailyLogsByDatabaseId.get(Number(row.daily_log_id)); if (!log) continue
    log.activities.push({
      id: String(row.local_id), date: log.date, type: row.type as AppState['logs'][string]['activities'][number]['type'], durationMin: Number(row.duration_min),
      distanceKm: numberOrUndefined(row.distance_km), met: numberOrUndefined(row.met), averageWatts: numberOrUndefined(row.average_watts),
      level: numberOrUndefined(row.level), stepRateSpm: numberOrUndefined(row.step_rate_spm), note: row.note ? String(row.note) : undefined,
    })
  }
  for (const row of tables.meals) {
    const log = dailyLogsByDatabaseId.get(Number(row.daily_log_id)); if (!log) continue
    const meal: Meal = {
      id: String(row.local_id), name: String(row.name), calories: Number(row.calories), proteinG: numberOrUndefined(row.protein_g),
      carbohydratesG: numberOrUndefined(row.carbohydrates_g), fatG: numberOrUndefined(row.fat_g), fiberG: numberOrUndefined(row.fiber_g),
      quantity: numberOrUndefined(row.quantity), quantityUnit: row.quantity_unit as Meal['quantityUnit'], mealSlot: row.meal_slot as Meal['mealSlot'],
      barcode: row.barcode ? String(row.barcode) : undefined, brand: row.brand ? String(row.brand) : undefined, imageUrl: row.image_url ? String(row.image_url) : undefined,
      source: row.source as Meal['source'], caloriesPer100: numberOrUndefined(row.calories_per_100), proteinPer100G: numberOrUndefined(row.protein_per_100_g),
      carbohydratesPer100G: numberOrUndefined(row.carbohydrates_per_100_g), fatPer100G: numberOrUndefined(row.fat_per_100_g), fiberPer100G: numberOrUndefined(row.fiber_per_100_g),
    }
    log.meals.push(meal)
  }

  const sessionsByDatabaseId = new Map<number, TrainingSession>()
  const sessionExerciseRows = new Map<number, ExerciseLog>()
  for (const row of tables.training_sessions) {
    const log = dailyLogsByDatabaseId.get(Number(row.daily_log_id)); if (!log) continue
    const session: TrainingSession = {
      id: String(row.local_id), date: log.date, templateId: String(row.template_local_id), name: String(row.name), status: row.status as TrainingSession['status'],
      exercises: [], templateVersion: numberOrUndefined(row.template_version), startedAt: millisecondsOrUndefined(row.started_at as string),
      completedAt: millisecondsOrUndefined(row.completed_at as string), runningSince: millisecondsOrUndefined(row.running_since as string),
      elapsedMs: numberOrUndefined(row.elapsed_ms), restUntil: millisecondsOrUndefined(row.rest_until as string), restRemainingMs: numberOrUndefined(row.rest_remaining_ms),
      autoRest: row.auto_rest === null ? undefined : Boolean(row.auto_rest),
    }
    log.training = session
    sessionsByDatabaseId.set(Number(row.id), session)
  }
  for (const row of [...tables.session_exercises].sort((a, b) => Number(a.position) - Number(b.position))) {
    const session = sessionsByDatabaseId.get(Number(row.session_id)); if (!session) continue
    const exercise: ExerciseLog = {
      ...templateExerciseFromRow(row), templateLineId: row.template_line_id ? String(row.template_line_id) : undefined,
      replacesId: row.replaces_id ? String(row.replaces_id) : undefined, replacedById: row.replaced_by_id ? String(row.replaced_by_id) : undefined, sets: [],
    }
    session.exercises.push(exercise)
    sessionExerciseRows.set(Number(row.id), exercise)
  }
  for (const row of [...tables.training_sets].sort((a, b) => Number(a.position) - Number(b.position))) {
    const exercise = sessionExerciseRows.get(Number(row.session_exercise_id)); if (!exercise) continue
    const set: SetLog = { id: String(row.local_id), reps: numberOrUndefined(row.reps), loadKg: numberOrUndefined(row.load_kg), rir: numberOrUndefined(row.rir), completed: Boolean(row.completed), kind: row.kind as SetLog['kind'] }
    exercise.sets.push(set)
  }

  const plannedSessions: NonNullable<AppState['plannedSessions']> = {}
  const schedule: AppState['schedule'] = {}
  for (const row of tables.planned_sessions) {
    const date = String(row.session_date); const templateId = String(row.template_local_id)
    schedule[date] = templateId
    plannedSessions[date] = {
      date, templateId, dayType: row.day_type as NonNullable<AppState['plannedSessions']>[string]['dayType'],
      template: row.template_snapshot && typeof row.template_snapshot === 'object' ? row.template_snapshot as TrainingTemplate : undefined,
      typeBaseCalories: Number(row.type_base_calories), typeTargetSteps: Number(row.type_target_steps),
    }
  }

  const base = createInitialState()
  return migrateState({
    ...base,
    schemaVersion: Number(profile.app_schema_version ?? 6), onboardingComplete: Boolean(profile.onboarding_complete),
    profile: {
      firstName: String(profile.first_name ?? ''), experienceYears: Number(profile.experience_years), trainingLevel: profile.training_level,
      heightCm: Number(profile.height_cm), referenceWeightKg: activeGoal?.referenceWeightKg ?? Number(profile.current_weight_kg),
      currentWeightKg: Number(profile.current_weight_kg), targetWeightKg: activeGoal?.targetWeightKg ?? Number(profile.current_weight_kg),
      bodyFatPercent: Number(profile.body_fat_percent), weeklyLossTargetKg: Math.abs(Math.min(0, activeGoal?.targetWeightChangeKgPerWeek ?? 0)),
    },
    goals, activeGoalId: activeGoal?.id,
    settings: settingsRow ? {
      calculationVersion: String(settingsRow.calculation_version), baseCalories: Number(settingsRow.base_calories), targetSteps: Number(settingsRow.target_steps),
      walkKcalPer1000: Number(settingsRow.walk_kcal_per_1000), runKcalPerKgKm: Number(settingsRow.run_kcal_per_kg_km), runCadenceSpm: Number(settingsRow.run_cadence_spm),
      reintegrationRate: Number(settingsRow.reintegration_rate), positiveCap: Number(settingsRow.positive_cap), negativeCap: Number(settingsRow.negative_cap),
      roundingStep: Number(settingsRow.rounding_step), dayTypePlans: { ...base.settings.dayTypePlans, ...dayPlans },
    } : base.settings,
    logs, templates, schedule, weeklyStrategy: profile.weekly_strategy, catalogue: tables.custom_exercises.map(row => ({
      id: String(row.local_id), name: String(row.name), equipmentId: String(row.equipment_id), convention: row.load_convention,
      muscleGroup: row.muscle_group ? String(row.muscle_group) : undefined, aliases: Array.isArray(row.aliases) ? row.aliases as string[] : [],
      movementFamily: row.movement_family ? String(row.movement_family) : undefined,
      muscleContributions: Array.isArray(row.muscle_contributions) ? row.muscle_contributions : [], laterality: row.laterality ?? undefined,
      defaultRestSeconds: numberOrUndefined(row.default_rest_seconds), isCustom: true, favourite: Boolean(row.favourite), archived: Boolean(row.archived),
    })), plannedSessions, revision: Number(profile.cloud_revision ?? 0),
  })
}

function templateExerciseRow(userId: string, templateId: number, exercise: TemplateExercise, position: number, syncToken: string) {
  return {
    user_id: userId, template_id: templateId, local_id: exercise.id, exercise_local_id: exercise.exerciseId ?? null, position, name: exercise.name, target: exercise.target,
    note: exercise.note ?? null, equipment_id: exercise.equipmentId ?? null, load_convention: exercise.convention ?? null, set_count: exercise.setCount ?? null,
    reps_min: exercise.repsMin ?? null, reps_max: exercise.repsMax ?? null, target_rir: exercise.targetRir ?? null, rest_seconds: exercise.restSeconds ?? null,
    movement_family: exercise.movementFamily ?? null, muscle_contributions: exercise.muscleContributions ?? [], laterality: exercise.laterality ?? null, sync_token: syncToken,
  }
}

export async function saveCloudState(client: SupabaseClient, userId: string, state: AppState, source: SyncSource, expectedCloudRevision?: number): Promise<CloudSaveResult> {
  const syncToken = crypto.randomUUID()
  const current = await inspectCloudState(client, userId)
  if (expectedCloudRevision !== undefined && current.exists && current.revision !== expectedCloudRevision) {
    throw new Error('Une version cloud plus récente existe. Recharge-la avant de synchroniser tes modifications.')
  }
  const activeGoal = state.goals.find(goal => goal.id === state.activeGoalId) ?? state.goals.find(goal => goal.status === 'active') ?? state.goals[0]
  const profileRow = {
    id: userId, first_name: state.profile.firstName, experience_years: state.profile.experienceYears, training_level: state.profile.trainingLevel,
    height_cm: state.profile.heightCm, current_weight_kg: state.profile.currentWeightKg, body_fat_percent: state.profile.bodyFatPercent,
    onboarding_complete: state.onboardingComplete, weekly_strategy: state.weeklyStrategy, app_schema_version: state.schemaVersion, cloud_revision: current.revision,
    active_goal_id: null,
  }
  const { error: profileError } = await client.from('profiles').upsert(profileRow, { onConflict: 'id' })
  fail(profileError, 'Sauvegarde du profil')
  const { error: runError } = await client.from('sync_runs').insert({
    user_id: userId, sync_token: syncToken, source, status: 'started', source_revision: state.revision ?? 0,
    backup_payload: source === 'local-import' ? state : null,
  })
  fail(runError, 'Création du journal de synchronisation')

  try {
    if (activeGoal) {
      const { error } = await client.from('goals').update({ status: 'cancelled' }).eq('user_id', userId).eq('status', 'active').neq('local_id', activeGoal.id)
      fail(error, 'Préparation de l’objectif actif')
    }
    const goalRows = state.goals.map(goal => ({
      user_id: userId, local_id: goal.id, name: goal.name, type: goal.type, status: goal.status, start_date: goal.startDate, target_date: goal.targetDate ?? null,
      ended_at: goal.endedAt ?? null, reference_weight_kg: goal.referenceWeightKg, target_weight_kg: goal.targetWeightKg,
      reference_body_fat_percent: goal.referenceBodyFatPercent, target_body_fat_percent: goal.targetBodyFatPercent ?? null,
      max_body_fat_increase_percent: goal.maxBodyFatIncreasePercent ?? null, height_cm: goal.heightCm, training_level: goal.trainingLevel,
      target_weight_change_kg_per_week: goal.targetWeightChangeKgPerWeek, priorities: goal.priorities, endurance_discipline: goal.enduranceDiscipline ?? null,
      event_name: goal.eventName ?? null, strength_exercise: goal.strengthExercise ?? null, strength_target_kg: goal.strengthTargetKg ?? null,
      objective_note: goal.objectiveNote ?? null, sync_token: syncToken, created_at: `${goal.createdAt}T00:00:00.000Z`,
    }))
    const savedGoals = await upsertRows(client, 'goals', goalRows, 'user_id,local_id')
    const goalIds = new Map(savedGoals.map(row => [String(row.local_id), Number(row.id)]))
    const activeGoalDatabaseId = activeGoal ? goalIds.get(activeGoal.id) : undefined

    if (activeGoal && activeGoalDatabaseId) {
      await upsertRows(client, 'calculation_settings', [{
        user_id: userId, goal_id: activeGoalDatabaseId, calculation_version: state.settings.calculationVersion, base_calories: state.settings.baseCalories,
        target_steps: state.settings.targetSteps, walk_kcal_per_1000: state.settings.walkKcalPer1000, run_kcal_per_kg_km: state.settings.runKcalPerKgKm,
        run_cadence_spm: state.settings.runCadenceSpm, reintegration_rate: state.settings.reintegrationRate, positive_cap: state.settings.positiveCap,
        negative_cap: state.settings.negativeCap, rounding_step: state.settings.roundingStep, sync_token: syncToken,
      }], 'goal_id,user_id')
      await upsertRows(client, 'goal_day_plans', Object.entries(state.settings.dayTypePlans).map(([dayType, plan]) => ({
        user_id: userId, goal_id: activeGoalDatabaseId, day_type: dayType, calories: plan.calories, steps: plan.steps, sync_token: syncToken,
      })), 'goal_id,day_type')
    }

    await upsertRows(client, 'custom_exercises', (state.catalogue ?? []).filter(item => item.isCustom).map(item => ({
      user_id: userId, local_id: item.id, name: item.name, equipment_id: item.equipmentId, load_convention: item.convention, muscle_group: item.muscleGroup ?? null,
      aliases: item.aliases ?? [], movement_family: item.movementFamily ?? null, muscle_contributions: item.muscleContributions ?? [], laterality: item.laterality ?? null,
      default_rest_seconds: item.defaultRestSeconds ?? null, favourite: item.favourite ?? false, archived: item.archived ?? false, sync_token: syncToken,
    })), 'user_id,local_id')

    const fallbackTemplateCreatedAt = `${state.goals[0]?.createdAt ?? new Date().toISOString().slice(0, 10)}T00:00:00.000Z`
    const templateRows = state.templates.map(template => ({
      user_id: userId, local_id: template.id, name: template.name, short_name: template.shortName, description: template.description ?? null,
      day_type: template.dayType ?? 'upper', template_version: template.version ?? 1, archived: template.archived ?? false, sync_token: syncToken,
      created_at: template.createdAt ?? fallbackTemplateCreatedAt,
    }))
    const savedTemplates = await upsertRows(client, 'training_templates', templateRows, 'user_id,local_id')
    const templateIds = new Map(savedTemplates.map(row => [String(row.local_id), Number(row.id)]))
    await upsertRows(client, 'template_exercises', state.templates.flatMap(template => {
      const templateId = templateIds.get(template.id)
      return templateId ? template.exercises.map((exercise, index) => templateExerciseRow(userId, templateId, exercise, index, syncToken)) : []
    }), 'template_id,local_id')

    const logRows = Object.values(state.logs).map(log => ({
      user_id: userId, log_date: log.date, planned_base_calories: log.plannedBaseCalories ?? null, target_steps: log.targetSteps ?? null,
      total_steps: log.totalSteps ?? null, calories_consumed: log.caloriesConsumed ?? null, weight_kg: log.weightKg ?? null,
      strength_activity: log.strengthActivity ?? null, sync_token: syncToken,
    }))
    const savedLogs = await upsertRows(client, 'daily_logs', logRows, 'user_id,log_date')
    const logIds = new Map(savedLogs.map(row => [String(row.log_date), Number(row.id)]))
    await upsertRows(client, 'activities', Object.values(state.logs).flatMap(log => {
      const dailyLogId = logIds.get(log.date)
      return dailyLogId ? log.activities.map(activity => ({
        user_id: userId, daily_log_id: dailyLogId, local_id: activity.id, type: activity.type, duration_min: activity.durationMin,
        distance_km: activity.distanceKm ?? null, met: activity.met ?? null, average_watts: activity.averageWatts ?? null, level: activity.level ?? null,
        step_rate_spm: activity.stepRateSpm ?? null, note: activity.note ?? null, sync_token: syncToken,
      })) : []
    }), 'user_id,local_id')
    await upsertRows(client, 'meals', Object.values(state.logs).flatMap(log => {
      const dailyLogId = logIds.get(log.date)
      return dailyLogId ? log.meals.map(meal => ({
        user_id: userId, daily_log_id: dailyLogId, local_id: meal.id, name: meal.name, calories: meal.calories, protein_g: meal.proteinG ?? null,
        carbohydrates_g: meal.carbohydratesG ?? null, fat_g: meal.fatG ?? null, fiber_g: meal.fiberG ?? null, quantity: meal.quantity ?? null,
        quantity_unit: meal.quantityUnit ?? null, meal_slot: meal.mealSlot ?? null, barcode: meal.barcode ?? null, brand: meal.brand ?? null,
        image_url: meal.imageUrl ?? null, source: meal.source ?? null, calories_per_100: meal.caloriesPer100 ?? null,
        protein_per_100_g: meal.proteinPer100G ?? null, carbohydrates_per_100_g: meal.carbohydratesPer100G ?? null,
        fat_per_100_g: meal.fatPer100G ?? null, fiber_per_100_g: meal.fiberPer100G ?? null, sync_token: syncToken,
      })) : []
    }), 'user_id,local_id')

    const products = new Map<string, Record<string, unknown>>()
    for (const meal of Object.values(state.logs).flatMap(log => log.meals).filter(item => item.barcode)) products.set(meal.barcode!, {
      user_id: userId, barcode: meal.barcode, name: meal.name, brand: meal.brand ?? null, image_url: meal.imageUrl ?? null, source: meal.source ?? 'manual',
      calories_per_100: meal.caloriesPer100 ?? null, protein_per_100_g: meal.proteinPer100G ?? null, carbohydrates_per_100_g: meal.carbohydratesPer100G ?? null,
      fat_per_100_g: meal.fatPer100G ?? null, fiber_per_100_g: meal.fiberPer100G ?? null, sync_token: syncToken,
    })
    await upsertRows(client, 'food_products', [...products.values()], 'user_id,barcode')

    await upsertRows(client, 'planned_sessions', Object.values(state.plannedSessions ?? {}).map(planned => ({
      user_id: userId, session_date: planned.date, template_local_id: planned.templateId, day_type: planned.dayType,
      template_snapshot: planned.template ?? null, type_base_calories: planned.typeBaseCalories, type_target_steps: planned.typeTargetSteps, sync_token: syncToken,
    })), 'user_id,session_date')

    const trainingRows = Object.values(state.logs).flatMap(log => {
      const dailyLogId = logIds.get(log.date); const session = log.training
      return dailyLogId && session ? [{
        user_id: userId, daily_log_id: dailyLogId, local_id: session.id, template_local_id: session.templateId, name: session.name, status: session.status,
        template_version: session.templateVersion ?? null, started_at: timestampOrUndefined(session.startedAt) ?? null,
        completed_at: timestampOrUndefined(session.completedAt) ?? null, running_since: timestampOrUndefined(session.runningSince) ?? null,
        elapsed_ms: session.elapsedMs ?? null, rest_until: timestampOrUndefined(session.restUntil) ?? null, rest_remaining_ms: session.restRemainingMs ?? null,
        auto_rest: session.autoRest ?? null, sync_token: syncToken,
      }] : []
    })
    const savedSessions = await upsertRows(client, 'training_sessions', trainingRows, 'daily_log_id')
    const sessionIds = new Map(savedSessions.map(row => [String(row.local_id), Number(row.id)]))
    const sourceSessions = Object.values(state.logs).flatMap(log => log.training ? [log.training] : [])
    const sessionExerciseRowsToSave = sourceSessions.flatMap(session => {
      const sessionId = sessionIds.get(session.id)
      return sessionId ? session.exercises.map((exercise, index) => ({
        ...templateExerciseRow(userId, sessionId, exercise, index, syncToken), session_id: sessionId, template_id: undefined,
        template_line_id: exercise.templateLineId ?? null, replaces_id: exercise.replacesId ?? null, replaced_by_id: exercise.replacedById ?? null,
      })) : []
    }).map(({ template_id: _templateId, ...row }) => row)
    const savedSessionExercises = await upsertRows(client, 'session_exercises', sessionExerciseRowsToSave, 'session_id,local_id')
    const sessionExerciseIds = new Map(savedSessionExercises.map(row => [`${row.session_id}:${row.local_id}`, Number(row.id)]))
    await upsertRows(client, 'training_sets', sourceSessions.flatMap(session => {
      const sessionId = sessionIds.get(session.id)
      return sessionId ? session.exercises.flatMap(exercise => {
        const exerciseId = sessionExerciseIds.get(`${sessionId}:${exercise.id}`)
        return exerciseId ? exercise.sets.map((set, index) => ({
          user_id: userId, session_exercise_id: exerciseId, local_id: set.id, position: index, reps: set.reps ?? null, load_kg: set.loadKg ?? null,
          rir: set.rir ?? null, completed: set.completed, kind: set.kind ?? 'work', sync_token: syncToken,
        })) : []
      }) : []
    }), 'session_exercise_id,local_id')

    const cleanupOrder = ['training_sets', 'session_exercises', 'training_sessions', 'template_exercises', 'activities', 'meals', 'planned_sessions', 'food_products', 'custom_exercises', 'goal_day_plans', 'calculation_settings', 'daily_logs', 'training_templates', 'goals']
    for (const table of cleanupOrder) {
      const { error } = await client.from(table).delete().eq('user_id', userId).neq('sync_token', syncToken)
      fail(error, `Nettoyage de ${table}`)
    }

    const nextRevision = Math.max(current.revision + 1, state.revision ?? 0)
    const { data: updatedProfiles, error: revisionError } = await client.from('profiles').update({
      active_goal_id: activeGoalDatabaseId ?? null, cloud_revision: nextRevision,
    }).eq('id', userId).eq('cloud_revision', current.revision).select('updated_at')
    fail(revisionError, 'Validation de la révision cloud')
    if (!updatedProfiles?.length) throw new Error('La synchronisation a rencontré une modification concurrente. Recharge les données cloud.')

    const entityCounts = {
      goals: state.goals.length, logs: Object.keys(state.logs).length, activities: Object.values(state.logs).reduce((sum, log) => sum + log.activities.length, 0),
      meals: Object.values(state.logs).reduce((sum, log) => sum + log.meals.length, 0), templates: state.templates.length,
      sessions: sourceSessions.length, sets: sourceSessions.reduce((sum, session) => sum + session.exercises.reduce((subtotal, exercise) => subtotal + exercise.sets.length, 0), 0),
    }
    const { error: completeError } = await client.from('sync_runs').update({ status: 'completed', completed_at: new Date().toISOString(), entity_counts: entityCounts }).eq('user_id', userId).eq('sync_token', syncToken)
    fail(completeError, 'Finalisation du journal de synchronisation')
    return { revision: nextRevision, syncedAt: String(updatedProfiles[0].updated_at) }
  } catch (cause) {
    await client.from('sync_runs').update({ status: 'failed', completed_at: new Date().toISOString(), error_message: cause instanceof Error ? cause.message : String(cause) }).eq('user_id', userId).eq('sync_token', syncToken)
    throw cause
  }
}
