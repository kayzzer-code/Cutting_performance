import { Link } from 'react-router-dom'
import { BicepsFlexed, Bike, Crosshair, Footprints, Plus, SportShoe, Utensils } from 'lucide-react'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { calculateDay, calculateWeeklyMargin, rollingAverage } from '../domain/calculations'
import { formatDayName, weekDates } from '../domain/dates'
import { useApp } from '../state/AppContext'
import { formatDecimal, formatNumber } from '../domain/format'
import { useJournalDate } from '../hooks/useJournalDate'
import { journalLogForDate } from '../domain/journal'
import { ExplainedLabel } from '../components/HelpTooltip'
import { dayLabels, templateForDate } from '../domain/training'

export function TodayPage() {
  const { state } = useApp()
  const { selectedDate, dateHref } = useJournalDate()
  const log = journalLogForDate(state, selectedDate)
  const calc = calculateDay(log, state.profile, state.settings)
  const weekLogs = weekDates(selectedDate).map((date) => journalLogForDate(state, date))
  const weeklyMargin = calculateWeeklyMargin(weekLogs, state.profile, state.settings)
  const consumed = log.caloriesConsumed ?? 0
  const remaining = calc.adjustedCalorieTarget - consumed
  const template = templateForDate(state, selectedDate)
  const actualStrengthTemplate = state.templates.find((candidate) => candidate.id === log.strengthActivity?.templateId)
  const actualSessionLabel = log.strengthActivity
    ? log.strengthActivity.performed
      ? actualStrengthTemplate?.shortName ?? log.strengthActivity.templateName ?? dayLabels[log.strengthActivity.dayType]
      : 'Repos'
    : template?.shortName ?? 'Repos'
  const sessionWasChanged = Boolean(log.strengthActivity && (
    log.strengthActivity.performed !== (log.strengthActivity.plannedDayType !== 'rest')
    || log.strengthActivity.dayType !== log.strengthActivity.plannedDayType
    || Boolean(log.strengthActivity.templateId && log.strengthActivity.templateId !== template?.id)
  ))
  const runs = log.activities.filter((activity) => activity.type === 'running')
  const runMinutes = runs.reduce((sum, activity) => sum + activity.durationMin, 0)
  const runDistance = runs.reduce((sum, activity) => sum + (activity.distanceKm ?? 0), 0)
  const bikes = log.activities.filter((activity) => activity.type === 'cycling')
  const bikeMinutes = bikes.reduce((sum, activity) => sum + activity.durationMin, 0)
  const nutritionPercent = Math.min(100, calc.adjustedCalorieTarget ? consumed / calc.adjustedCalorieTarget * 100 : 0)
  const marginPosition = Math.min(100, Math.max(0, (weeklyMargin + 1500) / 3000 * 100))
  const weights = rollingAverage(Object.values(state.logs)
    .filter((day) => day.weightKg !== undefined)
    .map((day) => ({ date: day.date, weight: day.weightKg as number }))
    .sort((a, b) => a.date.localeCompare(b.date)))
    .slice(-7)
    .map((point) => ({ ...point, label: formatDayName(point.date).slice(0, 3), display: point.average ?? point.weight }))
  const rolling = weights.at(-1)?.display ?? state.profile.currentWeightKg

  return (
    <div className="reference-page today-reference">
      <div className="reference-body today-body">
        <section className="today-hero-grid">
          <Link to={dateHref('/parametres')} className="target-hero-card reference-card">
            <span className="hero-icon-circle teal"><Crosshair /></span>
            <div><ExplainedLabel help="Apport calorique recommandé pour cette date après prise en compte du type de journée, de l’activité prévue et de l’activité réellement saisie." placement="left">Cible du jour recalculée</ExplainedLabel><strong>{formatNumber(calc.adjustedCalorieTarget)} <small>kcal</small></strong></div>
          </Link>

          <div className="daily-summary-card reference-card">
            <Link to={dateHref(sessionWasChanged ? '/activites' : '/musculation')} className="daily-summary-item"><span className="hero-icon-circle navy"><BicepsFlexed /></span><ExplainedLabel help={sessionWasChanged ? `Le planning prévoyait ${template?.shortName ?? dayLabels[log.strengthActivity!.plannedDayType]}, mais ${actualSessionLabel} a été déclaré comme réalité. Clique pour modifier cette déclaration.` : template ? `Tu dois réaliser ta séance ${template.shortName} de musculation pour cette journée. Clique sur le bloc pour ouvrir le journal de séance.` : 'Aucune séance de musculation n’est planifiée pour cette journée.'} placement="left">Séance :</ExplainedLabel><strong>{actualSessionLabel}</strong></Link>
            <Link to={dateHref('/activites')} className="daily-summary-item"><span className="hero-icon-circle teal"><SportShoe /></span><ExplainedLabel help="Nombre de pas de marche et de déplacement, sans les pas estimés pendant la course afin d’éviter le double comptage.">Pas hors course :</ExplainedLabel><strong>{log.totalSteps === undefined ? 'Non renseigné' : formatNumber(calc.walkingSteps)}</strong></Link>
            <Link to={dateHref('/activites')} className="daily-summary-item"><span className="hero-icon-circle blue"><Footprints /></span><ExplainedLabel help="Récapitulatif de la durée et de la distance courues. La dépense est estimée à partir de la distance et de ton poids.">Course :</ExplainedLabel><strong>{runMinutes ? `${formatDuration(runMinutes)} • ${formatDecimal(runDistance)} km` : 'Non renseigné'}</strong></Link>
            <Link to={dateHref('/activites')} className="daily-summary-item"><span className="hero-icon-circle teal"><Bike /></span><ExplainedLabel help="Durée de vélo enregistrée pour cette date. L’intensité choisie détermine l’estimation de dépense." placement="right">Vélo :</ExplainedLabel><strong>{bikeMinutes ? `${bikeMinutes} min` : 'Non renseigné'}</strong></Link>
          </div>
        </section>

        <section className="equation-card reference-card" aria-label="Formule de la cible calorique">
          <EquationPart label={calc.strengthTrainingBaseAdjustmentKcal ? 'Base selon séance réelle' : 'Jour planifié'} value={calc.plannedBaseCalories} help={calc.strengthTrainingBaseAdjustmentKcal ? `La base planifiée de ${formatNumber(calc.scheduledBaseCalories)} kcal a été ajustée de ${calc.strengthTrainingBaseAdjustmentKcal > 0 ? '+' : ''}${formatNumber(calc.strengthTrainingBaseAdjustmentKcal)} kcal selon la séance réellement déclarée.` : 'Base calorique correspondant au type de journée planifié : Lower, Upper, Épaules-bras ou Repos. L’activité cible de ce jour est déjà comprise dans cette base.'} placement="left" />
          <EquationOperator symbol="+" />
          <EquationPart label="Activité supplémentaire" value={calc.activityDeltaKcal} signed help="Différence entre la dépense d’activité réellement enregistrée et la dépense d’activité déjà prévue dans le plan." />
          <EquationOperator symbol="×" />
          <div className="equation-part"><ExplainedLabel help="Part de l’écart d’activité ajoutée ou retirée de ta cible alimentaire. À 80 %, 800 kcal d’activité excédentaire ajoutent environ 640 kcal à la cible.">Restitution</ExplainedLabel><strong>{Math.round(state.settings.reintegrationRate * 100)} <small>%</small></strong></div>
          <EquationOperator symbol="=" />
          <div className="equation-part final"><ExplainedLabel help="Résultat final : quantité de calories à consommer pour conserver le déficit prévu tout en tenant compte de l’activité saisie." placement="right">Cible</ExplainedLabel><strong>{formatNumber(calc.adjustedCalorieTarget)} <small>kcal</small></strong></div>
        </section>

        <section className="today-insights-grid">
          <Link to={dateHref('/nutrition')} className="nutrition-today-card reference-card">
            <h2><ExplainedLabel help="Compare les calories enregistrées à la cible recalculée de la date sélectionnée." placement="left">Nutrition du jour</ExplainedLabel></h2>
            <div className="nutrition-values"><div><span>Consommé</span><strong>{formatNumber(consumed)} <small>kcal</small></strong></div><div><span>{remaining >= 0 ? 'Reste' : 'Dépassé'}</span><strong className={remaining >= 0 ? 'teal-text' : 'orange-text'}>{formatNumber(Math.abs(remaining))} <small>kcal</small></strong></div></div>
            <div className="reference-progress"><span style={{ width: `${nutritionPercent}%` }} /></div>
            <div className="progress-percent">{Math.round(nutritionPercent)} %</div>
            <p>Objectif : {formatNumber(calc.adjustedCalorieTarget)} kcal</p>
          </Link>

          <Link to={dateHref('/semaine')} className="weekly-margin-card reference-card">
            <h2><ExplainedLabel help="Somme des calories cibles non consommées, ou dépassées, sur les jours renseignés de la semaine sélectionnée.">Marge hebdo disponible</ExplainedLabel></h2>
            <strong className={weeklyMargin >= 0 ? 'teal-text' : 'orange-text'}>{weeklyMargin >= 0 ? '+' : '−'}{formatNumber(Math.abs(weeklyMargin))} <small>kcal</small></strong>
            <div className="margin-gauge"><span className="margin-pin" style={{ left: `${marginPosition}%` }} /></div>
            <div className="gauge-labels"><span>−1 500</span><span>0</span><span>+1 500</span></div>
            <p>Plage cible hebdo : −500 à +1 500 kcal</p>
          </Link>

          <Link to={dateHref('/progression')} className="weight-mini-card reference-card">
            <h2><ExplainedLabel help="La moyenne mobile lisse les variations quotidiennes dues à l’eau, au glycogène et au contenu digestif." placement="right">Poids – Moyenne 7 jours : {formatDecimal(rolling)} kg</ExplainedLabel></h2>
            <div className="mini-chart">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weights} margin={{ top: 16, right: 14, bottom: 0, left: -18 }}>
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#405574', fontSize: 12 }} />
                  <YAxis width={44} domain={['dataMin - 0.4', 'dataMax + 0.4']} axisLine={false} tickLine={false} tick={{ fill: '#405574', fontSize: 11 }} tickFormatter={(value) => formatDecimal(Number(value), 1)} />
                  <Tooltip formatter={(value) => `${formatDecimal(Number(value))} kg`} />
                  <Line type="monotone" dataKey="display" stroke="#0a9089" strokeWidth={3} dot={{ r: 4, fill: '#fff', stroke: '#0a9089', strokeWidth: 3 }} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Link>
        </section>

        <section className="today-actions">
          <Link to={dateHref('/activites')} className="reference-action teal-action"><Plus /><span>Ajouter une activité</span></Link>
          <Link to={dateHref('/nutrition')} className="reference-action blue-action"><Utensils /><span>Saisir mes calories</span></Link>
        </section>
      </div>
    </div>
  )
}

function EquationPart({ label, value, signed = false, help, placement = 'center' }: { label: string; value: number; signed?: boolean; help: string; placement?: 'left' | 'center' | 'right' }) {
  return <div className="equation-part"><ExplainedLabel help={help} placement={placement}>{label}</ExplainedLabel><strong>{signed && value > 0 ? '+' : ''}{formatNumber(value)} <small>kcal</small></strong></div>
}

function EquationOperator({ symbol }: { symbol: string }) {
  return <span className="equation-operator">{symbol}</span>
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (!hours) return `${rest} min`
  return `${hours} h${rest ? ` ${String(rest).padStart(2, '0')}` : ''}`
}
