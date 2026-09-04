import { useMemo, useState, type FormEvent } from 'react'
import { Bike, Cable, CircleEllipsis, Dumbbell, Footprints, Info, Plus, Save, SportShoe } from 'lucide-react'
import { calculateDay, estimateRunningSteps } from '../domain/calculations'
import { formatLongDate } from '../domain/dates'
import type { Activity, ActivityType, DailyLog, StrengthActivity } from '../domain/types'
import { useApp } from '../state/AppContext'
import { formatDecimal, formatNumber } from '../domain/format'
import { useJournalDate } from '../hooks/useJournalDate'
import { journalLogForDate } from '../domain/journal'
import { ExplainedLabel } from '../components/HelpTooltip'
import { dayLabels, elapsed, templateForDate, typeOfTemplate } from '../domain/training'

const makeId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

export function ActivitiesPage() {
  const { state, updateLog } = useApp()
  const { selectedDate } = useJournalDate()
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
  const [bikeIntensity, setBikeIntensity] = useState<'easy' | 'z2' | 'hard'>('z2')
  const [extraOpen, setExtraOpen] = useState(false)
  const [extraType, setExtraType] = useState<ActivityType>('jump-rope')
  const [extraMinutes, setExtraMinutes] = useState(0)
  const [saved, setSaved] = useState(false)
  const pace = runDistance > 0 ? runMinutes / runDistance : 0
  const bikeMet = bikeIntensity === 'easy' ? 4 : bikeIntensity === 'hard' ? 9 : 6.8
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
    if (bikeMinutes > 0) activities.push({ id: 'preview-bike', date: selectedDate, type: 'cycling', durationMin: bikeMinutes, met: bikeMet })
    if (extraMinutes > 0) activities.push({ id: 'preview-extra', date: selectedDate, type: extraType, durationMin: extraMinutes, met: extraType === 'jump-rope' ? 11.8 : 5 })
    const shell = { ...log, activities, strengthActivity, totalSteps: 0 }
    const runningSteps = estimateRunningSteps(shell, state.settings.runCadenceSpm)
    return { ...shell, totalSteps: walkingSteps === null ? undefined : walkingSteps + runningSteps }
  }, [bikeMet, bikeMinutes, extraMinutes, extraType, log, runDistance, runMinutes, selectedDate, state.settings.runCadenceSpm, strengthActivity, walkingSteps])
  const preview = calculateDay(previewLog, state.profile, state.settings)

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
          <section className="activity-entry-card reference-card strength-entry-card">
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
          <section className="activity-entry-card reference-card compact-entry">
            <span className="entry-icon teal"><SportShoe /></span>
            <div className="entry-content"><h2><ExplainedLabel help="Renseigne uniquement les pas de marche et de déplacement. Les pas produits pendant une course sont estimés séparément." placement="left">Marche et déplacements</ExplainedLabel></h2><label><ExplainedLabel help="Ces pas sont valorisés avec le coefficient de marche intégré et comparés à l’objectif de pas du jour." placement="left">Pas hors course</ExplainedLabel><span className="unit-input"><input aria-label="Pas hors course" placeholder="À renseigner" type="number" inputMode="numeric" min="0" step="100" value={walkingSteps ?? ''} onChange={(event) => setWalkingSteps(event.target.value === '' ? null : Number(event.target.value))} /><small>pas</small></span></label></div>
          </section>

          <section className="activity-entry-card reference-card">
            <span className="entry-icon blue"><Footprints /></span>
            <div className="entry-content"><h2><ExplainedLabel help="La course est calculée à partir de la distance et de ton poids. Ses pas estimés sont retirés du total pour ne pas compter deux fois la même activité." placement="left">Course à pied</ExplainedLabel></h2><div className="run-fields">
              <label><ExplainedLabel help="Temps total réellement couru pour cette date." placement="left">Durée</ExplainedLabel><span className="unit-input"><input aria-label="Durée de course" placeholder="0" type="number" inputMode="numeric" min="0" value={runMinutes || ''} onChange={(event) => setRunMinutes(Number(event.target.value))} /><small>min</small></span></label>
              <label><ExplainedLabel help="Calcul automatique : durée divisée par distance, exprimée en minutes par kilomètre.">Allure moyenne</ExplainedLabel><span className="readonly-field">{pace ? formatPace(pace) : '—'}</span></label>
              <label><ExplainedLabel help="Distance totale parcourue. C’est la donnée principale utilisée pour estimer la dépense de course.">Distance</ExplainedLabel><span className="unit-input"><input aria-label="Distance de course" placeholder="0" type="number" inputMode="decimal" min="0" step="0.1" value={runDistance || ''} onChange={(event) => setRunDistance(Number(event.target.value))} /><small>km</small></span></label>
              <label><ExplainedLabel help="Estimation technique : distance × poids × coefficient de course. Ce n’est pas une mesure médicale exacte." placement="right">Dépense estimée</ExplainedLabel><span className="readonly-field">{formatNumber(preview.runningKcal)} <small>kcal</small></span></label>
            </div></div>
          </section>

          <section className="activity-entry-card reference-card">
            <span className="entry-icon teal"><Bike /></span>
            <div className="entry-content"><h2><ExplainedLabel help="Le vélo est estimé avec la durée, ton poids et un niveau d’intensité exprimé par une valeur MET." placement="left">Vélo</ExplainedLabel></h2><div className="bike-fields">
              <label><ExplainedLabel help="Facile correspond à une sortie légère, Z2 à un effort continu modéré, et Soutenu à une intensité plus élevée." placement="left">Intensité</ExplainedLabel><span className="segmented-control"><button type="button" className={bikeIntensity === 'easy' ? 'active' : ''} onClick={() => setBikeIntensity('easy')}>Facile</button><button type="button" className={bikeIntensity === 'z2' ? 'active' : ''} onClick={() => setBikeIntensity('z2')}>Z2</button><button type="button" className={bikeIntensity === 'hard' ? 'active' : ''} onClick={() => setBikeIntensity('hard')}>Soutenu</button></span></label>
              <label><ExplainedLabel help="Temps total passé à pédaler pour cette activité.">Durée</ExplainedLabel><span className="unit-input"><input aria-label="Durée vélo" placeholder="0" type="number" inputMode="numeric" min="0" value={bikeMinutes || ''} onChange={(event) => setBikeMinutes(Number(event.target.value))} /><small>min</small></span></label>
              <label><ExplainedLabel help="Dépense estimée à partir de l’intensité MET, de ton poids et de la durée." placement="right">Dépense estimée</ExplainedLabel><span className="readonly-field">{formatNumber(preview.otherCardioKcal)} <small>kcal</small></span></label>
            </div></div>
          </section>

          <button className="outline-wide-action" type="button" onClick={() => setExtraOpen((value) => !value)}><Plus /> Ajouter un autre cardio</button>
          <div className="secondary-activity-actions"><button type="button" onClick={() => { setExtraType('jump-rope'); setExtraOpen(true) }}><Cable /> Corde à sauter</button><button type="button" onClick={() => { setExtraType('other'); setExtraOpen(true) }}><CircleEllipsis /> Autre activité</button></div>
          {extraOpen && <section className="extra-cardio reference-card"><select aria-label="Type de cardio supplémentaire" value={extraType} onChange={(event) => setExtraType(event.target.value as ActivityType)}><option value="jump-rope">Corde à sauter</option><option value="rowing">Rameur</option><option value="elliptical">Elliptique</option><option value="other">Autre</option></select><span className="unit-input"><input aria-label="Durée cardio supplémentaire" type="number" inputMode="numeric" min="0" value={extraMinutes} onChange={(event) => setExtraMinutes(Number(event.target.value))} /><small>min</small></span></section>}
          <div className="reference-info"><Info /> Les kilomètres de course remplacent leurs pas estimés afin d’éviter le double comptage.</div>
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
