import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Bike, Cable, ChartNoAxesColumnIncreasing, CircleEllipsis, Dumbbell, Footprints, Info, Plus, Save, SportShoe } from 'lucide-react'
import { activityDefaultMet, calculateDay, estimateOtherCardioKcal, estimateRunningSteps, matrixClimbMillStepRate } from '../domain/calculations'
import { formatLongDate } from '../domain/dates'
import type { Activity, ActivityType, DailyLog, StrengthActivity } from '../domain/types'
import { useApp } from '../state/AppContext'
import { formatDecimal, formatNumber } from '../domain/format'
import { useJournalDate } from '../hooks/useJournalDate'
import { journalLogForDate } from '../domain/journal'
import { ExplainedLabel } from '../components/HelpTooltip'
import { dayLabels, elapsed, templateForDate, typeOfTemplate } from '../domain/training'

const makeId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
const extraActivityTypes: ActivityType[] = ['jump-rope', 'rowing', 'elliptical', 'stair-climber', 'other']

export function ActivitiesPage() {
  const { state, updateLog } = useApp()
  const { selectedDate } = useJournalDate()
  const [searchParams] = useSearchParams()
  const requestedFocus = searchParams.get('focus')
  const requestedType = searchParams.get('type')
  const requestedExtraType = extraActivityTypes.includes(requestedType as ActivityType) ? requestedType as ActivityType : 'jump-rope'
  const log = useMemo<DailyLog>(() => journalLogForDate(state, selectedDate), [selectedDate, state])
  const savedCalc = calculateDay(log, state.profile, state.settings)
  const plannedTemplate = templateForDate(state, selectedDate)
  const plannedDayType = state.plannedSessions?.[selectedDate]?.dayType ?? typeOfTemplate(plannedTemplate)
  const journalSession = log.training
  const initialTemplateId = journalSession?.templateId
    ?? log.strengthActivity?.templateId
    ?? (plannedDayType !== 'rest' ? plannedTemplate?.id : undefined)
    ?? state.templates.find((template) => !template.archived && template.dayType === 'shoulders-arms')?.id
    ?? state.templates.find((template) => !template.archived)?.id
    ?? ''
  const journalExerciseCount = journalSession?.exercises.filter((exercise) => !exercise.replacedById).length
  const journalWorkingSetCount = journalSession?.exercises.reduce((sum, exercise) => sum + exercise.sets.filter((set) => set.completed && set.kind !== 'warmup').length, 0)
  const journalDurationMin = journalSession ? Math.round(elapsed(journalSession) / 60_000) : undefined
  const existingRun = log.activities.find((activity) => activity.type === 'running')
  const existingBike = log.activities.find((activity) => activity.type === 'cycling')
  const [strengthPerformed, setStrengthPerformed] = useState(log.strengthActivity?.performed ?? Boolean(journalSession || plannedDayType !== 'rest'))
  const [strengthTemplateId, setStrengthTemplateId] = useState(initialTemplateId)
  const [strengthDuration, setStrengthDuration] = useState<number | null>(journalDurationMin ?? log.strengthActivity?.durationMin ?? null)
  const [strengthExercises, setStrengthExercises] = useState<number | null>(journalExerciseCount ?? log.strengthActivity?.exerciseCount ?? null)
  const [strengthSets, setStrengthSets] = useState<number | null>(journalWorkingSetCount ?? log.strengthActivity?.workingSetCount ?? null)
  const [walkingSteps, setWalkingSteps] = useState<number | null>(log.totalSteps === undefined ? null : savedCalc.walkingSteps)
  const [runMinutes, setRunMinutes] = useState(existingRun?.durationMin ?? 0)
  const [runDistance, setRunDistance] = useState(existingRun?.distanceKm ?? 0)
  const [bikeMinutes, setBikeMinutes] = useState(existingBike?.durationMin ?? 0)
  const [bikeWatts, setBikeWatts] = useState(existingBike?.averageWatts ?? 0)
  const [extraOpen, setExtraOpen] = useState(requestedFocus === 'extra')
  const [extraType, setExtraType] = useState<ActivityType>(requestedExtraType)
  const [extraMinutes, setExtraMinutes] = useState(0)
  const [stairSeconds, setStairSeconds] = useState(0)
  const [stairLevel, setStairLevel] = useState(10)
  const [saved, setSaved] = useState(false)
  const pace = runDistance > 0 ? runMinutes / runDistance : 0
  const legacyBikeMet = existingBike?.averageWatts === undefined ? existingBike?.met : undefined
  const extraDurationMin = extraType === 'stair-climber' ? extraMinutes + stairSeconds / 60 : extraMinutes
  const stairStepRate = matrixClimbMillStepRate(stairLevel)
  const weightKg = log.weightKg ?? state.profile.currentWeightKg
  const strengthTemplate = state.templates.find((template) => template.id === strengthTemplateId)
  const strengthActivity = useMemo<StrengthActivity>(() => journalSession
    ? {
        performed: true,
        plannedDayType,
        dayType: typeOfTemplate(strengthTemplate) === 'rest' ? log.strengthActivity?.dayType ?? plannedDayType : typeOfTemplate(strengthTemplate),
        templateId: journalSession.templateId,
        templateName: journalSession.name,
        durationMin: journalDurationMin,
        exerciseCount: journalExerciseCount,
        workingSetCount: journalWorkingSetCount,
        source: 'journal',
      }
    : {
        performed: strengthPerformed,
        plannedDayType,
        dayType: strengthPerformed ? typeOfTemplate(strengthTemplate) : 'rest',
        templateId: strengthPerformed && strengthTemplate ? strengthTemplate.id : undefined,
        templateName: strengthPerformed && strengthTemplate ? strengthTemplate.name : undefined,
        durationMin: strengthPerformed ? optionalPositive(strengthDuration) : undefined,
        exerciseCount: strengthPerformed ? optionalPositive(strengthExercises) : undefined,
        workingSetCount: strengthPerformed ? optionalPositive(strengthSets) : undefined,
        source: 'manual',
      }, [journalDurationMin, journalExerciseCount, journalSession, journalWorkingSetCount, log.strengthActivity?.dayType, plannedDayType, strengthDuration, strengthExercises, strengthPerformed, strengthSets, strengthTemplate])

  const previewLog = useMemo<DailyLog>(() => {
    const replaced = log.activities.filter((activity) => !['running', 'cycling'].includes(activity.type))
    const activities: Activity[] = [...replaced]
    if (runMinutes > 0 && runDistance > 0) activities.push({ id: 'preview-run', date: selectedDate, type: 'running', durationMin: runMinutes, distanceKm: runDistance })
    if (bikeMinutes > 0) activities.push({
      id: 'preview-bike', date: selectedDate, type: 'cycling', durationMin: bikeMinutes,
      averageWatts: bikeWatts > 0 ? bikeWatts : undefined,
      met: bikeWatts <= 0 ? legacyBikeMet : undefined,
    })
    if (extraDurationMin > 0) activities.push(extraType === 'stair-climber'
      ? { id: 'preview-extra', date: selectedDate, type: extraType, durationMin: extraDurationMin, level: stairLevel, stepRateSpm: stairStepRate }
      : { id: 'preview-extra', date: selectedDate, type: extraType, durationMin: extraDurationMin, met: activityDefaultMet(extraType) })
    const shell = { ...log, activities, strengthActivity, totalSteps: 0 }
    const runningSteps = estimateRunningSteps(shell, state.settings.runCadenceSpm)
    return { ...shell, totalSteps: walkingSteps === null ? undefined : walkingSteps + runningSteps }
  }, [bikeMinutes, bikeWatts, extraDurationMin, extraType, legacyBikeMet, log, runDistance, runMinutes, selectedDate, stairLevel, stairStepRate, state.settings.runCadenceSpm, strengthActivity, walkingSteps])
  const preview = calculateDay(previewLog, state.profile, state.settings)
  const previewBike = previewLog.activities.find((activity) => activity.id === 'preview-bike')
  const previewExtra = previewLog.activities.find((activity) => activity.id === 'preview-extra')
  const bikeKcal = previewBike ? Math.round(estimateOtherCardioKcal(previewBike, weightKg)) : 0
  const extraKcal = previewExtra ? Math.round(estimateOtherCardioKcal(previewExtra, weightKg)) : 0

  useEffect(() => {
    const focusIds: Record<string, string> = {
      strength: 'activity-strength',
      steps: 'activity-steps',
      running: 'activity-running',
      cycling: 'activity-cycling',
      extra: 'activity-extra',
    }
    const targetId = requestedFocus ? focusIds[requestedFocus] : undefined
    if (!targetId) return
    const frame = window.requestAnimationFrame(() => {
      const target = document.getElementById(targetId)
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      target?.querySelector<HTMLElement>('input:not(:disabled), select:not(:disabled), button:not(:disabled)')?.focus({ preventScroll: true })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [extraOpen, requestedFocus])

  function saveActivities(event: FormEvent) {
    event.preventDefault()
    const activities = previewLog.activities.map((activity) => ({ ...activity, id: activity.id.startsWith('preview-') ? makeId(activity.type) : activity.id }))
    updateLog(selectedDate, { totalSteps: previewLog.totalSteps, activities, strengthActivity })
    setSaved(true)
    window.setTimeout(() => setSaved(false), 2200)
  }

  return (
    <div className="reference-page activities-reference">
      <header className="reference-topbar page-title-topbar">
        <div className="title-stack"><h1>Ajouter les activités du jour</h1><p>{formatLongDate(selectedDate)} <b>•</b> Les pas de course ne sont jamais comptés deux fois</p></div>
        <div className="goal-inline"><span className="goal-small-icon">◎</span> Objectif : −{formatDecimal(state.profile.weeklyLossTargetKg)} kg / semaine</div>
      </header>

      <form className="reference-body activities-layout-reference" onSubmit={saveActivities}>
        <div className="activity-form-column">
          {saved && <div className="save-toast">Activités enregistrées et cible recalculée.</div>}
          <section id="activity-strength" className={`activity-entry-card reference-card strength-entry-card ${requestedFocus === 'strength' ? 'activity-focused' : ''}`}>
            <span className="entry-icon navy"><Dumbbell /></span>
            <div className="entry-content">
              <div className="strength-entry-heading">
                <h2><ExplainedLabel help="Indique si une séance de musculation a réellement été faite, même lorsque le planning prévoyait du repos. La cible est alors adaptée au type de séance réalisé." placement="left">Séance de musculation</ExplainedLabel></h2>
                <label className="strength-toggle">
                  <input
                    aria-label="Séance de musculation réalisée"
                    type="checkbox"
                    checked={journalSession ? true : strengthPerformed}
                    disabled={Boolean(journalSession)}
                    onChange={(event) => setStrengthPerformed(event.target.checked)}
                  />
                  <span aria-hidden="true" />
                  <b>{journalSession || strengthPerformed ? 'Réalisée' : 'Non réalisée'}</b>
                </label>
              </div>
              <div className="strength-planning-status">
                <span>Prévu : <strong>{plannedTemplate?.shortName ?? dayLabels[plannedDayType]}</strong></span>
                <span>Réel : <strong>{journalSession || strengthPerformed ? strengthTemplate?.shortName ?? journalSession?.name ?? 'Séance à choisir' : 'Repos'}</strong></span>
              </div>
              {(journalSession || strengthPerformed) && <div className="strength-fields">
                <label><ExplainedLabel help="Choisis le modèle qui correspond à la séance réellement effectuée. Le planning d’origine n’est pas modifié." placement="left">Séance réalisée</ExplainedLabel><select aria-label="Séance réalisée" required value={strengthTemplateId} disabled={Boolean(journalSession)} onChange={(event) => setStrengthTemplateId(event.target.value)}>{state.templates.filter((template) => !template.archived || template.id === strengthTemplateId).map((template) => <option key={template.id} value={template.id}>{template.shortName}</option>)}</select></label>
                <label><ExplainedLabel help="Durée réelle de la séance, conservée pour ton historique. Elle n’est pas convertie directement en calories.">Durée</ExplainedLabel><span className="unit-input"><input aria-label="Durée de la séance" type="number" inputMode="numeric" min="0" max="360" placeholder="—" value={strengthDuration ?? ''} disabled={Boolean(journalSession)} onChange={(event) => setStrengthDuration(nullableNumber(event.target.value))} /><small>min</small></span></label>
                <label><ExplainedLabel help="Nombre d’exercices réellement effectués pendant cette séance.">Exercices</ExplainedLabel><span className="unit-input"><input aria-label="Nombre d’exercices" type="number" inputMode="numeric" min="0" max="50" placeholder="—" value={strengthExercises ?? ''} disabled={Boolean(journalSession)} onChange={(event) => setStrengthExercises(nullableNumber(event.target.value))} /><small>ex.</small></span></label>
                <label><ExplainedLabel help="Nombre total de séries de travail réalisées, hors échauffement.">Séries de travail</ExplainedLabel><span className="unit-input"><input aria-label="Nombre de séries de travail" type="number" inputMode="numeric" min="0" max="200" placeholder="—" value={strengthSets ?? ''} disabled={Boolean(journalSession)} onChange={(event) => setStrengthSets(nullableNumber(event.target.value))} /><small>séries</small></span></label>
              </div>}
              {journalSession && <p className="strength-source-note"><Info /> Cette séance est déjà reliée au journal de musculation. Ses données sont reprises automatiquement et ne sont comptées qu’une fois.</p>}
              <p className="strength-calculation-note">Le type de journée calorique est ajusté selon la séance réelle. Durée, exercices et séries restent des données de suivi : aucun tonnage n’est transformé arbitrairement en calories.</p>
            </div>
          </section>
          <section id="activity-steps" className={`activity-entry-card reference-card compact-entry ${requestedFocus === 'steps' ? 'activity-focused' : ''}`}>
            <span className="entry-icon teal"><SportShoe /></span>
            <div className="entry-content"><h2><ExplainedLabel help="Renseigne uniquement les pas de marche et de déplacement. Les pas produits pendant une course sont estimés séparément." placement="left">Marche et déplacements</ExplainedLabel></h2><label><ExplainedLabel help="Ces pas sont valorisés avec le coefficient de marche intégré et comparés à l’objectif de pas du jour." placement="left">Pas hors course</ExplainedLabel><span className="unit-input"><input aria-label="Pas hors course" placeholder="À renseigner" type="number" inputMode="numeric" min="0" step="100" value={walkingSteps ?? ''} onChange={(event) => setWalkingSteps(event.target.value === '' ? null : Number(event.target.value))} /><small>pas</small></span></label></div>
          </section>

          <section id="activity-running" className={`activity-entry-card reference-card ${requestedFocus === 'running' ? 'activity-focused' : ''}`}>
            <span className="entry-icon blue"><Footprints /></span>
            <div className="entry-content"><h2><ExplainedLabel help="La course est calculée à partir de la distance et de ton poids. Ses pas estimés sont retirés du total pour ne pas compter deux fois la même activité." placement="left">Course à pied</ExplainedLabel></h2><div className="run-fields">
              <label><ExplainedLabel help="Temps total réellement couru pour cette date." placement="left">Durée</ExplainedLabel><span className="unit-input"><input aria-label="Durée de course" placeholder="0" type="number" inputMode="numeric" min="0" value={runMinutes || ''} onChange={(event) => setRunMinutes(Number(event.target.value))} /><small>min</small></span></label>
              <label><ExplainedLabel help="Calcul automatique : durée divisée par distance, exprimée en minutes par kilomètre.">Allure moyenne</ExplainedLabel><span className="readonly-field">{pace ? formatPace(pace) : '—'}</span></label>
              <label><ExplainedLabel help="Distance totale parcourue. C’est la donnée principale utilisée pour estimer la dépense de course.">Distance</ExplainedLabel><span className="unit-input"><input aria-label="Distance de course" placeholder="0" type="number" inputMode="decimal" min="0" step="0.1" value={runDistance || ''} onChange={(event) => setRunDistance(Number(event.target.value))} /><small>km</small></span></label>
              <label><ExplainedLabel help="Estimation technique : distance × poids × coefficient de course. Ce n’est pas une mesure médicale exacte." placement="right">Dépense estimée</ExplainedLabel><span className="readonly-field">{formatNumber(preview.runningKcal)} <small>kcal</small></span></label>
            </div></div>
          </section>

          <section id="activity-cycling" className={`activity-entry-card reference-card bike-entry-card ${requestedFocus === 'cycling' ? 'activity-focused' : ''}`}>
            <span className="entry-icon teal"><Bike /></span>
            <div className="entry-content"><h2><ExplainedLabel help="Le vélo est estimé automatiquement à partir de la durée, des watts moyens réellement affichés par le vélo et de ton poids du jour." placement="left">Vélo</ExplainedLabel></h2><div className="bike-fields power-bike-fields">
              <label><ExplainedLabel help="Temps total passé à pédaler pour cette activité.">Durée</ExplainedLabel><span className="unit-input"><input aria-label="Durée vélo" placeholder="0" type="number" inputMode="numeric" min="0" value={bikeMinutes || ''} onChange={(event) => setBikeMinutes(Number(event.target.value))} /><small>min</small></span></label>
              <label><ExplainedLabel help="Puissance moyenne en watts indiquée par le vélo à la fin de la séance. Elle remplace les anciens boutons d’intensité." placement="left">Watts moyens</ExplainedLabel><span className="unit-input"><input aria-label="Watts moyens vélo" placeholder="0" type="number" inputMode="numeric" min="1" max="3000" step="1" required={bikeMinutes > 0 && legacyBikeMet === undefined} value={bikeWatts || ''} onChange={(event) => setBikeWatts(Number(event.target.value))} /><small>W</small></span></label>
              <label><ExplainedLabel help="Estimation nette au-dessus du repos avec l’équation cyclo-ergomètre ACSM : les watts, la durée et ton poids du jour sont pris en compte." placement="right">Dépense estimée</ExplainedLabel><span className="readonly-field">{formatNumber(bikeKcal)} <small>kcal</small></span></label>
            </div></div>
          </section>

          <button id="activity-extra-trigger" className="outline-wide-action" type="button" onClick={() => setExtraOpen((value) => !value)}><Plus /> Ajouter un autre cardio</button>
          <div className="secondary-activity-actions three-actions"><button type="button" onClick={() => { setExtraType('jump-rope'); setExtraOpen(true) }}><Cable /> Corde à sauter</button><button type="button" onClick={() => { setExtraType('stair-climber'); setExtraOpen(true) }}><ChartNoAxesColumnIncreasing /> Escalier</button><button type="button" onClick={() => { setExtraType('other'); setExtraOpen(true) }}><CircleEllipsis /> Autre activité</button></div>
          {extraOpen && <section id="activity-extra" className={`extra-cardio reference-card ${extraType === 'stair-climber' ? 'stair-cardio' : 'generic-extra-cardio'} ${requestedFocus === 'extra' ? 'activity-focused' : ''}`}>
            <label className="extra-type-picker"><ExplainedLabel help="Choisis le cardio que tu as réellement effectué. L’escalier utilise le profil de niveaux Matrix ClimbMill." placement="left">Type de cardio</ExplainedLabel><select aria-label="Type de cardio supplémentaire" value={extraType} onChange={(event) => setExtraType(event.target.value as ActivityType)}><option value="jump-rope">Corde à sauter</option><option value="rowing">Rameur</option><option value="elliptical">Elliptique</option><option value="stair-climber">Escalier / Stairmaster (Matrix)</option><option value="other">Autre</option></select></label>
            {extraType === 'stair-climber' ? <>
              <label><ExplainedLabel help="Partie entière de la durée affichée par la machine.">Minutes</ExplainedLabel><span className="unit-input"><input aria-label="Minutes escalier" type="number" inputMode="numeric" min="0" max="300" step="1" value={extraMinutes || ''} onChange={(event) => setExtraMinutes(Number(event.target.value))} /><small>min</small></span></label>
              <label><ExplainedLabel help="Secondes restantes, entre 0 et 59. Exemple : 6 min 30 s.">Secondes</ExplainedLabel><span className="unit-input"><input aria-label="Secondes escalier" type="number" inputMode="numeric" min="0" max="59" step="1" value={stairSeconds || ''} onChange={(event) => setStairSeconds(Number(event.target.value))} /><small>s</small></span></label>
              <label><ExplainedLabel help="Niveau indiqué par un ClimbMill Matrix à 25 niveaux. Le niveau 10 correspond à 78 marches par minute." placement="left">Niveau Matrix</ExplainedLabel><span className="unit-input"><input aria-label="Niveau escalier Matrix" type="number" inputMode="numeric" min="1" max="25" step="1" required value={stairLevel} onChange={(event) => setStairLevel(Number(event.target.value))} /><small>/ 25</small></span></label>
              <label><ExplainedLabel help="Cadence déduite du tableau officiel Matrix. Elle est mémorisée avec l’activité afin de garder un calcul historique stable.">Cadence calculée</ExplainedLabel><span className="readonly-field">{formatNumber(stairStepRate)} <small>marches/min</small></span></label>
              <label><ExplainedLabel help="Estimation fondée sur ton poids, la cadence Matrix, une marche de 20,3 cm et un rendement mécanique de 25 %. Se tenir fortement aux poignées peut surestimer la dépense." placement="right">Dépense estimée</ExplainedLabel><span className="readonly-field">{formatNumber(extraKcal)} <small>kcal</small></span></label>
              <div className="reference-info stair-method-note"><Info /> Profil Matrix / Basic-Fit : le niveau 10 vaut 78 marches/min. Les marches de la machine ne sont pas ajoutées à tes pas de marche quotidiens.</div>
            </> : <>
              <label><ExplainedLabel help="Temps total consacré à ce cardio.">Durée</ExplainedLabel><span className="unit-input"><input aria-label="Durée cardio supplémentaire" type="number" inputMode="decimal" min="0" max="600" step="0.5" value={extraMinutes || ''} onChange={(event) => setExtraMinutes(Number(event.target.value))} /><small>min</small></span></label>
              <label><ExplainedLabel help="Estimation nette au-dessus du repos à partir de la durée, du poids et de la valeur MET associée à l’activité." placement="right">Dépense estimée</ExplainedLabel><span className="readonly-field">{formatNumber(extraKcal)} <small>kcal</small></span></label>
            </>}
          </section>}
          <div className="reference-info"><Info /> Les kilomètres de course remplacent leurs pas estimés afin d’éviter le double comptage. Les marches du Stairmaster restent, elles, un cardio hors pas.</div>
        </div>

        <aside className="activity-live-summary reference-card">
          <SummaryLine label="Ajustement séance" value={preview.strengthTrainingBaseAdjustmentKcal} signed help={`Écart entre le profil ${dayLabels[plannedDayType]} prévu et le profil ${dayLabels[preview.effectiveDayType ?? plannedDayType]} réellement déclaré. L’objectif de pas passe de ${formatNumber(preview.scheduledTargetSteps)} à ${formatNumber(preview.targetSteps)}.`} placement="left" />
          <SummaryLine label="Dépense activité prévue" value={preview.plannedActivityKcal} help="Dépense déjà intégrée à la cible du jour à partir du nombre de pas planifié." placement="left" />
          <SummaryLine label="Dépense activité réelle" value={preview.actualActivityKcal} help="Somme estimée de la marche, de la course, du vélo et des autres cardios renseignés." placement="left" />
          <SummaryLine label="Excédent d’activité" value={preview.activityDeltaKcal} signed help="Différence entre activité réelle et activité prévue. Une valeur positive signifie que tu as davantage dépensé que prévu." placement="left" />
          <SummaryLine label={`Restitué à ${Math.round(state.settings.reintegrationRate * 100)} %`} value={preview.appliedAdjustmentKcal} signed blue help="Part de cet écart réellement ajoutée ou retirée de la cible calorique après plafond et arrondi." placement="left" />
          <SummaryLine label="Nouvelle cible" value={preview.adjustedCalorieTarget} help="Apport calorique final recommandé pour conserver le déficit planifié après les activités saisies." placement="left" />
          <button className="reference-action blue-action" type="submit"><Save /><span>Enregistrer les activités</span></button>
        </aside>
      </form>
    </div>
  )
}

function SummaryLine({ label, value, signed = false, blue = false, help, placement = 'center' }: { label: string; value: number; signed?: boolean; blue?: boolean; help: string; placement?: 'left' | 'center' | 'right' }) {
  return <div className="summary-line"><ExplainedLabel help={help} placement={placement}>{label}</ExplainedLabel><strong className={blue ? 'blue-text' : ''}>{signed && value > 0 ? '+' : ''}{formatNumber(value)} <small>kcal</small></strong></div>
}

function formatPace(value: number): string {
  const minutes = Math.floor(value)
  const seconds = Math.round((value - minutes) * 60)
  return `${minutes}:${String(seconds).padStart(2, '0')} / km`
}

function nullableNumber(value: string): number | null {
  return value === '' ? null : Number(value)
}

function optionalPositive(value: number | null): number | undefined {
  return value !== null && value > 0 ? value : undefined
}
