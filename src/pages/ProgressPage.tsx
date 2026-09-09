import { useMemo, useState, type FormEvent } from 'react'
import { CalendarDays, CheckCircle2, Gauge, Plus, Scale, ThumbsUp, TrendingDown, TrendingUp, X } from 'lucide-react'
import { Area, Bar, BarChart, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from 'recharts'
import { calculateDay, rollingAverage, suggestedCalorieAdjustment } from '../domain/calculations'
import { formatCompactDate, formatLongDate } from '../domain/dates'
import { useApp } from '../state/AppContext'
import { formatDecimal, formatNumber } from '../domain/format'
import { useJournalDate } from '../hooks/useJournalDate'
import { ExplainedLabel } from '../components/HelpTooltip'

export function ProgressPage() {
  const { state, setWeight, applyConfiguration } = useApp()
  const { selectedDate } = useJournalDate()
  const [weightOpen, setWeightOpen] = useState(false)
  const [weight, setWeightInput] = useState(state.logs[selectedDate]?.weightKg ?? state.profile.currentWeightKg)
  const points = useMemo(() => Object.values(state.logs).filter((log) => log.weightKg !== undefined).map((log) => ({ date: log.date, weight: log.weightKg as number })).sort((a, b) => a.date.localeCompare(b.date)), [state.logs])
  const averaged = rollingAverage(points)
  const first = points[0]
  const last = points.at(-1)
  const spanDays = first && last ? Math.max(1, (new Date(last.date).getTime() - new Date(first.date).getTime()) / 86_400_000) : 7
  const activeGoal = state.goals.find(goal => goal.id === state.activeGoalId && goal.status === 'active')
  const desiredWeeklyChange = activeGoal?.targetWeightChangeKgPerWeek ?? -state.profile.weeklyLossTargetKg
  const observedChange = first && last ? (last.weight - first.weight) * 7 / spanDays : 0
  const suggestion = suggestedCalorieAdjustment(-observedChange, -desiredWeeklyChange)
  const currentAverage = averaged.at(-1)?.average ?? last?.weight ?? state.profile.currentWeightKg
  const totalChange = currentAverage - state.profile.referenceWeightKg
  const trajectoryData = averaged.map((point, index) => ({ label: formatCompactDate(point.date), weight: point.weight, average: point.average, target: state.profile.referenceWeightKg + desiredWeeklyChange * index / 7 }))
  const calorieData = Object.values(state.logs).filter((log) => log.caloriesConsumed !== undefined).sort((a, b) => a.date.localeCompare(b.date)).slice(-14).map((log) => ({ label: formatCompactDate(log.date), target: calculateDay(log, state.profile, state.settings).adjustedCalorieTarget, actual: log.caloriesConsumed }))
  const kgRemaining = Math.abs(currentAverage - state.profile.targetWeightKg)
  const daysRemaining = Math.round(kgRemaining / Math.max(.1, Math.abs(desiredWeeklyChange)) * 7)
  const targetDate = new Date(); targetDate.setDate(targetDate.getDate() + daysRemaining)

  function submitWeight(event: FormEvent) {
    event.preventDefault(); setWeight(selectedDate, weight); setWeightOpen(false)
  }

  function applySuggestion() {
    if (!suggestion || !window.confirm(`Appliquer ${suggestion > 0 ? '+' : ''}${suggestion} kcal aux jours futurs ?`)) return
    const dayTypePlans = Object.fromEntries(Object.entries(state.settings.dayTypePlans).map(([key, plan]) => [key, { ...plan, calories: plan.calories + suggestion }])) as typeof state.settings.dayTypePlans
    applyConfiguration(state.profile, { ...state.settings, baseCalories: state.settings.baseCalories + suggestion, dayTypePlans })
  }

  return (
    <div className="reference-page progress-reference">
      <header className="reference-topbar page-title-topbar"><div className="title-stack"><h1>Progression et ajustements</h1><p>La cible évolue selon la moyenne du poids sur 7 à 14 jours</p></div><button className="header-primary-action" onClick={() => setWeightOpen(true)}><Plus /> Ajouter mon poids à cette date</button></header>
      <div className="reference-body progress-body">
        <section className="progress-kpis-reference">
          <ProgressKpi icon={<Scale />} label="Poids initial" value={state.profile.referenceWeightKg} unit="kg" help="Poids de référence utilisé au démarrage du suivi et pour calculer la perte totale." placement="left" />
          <ProgressKpi icon={<TrendingUp />} label="Moyenne actuelle" value={currentAverage} unit="kg" tone="teal" help="Dernière moyenne mobile disponible. Elle atténue les fluctuations normales du poids quotidien." />
          <ProgressKpi icon={totalChange <= 0 ? <TrendingDown /> : <TrendingUp />} label="Évolution totale" value={totalChange} unit="kg" signed tone="teal" help="Différence entre le poids de référence et la moyenne de poids la plus récente." />
          <ProgressKpi icon={<Gauge />} label="Rythme actuel" value={observedChange} unit="kg / semaine" signed tone="teal" help="Vitesse de variation extrapolée sur une semaine à partir des pesées disponibles." placement="right" />
        </section>

        <section className="progress-main-reference">
          <div className="weight-trajectory-card reference-card"><h2><ExplainedLabel help="Compare chaque pesée, la moyenne mobile et la pente théorique correspondant à ton objectif hebdomadaire." placement="left">Poids réel vs trajectoire cible</ExplainedLabel></h2><div className="chart-legend-reference"><span className="dot-legend"/>Poids quotidien <span className="line-teal"/>Moyenne 7 jours <span className="line-navy"/>Trajectoire {desiredWeeklyChange > 0 ? '+' : ''}{formatDecimal(desiredWeeklyChange)} kg / sem.</div><div className="trajectory-chart"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={trajectoryData} margin={{ top: 18, right: 18, left: 0, bottom: 8 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#dfe6ec"/><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10 }}/><YAxis width={46} domain={['dataMin - 1', 'dataMax + 1']} axisLine={false} tickLine={false} tickFormatter={(value) => formatDecimal(Number(value), 1)}/><Tooltip formatter={(value) => `${formatDecimal(Number(value), 2)} kg`}/><Area dataKey="target" fill="#eef1f4" stroke="none" isAnimationActive={false}/><Scatter dataKey="weight" fill="#0a9089" isAnimationActive={false}/><Line dataKey="average" type="monotone" stroke="#0a9089" strokeWidth={4} dot={false} connectNulls isAnimationActive={false}/><Line dataKey="target" type="monotone" stroke="#071a42" strokeWidth={3} dot={false} isAnimationActive={false}/><ReferenceLine y={state.profile.targetWeightKg} stroke="#0a9089" strokeDasharray="4 4"/></ComposedChart></ResponsiveContainer></div></div>
          <aside className="progress-diagnostic-column">
            <section className="diagnostic-reference-card reference-card"><h2><ExplainedLabel help="Analyse l’écart entre la variation de poids observée et celle demandée. Une recommandation n’est proposée qu’à partir des données enregistrées." placement="right">Diagnostic automatique</ExplainedLabel></h2><h3><CheckCircle2 /> {Math.abs(observedChange - desiredWeeklyChange) <= .2 ? 'Rythme dans la cible' : 'Rythme à surveiller'}</h3><p>Zone cible : {desiredWeeklyChange - .2 > 0 ? '+' : ''}{formatDecimal(desiredWeeklyChange - .2)} à {desiredWeeklyChange + .2 > 0 ? '+' : ''}{formatDecimal(desiredWeeklyChange + .2)} kg / semaine</p><div className="diagnostic-scale"><span style={{ left: `${Math.min(95, Math.max(5, 50 + (observedChange - desiredWeeklyChange) / 1.2 * 50))}%` }}/></div><strong className="diagnostic-number">{observedChange > 0 ? '+' : ''}{formatDecimal(observedChange, 2)}</strong><button onClick={applySuggestion}><ThumbsUp /> {suggestion === 0 ? 'Conserver les calories actuelles pendant 7 jours' : `${suggestion > 0 ? 'Ajouter' : 'Retirer'} ${Math.abs(suggestion)} kcal après confirmation`}</button></section>
            <section className="control-reference-card reference-card"><h2>Prochain contrôle <span><CalendarDays /> Dans 7 jours</span></h2><p><CheckCircle2 /> ≥ 5 pesées</p><p><CheckCircle2 /> Calories renseignées</p><p><CheckCircle2 /> Activité renseignée</p></section>
            <section className="projection-reference-card reference-card"><h2><ExplainedLabel help="Date théorique obtenue en prolongeant le rythme de perte défini. Elle évolue avec le poids moyen et ne constitue pas une garantie." placement="right">Projection {formatNumber(state.profile.targetWeightKg)} kg : {new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' }).format(targetDate)}</ExplainedLabel></h2><p>Si le rythme actuel se maintient</p><div className="projection-line"><span/><i/><b/></div><div className="projection-labels"><span>Aujourd’hui<br/>{formatDecimal(currentAverage)} kg</span><span>{formatNumber(state.profile.targetWeightKg)} kg<br/>{daysRemaining} jours</span><span>Objectif final<br/>{formatDecimal(state.profile.targetWeightKg)} kg</span></div></section>
          </aside>
        </section>

        <section className="calorie-bars-card reference-card"><h2><ExplainedLabel help="Compare les apports enregistrés aux cibles recalculées afin de repérer les écarts répétés." placement="left">Calories cibles et réelles</ExplainedLabel></h2><div className="calorie-bar-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={calorieData}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 9 }}/><YAxis tickLine={false} axisLine={false}/><Tooltip formatter={(value) => `${formatNumber(Number(value))} kcal`}/><Bar dataKey="target" fill="#a9d9d2" radius={[3,3,0,0]} isAnimationActive={false}/><Bar dataKey="actual" fill="#174ca4" radius={[3,3,0,0]} isAnimationActive={false}/></BarChart></ResponsiveContainer></div></section>
      </div>

      {weightOpen && <div className="modal-backdrop" onClick={() => setWeightOpen(false)}><form className="weight-modal" onSubmit={submitWeight} onClick={(event) => event.stopPropagation()}><button type="button" className="modal-close" onClick={() => setWeightOpen(false)}><X /></button><Scale /><h2>Poids du {formatLongDate(selectedDate).toLocaleLowerCase('fr-FR')}</h2><label><input aria-label="Poids à enregistrer" autoFocus type="number" inputMode="decimal" min="40" max="250" step="0.1" value={weight} onChange={(event) => setWeightInput(Number(event.target.value))}/><span>kg</span></label><button type="submit">Enregistrer la pesée</button></form></div>}
    </div>
  )
}

function ProgressKpi({ icon, label, value, unit, signed, tone = 'navy', help, placement = 'center' }: { icon: React.ReactNode; label: string; value: number; unit: string; signed?: boolean; tone?: string; help: string; placement?: 'left' | 'center' | 'right' }) {
  return <div className={`progress-kpi reference-card kpi-${tone}`}><span className="hero-icon-circle">{icon}</span><div><ExplainedLabel help={help} placement={placement}>{label}</ExplainedLabel><strong>{signed && value > 0 ? '+' : ''}{formatDecimal(value)} <small>{unit}</small></strong></div></div>
}
