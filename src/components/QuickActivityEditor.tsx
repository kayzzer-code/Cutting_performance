import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Bike, Cable, ChartNoAxesColumnIncreasing, Check, CircleEllipsis, Footprints, Gauge, Orbit, SportShoe, Waves, X } from 'lucide-react'
import { activityDefaultMet, calculateDay, estimateOtherCardioKcal, estimateRunningSteps, matrixClimbMillStepRate } from '../domain/calculations'
import { formatNumber } from '../domain/format'
import { journalLogForDate } from '../domain/journal'
import { uid } from '../domain/training'
import type { Activity, ActivityType } from '../domain/types'
import { useApp } from '../state/AppContext'

export type QuickActivityEditorType = 'steps' | ActivityType

interface QuickActivityEditorProps {
  date: string
  type: QuickActivityEditorType
  onClose: () => void
}

const activityMeta: Record<QuickActivityEditorType, { title: string; subtitle: string; icon: ReactNode; tone: string }> = {
  steps: { title: 'Pas hors course', subtitle: 'Marche et déplacements de la journée', icon: <SportShoe />, tone: 'teal' },
  running: { title: 'Course à pied', subtitle: 'Durée, distance et allure moyenne', icon: <Footprints />, tone: 'blue' },
  cycling: { title: 'Vélo', subtitle: 'Durée et puissance moyenne', icon: <Bike />, tone: 'teal' },
  'jump-rope': { title: 'Corde à sauter', subtitle: 'Durée du cardio', icon: <Cable />, tone: 'teal' },
  rowing: { title: 'Rameur', subtitle: 'Durée du cardio', icon: <Waves />, tone: 'navy' },
  elliptical: { title: 'Elliptique', subtitle: 'Durée du cardio', icon: <Orbit />, tone: 'teal' },
  'stair-climber': { title: 'StairMaster', subtitle: 'Durée et niveau Matrix', icon: <ChartNoAxesColumnIncreasing />, tone: 'blue' },
  other: { title: 'Autre cardio', subtitle: 'Durée de l’activité', icon: <CircleEllipsis />, tone: 'blue' },
}

export function QuickActivityEditor({ date, type, onClose }: QuickActivityEditorProps) {
  const { state, transact } = useApp()
  const log = journalLogForDate(state, date)
  const calculation = calculateDay(log, state.profile, state.settings)
  const meta = activityMeta[type]
  const runs = log.activities.filter((activity) => activity.type === 'running')
  const bikes = log.activities.filter((activity) => activity.type === 'cycling')
  const existingExtra = type !== 'steps' && type !== 'running' && type !== 'cycling'
    ? log.activities.find((activity) => activity.type === type)
    : undefined
  const initialRunMinutes = runs.reduce((sum, activity) => sum + activity.durationMin, 0)
  const initialRunDistance = runs.reduce((sum, activity) => sum + (activity.distanceKm ?? 0), 0)
  const initialBikeMinutes = bikes.reduce((sum, activity) => sum + activity.durationMin, 0)
  const bikePowerMinutes = bikes.reduce((sum, activity) => sum + (activity.averageWatts ? activity.durationMin : 0), 0)
  const initialBikeWatts = bikePowerMinutes
    ? Math.round(bikes.reduce((sum, activity) => sum + (activity.averageWatts ?? 0) * activity.durationMin, 0) / bikePowerMinutes)
    : 0
  const initialExtraMinutes = existingExtra?.durationMin ?? 0
  const [walkingSteps, setWalkingSteps] = useState(log.totalSteps === undefined ? 0 : calculation.walkingSteps)
  const [runMinutes, setRunMinutes] = useState(initialRunMinutes)
  const [runDistance, setRunDistance] = useState(initialRunDistance)
  const [bikeMinutes, setBikeMinutes] = useState(initialBikeMinutes)
  const [bikeWatts, setBikeWatts] = useState(initialBikeWatts)
  const [extraMinutes, setExtraMinutes] = useState(Math.floor(initialExtraMinutes))
  const [stairSeconds, setStairSeconds] = useState(type === 'stair-climber' ? Math.round((initialExtraMinutes % 1) * 60) : 0)
  const [stairLevel, setStairLevel] = useState(existingExtra?.level ?? 10)
  const [saveState, setSaveState] = useState<'saved' | 'error'>('saved')
  const noticeTimer = useRef<number | undefined>(undefined)
  const [activityId] = useState(() => type === 'running' ? runs[0]?.id ?? uid('activity')
    : type === 'cycling' ? bikes[0]?.id ?? uid('activity')
      : existingExtra?.id ?? uid('activity'))

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      window.removeEventListener('keydown', closeOnEscape)
      if (noticeTimer.current) window.clearTimeout(noticeTimer.current)
    }
  }, [onClose])

  function announce(saved: boolean) {
    setSaveState(saved ? 'saved' : 'error')
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current)
    noticeTimer.current = window.setTimeout(() => setSaveState('saved'), 1800)
  }

  function saveSteps(nextWalkingSteps: number) {
    const safeSteps = Math.max(0, Math.round(nextWalkingSteps))
    setWalkingSteps(safeSteps)
    const saved = transact((current) => {
      const currentLog = journalLogForDate(current, date)
      const runningSteps = estimateRunningSteps(currentLog, current.settings.runCadenceSpm)
      return {
        ...current,
        logs: {
          ...current.logs,
          [date]: { ...currentLog, totalSteps: safeSteps + runningSteps },
        },
      }
    })
    announce(saved)
  }

  function saveActivity(activityType: ActivityType, activity: Activity | null) {
    const saved = transact((current) => {
      const currentLog = journalLogForDate(current, date)
      const walkingBefore = currentLog.totalSteps === undefined
        ? undefined
        : calculateDay(currentLog, current.profile, current.settings).walkingSteps
      const activities = currentLog.activities.filter((candidate) => candidate.type !== activityType)
      if (activity) activities.push(activity)
      const nextLog = { ...currentLog, activities }
      if (activityType === 'running' && walkingBefore !== undefined) {
        nextLog.totalSteps = walkingBefore + estimateRunningSteps(nextLog, current.settings.runCadenceSpm)
      }
      return { ...current, logs: { ...current.logs, [date]: nextLog } }
    })
    announce(saved)
  }

  function changeRun(minutes: number, distance: number) {
    const safeMinutes = Math.max(0, minutes)
    const safeDistance = Math.max(0, distance)
    setRunMinutes(safeMinutes)
    setRunDistance(safeDistance)
    saveActivity('running', safeMinutes > 0 || safeDistance > 0 ? {
      id: activityId, date, type: 'running', durationMin: safeMinutes, distanceKm: safeDistance,
    } : null)
  }

  function changeBike(minutes: number, watts: number) {
    const safeMinutes = Math.max(0, minutes)
    const safeWatts = Math.max(0, Math.round(watts))
    setBikeMinutes(safeMinutes)
    setBikeWatts(safeWatts)
    saveActivity('cycling', safeMinutes > 0 || safeWatts > 0 ? {
      id: activityId, date, type: 'cycling', durationMin: safeMinutes,
      averageWatts: safeWatts > 0 ? safeWatts : undefined,
    } : null)
  }

  function changeExtra(minutes: number, seconds = stairSeconds, level = stairLevel) {
    if (type === 'steps' || type === 'running' || type === 'cycling') return
    const safeMinutes = Math.max(0, Math.floor(minutes))
    const safeSeconds = Math.min(59, Math.max(0, Math.round(seconds)))
    const safeLevel = Math.min(25, Math.max(1, Math.round(level)))
    setExtraMinutes(safeMinutes)
    setStairSeconds(safeSeconds)
    setStairLevel(safeLevel)
    const durationMin = type === 'stair-climber' ? safeMinutes + safeSeconds / 60 : safeMinutes
    saveActivity(type, durationMin > 0 ? type === 'stair-climber' ? {
      id: activityId, date, type, durationMin, level: safeLevel, stepRateSpm: matrixClimbMillStepRate(safeLevel),
    } : {
      id: activityId, date, type, durationMin, met: existingExtra?.met ?? activityDefaultMet(type),
    } : null)
  }

  const progress = Math.min(100, calculation.targetSteps > 0 ? walkingSteps / calculation.targetSteps * 100 : 0)
  const runPace = runDistance > 0 && runMinutes > 0 ? runMinutes / runDistance : 0
  const runKcal = Math.round(runDistance * (log.weightKg ?? state.profile.currentWeightKg) * state.settings.runKcalPerKgKm)
  const runSteps = Math.round(runMinutes * state.settings.runCadenceSpm)
  const transientCardio = makeTransientCardio(type, date, activityId, bikeMinutes, bikeWatts, extraMinutes, stairSeconds, stairLevel, existingExtra?.met)
  const cardioKcal = transientCardio ? Math.round(estimateOtherCardioKcal(transientCardio, log.weightKg ?? state.profile.currentWeightKg)) : 0

  return <div className="quick-activity-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="quick-activity-modal" role="dialog" aria-modal="true" aria-labelledby="quick-activity-title">
      <header className="quick-activity-header">
        <span className={`quick-activity-icon ${meta.tone}`}>{meta.icon}</span>
        <div><span>Saisie rapide · sauvegarde automatique</span><h2 id="quick-activity-title">{meta.title}</h2><p>{meta.subtitle}</p></div>
        <button type="button" aria-label="Fermer la saisie d’activité" onClick={onClose}><X /></button>
      </header>

      {type === 'steps' && <>
        <section className="step-goal-card" aria-label="Progression des pas">
          <div><span>Progression du jour</span><strong>{formatNumber(walkingSteps)} <small>sur {formatNumber(calculation.targetSteps)} pas</small></strong></div>
          <span className={walkingSteps >= calculation.targetSteps ? 'goal-reached' : ''}>{walkingSteps >= calculation.targetSteps ? `+${formatNumber(walkingSteps - calculation.targetSteps)} au-dessus` : `${formatNumber(calculation.targetSteps - walkingSteps)} restants`}</span>
          <div className="step-goal-track"><i style={{ width: `${progress}%` }} /></div>
        </section>
        <label className="quick-activity-field"><span>Pas hors course réalisés</span><span className="quick-activity-unit"><input autoFocus aria-label="Pas hors course réalisés" type="number" inputMode="numeric" min="0" step="100" value={walkingSteps || ''} placeholder="0" onChange={(event) => saveSteps(numberValue(event.target.value))} /><small>pas</small></span><em>Ne compte pas les pas effectués pendant tes courses.</em></label>
      </>}

      {type === 'running' && <>
        <div className="quick-activity-fields two-columns">
          <QuickField label="Durée de course" unit="min" value={runMinutes} step="1" autoFocus onChange={(value) => changeRun(value, runDistance)} />
          <QuickField label="Distance de course" unit="km" value={runDistance} step="0.1" onChange={(value) => changeRun(runMinutes, value)} />
        </div>
        <section className="quick-activity-results">
          <QuickResult label="Allure moyenne" value={runPace ? formatPace(runPace) : '—'} />
          <QuickResult label="Pas de course estimés" value={runSteps ? formatNumber(runSteps) : '—'} />
          <QuickResult label="Dépense estimée" value={`${formatNumber(runKcal)} kcal`} />
        </section>
      </>}

      {type === 'cycling' && <>
        <div className="quick-activity-fields two-columns">
          <QuickField label="Durée vélo" unit="min" value={bikeMinutes} step="1" autoFocus onChange={(value) => changeBike(value, bikeWatts)} />
          <QuickField label="Watts moyens" unit="W" value={bikeWatts} step="1" onChange={(value) => changeBike(bikeMinutes, value)} />
        </div>
        <section className="quick-activity-results two-results"><QuickResult label="Dépense estimée" value={`${formatNumber(cardioKcal)} kcal`} /><QuickResult label="Puissance moyenne" value={bikeWatts ? `${formatNumber(bikeWatts)} W` : '—'} /></section>
      </>}

      {!['steps', 'running', 'cycling'].includes(type) && <>
        <div className={`quick-activity-fields ${type === 'stair-climber' ? 'three-columns' : ''}`}>
          <QuickField label="Durée" unit="min" value={extraMinutes} step="1" autoFocus onChange={(value) => changeExtra(value)} />
          {type === 'stair-climber' && <QuickField label="Secondes" unit="s" value={stairSeconds} step="1" max={59} onChange={(value) => changeExtra(extraMinutes, value)} />}
          {type === 'stair-climber' && <QuickField label="Niveau Matrix" unit="/ 25" value={stairLevel} step="1" min={1} max={25} onChange={(value) => changeExtra(extraMinutes, stairSeconds, value)} />}
        </div>
        <section className="quick-activity-results two-results">
          {type === 'stair-climber' && <QuickResult label="Cadence calculée" value={`${formatNumber(matrixClimbMillStepRate(stairLevel))} marches/min`} />}
          <QuickResult label="Dépense estimée" value={`${formatNumber(cardioKcal)} kcal`} />
        </section>
      </>}

      <section className="quick-target-recap"><span><Gauge /> Nouvelle cible calorique</span><strong>{formatNumber(calculation.adjustedCalorieTarget)} <small>kcal</small></strong></section>
      <footer className={saveState === 'error' ? 'save-error' : ''}><Check /><span>{saveState === 'error' ? 'Impossible d’enregistrer cette modification' : 'Enregistré automatiquement'}</span><small>Tu peux fermer cette fenêtre, aucune validation supplémentaire n’est nécessaire.</small></footer>
    </section>
  </div>
}

function QuickField({ label, unit, value, onChange, step, min = 0, max, autoFocus = false }: { label: string; unit: string; value: number; onChange: (value: number) => void; step: string; min?: number; max?: number; autoFocus?: boolean }) {
  return <label className="quick-activity-field"><span>{label}</span><span className="quick-activity-unit"><input autoFocus={autoFocus} aria-label={label} type="number" inputMode="decimal" min={min} max={max} step={step} value={value || ''} placeholder="0" onChange={(event) => onChange(numberValue(event.target.value))} /><small>{unit}</small></span></label>
}

function QuickResult({ label, value }: { label: string; value: string }) {
  return <div><span>{label}</span><strong>{value}</strong></div>
}

function numberValue(value: string): number {
  return value === '' ? 0 : Number(value)
}

function formatPace(value: number): string {
  const minutes = Math.floor(value)
  const seconds = Math.round((value - minutes) * 60)
  return `${minutes}:${String(seconds).padStart(2, '0')} / km`
}

function makeTransientCardio(type: QuickActivityEditorType, date: string, id: string, bikeMinutes: number, bikeWatts: number, extraMinutes: number, stairSeconds: number, stairLevel: number, existingMet?: number): Activity | null {
  if (type === 'cycling') return { id, date, type, durationMin: bikeMinutes, averageWatts: bikeWatts > 0 ? bikeWatts : undefined }
  if (type === 'steps' || type === 'running') return null
  const durationMin = type === 'stair-climber' ? extraMinutes + stairSeconds / 60 : extraMinutes
  if (type === 'stair-climber') return { id, date, type, durationMin, level: stairLevel, stepRateSpm: matrixClimbMillStepRate(stairLevel) }
  return { id, date, type, durationMin, met: existingMet ?? activityDefaultMet(type) }
}
