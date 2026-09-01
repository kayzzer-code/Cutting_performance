import { addDays, isoDate } from './dates'
import type { AppState, CalculationSettings, DailyLog, TrainingTemplate } from './types'

const upperA: TrainingTemplate = {
  id: 'upper-a',
  name: 'Upper A · Pectoraux sans poussée',
  shortName: 'Upper A',
  exercises: [
    { id: 'pec-deck', name: 'Pec deck', target: '4 × 10–15', note: 'Amplitude indolore, tempo contrôlé' },
    { id: 'cable-fly', name: 'Écarté poulie vis-à-vis', target: '3 × 12–18', note: 'Pas de poussée, omoplates stables' },
    { id: 'pulldown-neutral', name: 'Tirage vertical prise neutre', target: '4 × 8–12' },
    { id: 'chest-row', name: 'Rowing poitrine appuyée', target: '4 × 10–14' },
    { id: 'rear-delt', name: 'Oiseau machine', target: '3 × 15–25' },
  ],
}

const upperB: TrainingTemplate = {
  id: 'upper-b',
  name: 'Upper B · Dos & écartés',
  shortName: 'Upper B',
  exercises: [
    { id: 'low-cable-fly', name: 'Écarté poulie basse', target: '4 × 12–18', note: 'Arrêter avant toute douleur antérieure' },
    { id: 'single-lat', name: 'Tirage vertical unilatéral', target: '4 × 10–14' },
    { id: 'seated-row', name: 'Rowing assis prise neutre', target: '4 × 10–15' },
    { id: 'straight-arm', name: 'Pull-over poulie bras tendus', target: '3 × 12–18' },
    { id: 'lateral-raise', name: 'Élévations latérales poulie', target: '4 × 15–25' },
  ],
}

const lowerA: TrainingTemplate = {
  id: 'lower-a',
  name: 'Lower A · Quadriceps',
  shortName: 'Lower A',
  exercises: [
    { id: 'hack-squat', name: 'Hack squat', target: '4 × 8–12' },
    { id: 'leg-press', name: 'Presse à cuisses', target: '3 × 12–15' },
    { id: 'leg-extension', name: 'Leg extension', target: '4 × 12–20' },
    { id: 'seated-curl', name: 'Leg curl assis', target: '4 × 10–15' },
    { id: 'calves-a', name: 'Mollets debout', target: '4 × 10–15' },
  ],
}

const lowerB: TrainingTemplate = {
  id: 'lower-b',
  name: 'Lower B · Ischios & fessiers',
  shortName: 'Lower B',
  exercises: [
    { id: 'rdl', name: 'Soulevé de terre roumain', target: '4 × 8–12' },
    { id: 'lying-curl', name: 'Leg curl allongé', target: '4 × 10–15' },
    { id: 'split-squat', name: 'Fente bulgare', target: '3 × 10–14 / jambe' },
    { id: 'hip-thrust', name: 'Hip thrust machine', target: '3 × 10–15' },
    { id: 'calves-b', name: 'Mollets assis', target: '4 × 12–20' },
  ],
}

const shouldersArms: TrainingTemplate = {
  id: 'shoulders-arms',
  name: 'Épaules & bras · sans poussée',
  shortName: 'Épaules-bras',
  exercises: [
    { id: 'lateral-machine', name: 'Élévations latérales machine', target: '5 × 12–25' },
    { id: 'reverse-fly', name: 'Reverse pec deck', target: '4 × 15–25' },
    { id: 'cable-curl', name: 'Curl poulie', target: '4 × 10–15' },
    { id: 'incline-curl', name: 'Curl incliné léger', target: '3 × 12–15', note: 'Seulement si l’épaule reste neutre et indolore' },
    { id: 'pushdown', name: 'Extension triceps corde', target: '4 × 12–18' },
    { id: 'cross-extension', name: 'Extension triceps croisée', target: '3 × 12–18' },
  ],
}

export const trainingTemplates = [upperA, lowerA, shouldersArms, upperB, lowerB]

export function defaultPlanForTemplate(templateId: string, plans?: CalculationSettings['dayTypePlans']): { plannedBaseCalories: number; targetSteps: number } {
  const fallback: CalculationSettings['dayTypePlans'] = {
    lower: { calories: 3200, steps: 15_000 }, upper: { calories: 3100, steps: 18_000 },
    'shoulders-arms': { calories: 2900, steps: 17_000 }, rest: { calories: 2850, steps: 18_000 },
  }
  const source = plans ?? fallback
  const key = templateId.startsWith('lower') ? 'lower' : templateId.startsWith('upper') ? 'upper' : templateId === 'shoulders-arms' ? 'shoulders-arms' : 'rest'
  return { plannedBaseCalories: source[key].calories, targetSteps: source[key].steps }
}

function buildSchedule(today: string): Record<string, string> {
  const cycle = ['shoulders-arms', 'upper-b', 'lower-b', 'rest', 'upper-a', 'lower-a', 'rest']
  const schedule: Record<string, string> = {}
  for (let offset = -365; offset <= 365; offset += 1) {
    const normalized = ((offset % cycle.length) + cycle.length) % cycle.length
    schedule[addDays(today, offset)] = cycle[normalized]
  }
  return schedule
}

function emptyLog(date: string): DailyLog {
  return { date, meals: [], activities: [] }
}

export function createInitialState(today = isoDate()): AppState {
  const schedule = buildSchedule(today)
  const logs: Record<string, DailyLog> = {}
  for (let offset = -14; offset <= 14; offset += 1) {
    const date = addDays(today, offset)
    logs[date] = { ...emptyLog(date), ...defaultPlanForTemplate(schedule[date] ?? 'rest') }
  }

  return {
    schemaVersion: 2,
    onboardingComplete: false,
    profile: {
      firstName: 'Thomas',
      experienceYears: 8,
      trainingLevel: 'advanced',
      heightCm: 176,
      referenceWeightKg: 90,
      currentWeightKg: 90,
      targetWeightKg: 80,
      bodyFatPercent: 24,
      weeklyLossTargetKg: 0.8,
    },
    settings: {
      calculationVersion: '2026.1',
      baseCalories: 3100,
      targetSteps: 18_000,
      walkKcalPer1000: 34,
      runKcalPerKgKm: 1,
      runCadenceSpm: 170,
      reintegrationRate: 0.8,
      positiveCap: 1500,
      negativeCap: -300,
      roundingStep: 50,
      dayTypePlans: {
        lower: { calories: 3200, steps: 15_000 },
        upper: { calories: 3100, steps: 18_000 },
        'shoulders-arms': { calories: 2900, steps: 17_000 },
        rest: { calories: 2850, steps: 18_000 },
      },
    },
    logs,
    templates: trainingTemplates,
    schedule,
    weeklyStrategy: 'flexible',
  }
}
