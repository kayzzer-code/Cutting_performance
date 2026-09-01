import { useState } from 'react'
import { CalendarDays, CheckCircle2, ClipboardList, Clock3, Crosshair, Info, Target, TrendingUp } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Area, AreaChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { calculateDay, calculateWeeklyMargin } from '../domain/calculations'
import { formatDayName, formatLongDate, formatShortDate, isoDate, weekDates } from '../domain/dates'
import { useApp } from '../state/AppContext'
import { formatDecimal, formatNumber } from '../domain/format'
import { useJournalDate } from '../hooks/useJournalDate'
import { journalLogForDate } from '../domain/journal'
import { ExplainedLabel } from '../components/HelpTooltip'

export function WeekPage() {
  const { state, setWeeklyStrategy, updateLog } = useApp()
  const [allocationApplied, setAllocationApplied] = useState(false)
  const { selectedDate } = useJournalDate()
  const currentDate = isoDate()
  const dates = weekDates(selectedDate)
  const rows = dates.map((date) => {
    const log = journalLogForDate(state, date)
    const calc = calculateDay(log, state.profile, state.settings)
    return { date, log, calc, gap: log.caloriesConsumed === undefined ? undefined : log.caloriesConsumed - calc.adjustedCalorieTarget }
  })
  const totalTarget = rows.reduce((sum, row) => sum + row.calc.adjustedCalorieTarget, 0)
  const totalActual = rows.reduce((sum, row) => sum + (row.log.caloriesConsumed ?? 0), 0)
  const weeklyMargin = calculateWeeklyMargin(rows.map((row) => row.log), state.profile, state.settings)
  const remainingDays = Math.max(1, rows.filter((row) => row.date > selectedDate).length)
  const allocation = Math.round(weeklyMargin / remainingDays / 10) * 10
  const weights = Object.values(state.logs).filter((log) => log.weightKg !== undefined).sort((a, b) => a.date.localeCompare(b.date))
  const firstWeight = weights[0]?.weightKg ?? state.profile.referenceWeightKg
  const lastWeight = weights.at(-1)?.weightKg ?? state.profile.currentWeightKg
  const spanDays = weights.length > 1 ? Math.max(1, (new Date(weights.at(-1)!.date).getTime() - new Date(weights[0].date).getTime()) / 86_400_000) : 7
  const rhythm = (lastWeight - firstWeight) * 7 / spanDays
  const chartData = rows.reduce<{ target: number; actual: number; data: Array<{ label: string; target: number; actual?: number }> }>((acc, row) => {
    const target = acc.target + row.calc.adjustedCalorieTarget
    const actual = acc.actual + (row.log.caloriesConsumed ?? 0)
    return { target, actual, data: [...acc.data, { label: formatDayName(row.date).slice(0, 3), target, actual: row.log.caloriesConsumed === undefined && acc.actual === 0 ? undefined : actual }] }
  }, { target: 0, actual: 0, data: [] }).data

  function applyAllocation() {
    if (!window.confirm(`Ajouter ${allocation >= 0 ? '+' : ''}${allocation} kcal aux ${remainingDays} jours restants ?`)) return
    rows.filter((row) => row.date > selectedDate).forEach((row) => updateLog(row.date, { plannedBaseCalories: row.calc.plannedBaseCalories + allocation }))
    setAllocationApplied(true)
  }

  return (
    <div className="reference-page week-reference">
      <header className="reference-topbar page-title-topbar"><div className="title-stack"><h1>Bilan de la semaine</h1><p>{formatShortDate(dates[0])} – {formatShortDate(dates[6])} <b>•</b> Les écarts se compensent sur 7 jours</p></div></header>
      <div className="reference-body week-body">
        <section className="week-kpis-reference">
          <WeekKpi icon={<Crosshair />} label="Cible hebdo recalculée" value={totalTarget} unit="kcal" tone="teal" help="Somme des sept cibles journalières recalculées pour la semaine affichée." placement="left" />
          <WeekKpi icon={<ClipboardList />} label="Calories enregistrées" value={totalActual} unit="kcal" tone="blue" help="Total des calories réellement saisies sur les jours renseignés de cette semaine." />
          <WeekKpi icon={<TrendingUp />} label="Marge actuelle" value={weeklyMargin} unit="kcal" signed tone="teal" help="Cible hebdomadaire moins calories enregistrées. Positive : réserve disponible. Négative : dépassement cumulé." />
          <WeekKpi icon={<Target />} label="Rythme estimé" value={rhythm} unit="kg / semaine" signed decimals tone="purple" help="Variation de poids extrapolée sur sept jours à partir des pesées disponibles. Peu fiable avec trop peu de données." placement="right" />
        </section>

        <section className="week-matrix-card reference-card">
          <div className="week-matrix-row week-days"><span />{rows.map((row) => <strong key={row.date}>{formatDayName(row.date).slice(0, 3)} {new Date(`${row.date}T12:00:00`).getDate()}</strong>)}</div>
          <MatrixRow icon={<Target />} label="Cible" help="Cible calorique de chaque jour après prise en compte des activités. Clique sur une valeur pour voir son calcul détaillé dans Aujourd’hui.">{rows.map((row) => <WeekValueLink key={row.date} date={row.date} currentDate={currentDate} destination="/aujourdhui" label={`Voir le détail de la cible du ${formatLongDate(row.date).toLocaleLowerCase('fr-FR')}`}>{formatNumber(row.calc.adjustedCalorieTarget)}</WeekValueLink>)}</MatrixRow>
          <MatrixRow icon={<ClipboardList />} label="Réel" help="Calories effectivement enregistrées pour chaque journée. Clique sur une valeur ou un tiret pour ouvrir la saisie Nutrition de ce jour.">{rows.map((row) => <WeekValueLink key={row.date} date={row.date} currentDate={currentDate} destination="/nutrition" label={`${row.log.caloriesConsumed === undefined ? 'Saisir' : 'Voir'} les calories réelles du ${formatLongDate(row.date).toLocaleLowerCase('fr-FR')}`} className={row.log.caloriesConsumed !== undefined && row.log.caloriesConsumed <= row.calc.adjustedCalorieTarget ? 'teal-text' : row.log.caloriesConsumed !== undefined ? 'orange-text' : ''}>{row.log.caloriesConsumed === undefined ? '—' : formatNumber(row.log.caloriesConsumed)}</WeekValueLink>)}</MatrixRow>
          <MatrixRow icon={<TrendingUp />} label="Écart" help="Calories réelles moins cible : positif signifie un dépassement, négatif signifie une marge.">{rows.map((row) => <span key={row.date} className={row.gap === undefined ? '' : row.gap <= 0 ? 'teal-text' : 'orange-text'}>{row.gap === undefined ? '—' : `${row.gap > 0 ? '+' : '−'}${formatNumber(Math.abs(row.gap))}`}</span>)}</MatrixRow>
          <MatrixRow icon={<CalendarDays />} label="Statut" help="Indique si les calories de la journée ont déjà été enregistrées.">{rows.map((row) => row.log.caloriesConsumed === undefined ? <span className="day-status pending" key={row.date}><Clock3 /> À saisir</span> : <span className={`day-status ${row.gap !== undefined && row.gap > 0 ? 'over' : 'done'}`} key={row.date}><CheckCircle2 /> Enregistré</span>)}</MatrixRow>
        </section>

        <section className="week-bottom-reference">
          <div className="week-chart-card reference-card"><h2><ExplainedLabel help="Compare l’accumulation progressive des calories cibles et des calories réellement saisies au fil de la semaine." placement="left">Évolution cumulée sur la semaine</ExplainedLabel></h2><div className="week-chart-legend"><span className="dash-blue" /> Cible cumulée <span className="line-teal" /> Calories réelles <span className="area-teal" /> Marge disponible</div><div className="large-week-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{ top: 20, right: 15, left: 0, bottom: 0 }}><defs><linearGradient id="marginArea" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#0a9089" stopOpacity={0.22}/><stop offset="95%" stopColor="#0a9089" stopOpacity={0.03}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#dce5ec"/><XAxis dataKey="label" tickLine={false} axisLine={false}/><YAxis tickLine={false} axisLine={false}/><Tooltip formatter={(value) => `${formatNumber(Number(value))} kcal`}/><Area type="monotone" dataKey="target" fill="url(#marginArea)" stroke="none" isAnimationActive={false}/><Line type="monotone" dataKey="target" stroke="#1764d9" strokeWidth={3} strokeDasharray="7 6" dot={{ r: 4, fill: '#fff', strokeWidth: 2 }} isAnimationActive={false}/><Line type="monotone" dataKey="actual" stroke="#0a9089" strokeWidth={3} dot={{ r: 4, fill: '#fff', strokeWidth: 2 }} connectNulls isAnimationActive={false}/></AreaChart></ResponsiveContainer></div></div>
          <aside className="week-strategy-column">
            <section className="strategy-reference-card reference-card"><h2><ExplainedLabel help="Choisis si tu souhaites conserver l’écart, le répartir sur les jours suivants ou le réserver à un repas plus flexible." placement="right">Que faire de la marge ?</ExplainedLabel></h2><label><input type="radio" checked={state.weeklyStrategy === 'even'} onChange={() => setWeeklyStrategy('even')} /> Ne rien changer</label><label className={state.weeklyStrategy === 'flexible' ? 'selected' : ''}><input type="radio" checked={state.weeklyStrategy === 'flexible'} onChange={() => setWeeklyStrategy('flexible')} /> Répartir automatiquement</label><label><input type="radio" checked={state.weeklyStrategy === 'free-meal'} onChange={() => setWeeklyStrategy('free-meal')} /> Planifier un repas libre</label><div className="allocation-result"><ExplainedLabel help="La marge totale est divisée par le nombre de jours encore disponibles dans la semaine sélectionnée." placement="right">{weeklyMargin >= 0 ? '+' : '−'}{formatNumber(Math.abs(weeklyMargin))} kcal ÷ {remainingDays} jours =</ExplainedLabel><strong>{allocation >= 0 ? '+' : '−'}{formatNumber(Math.abs(allocation))} kcal / jour</strong></div><button onClick={applyAllocation} disabled={allocationApplied}>{allocationApplied ? 'Répartition appliquée' : 'Appliquer aux jours restants'}</button></section>
            <div className="reference-warning"><Info /> Si la moyenne de poids baisse trop vite pendant 7–14 jours, la marge devient une augmentation durable de la cible.</div>
          </aside>
        </section>
      </div>
    </div>
  )
}

function WeekKpi({ icon, label, value, unit, signed, decimals, tone, help, placement = 'center' }: { icon: React.ReactNode; label: string; value: number; unit: string; signed?: boolean; decimals?: boolean; tone: string; help: string; placement?: 'left' | 'center' | 'right' }) {
  return <div className={`week-kpi reference-card kpi-${tone}`}><span className="hero-icon-circle">{icon}</span><div><ExplainedLabel help={help} placement={placement}>{label}</ExplainedLabel><strong>{signed && value > 0 ? '+' : ''}{decimals ? formatDecimal(value, 2) : formatNumber(value)} <small>{unit}</small></strong></div></div>
}

function MatrixRow({ icon, label, help, children }: { icon: React.ReactNode; label: string; help: string; children: React.ReactNode }) {
  return <div className="week-matrix-row"><strong>{icon}<ExplainedLabel help={help} placement="left">{label}</ExplainedLabel></strong>{children}</div>
}

function WeekValueLink({ date, currentDate, destination, label, className = '', children }: { date: string; currentDate: string; destination: string; label: string; className?: string; children: React.ReactNode }) {
  if (date > currentDate) {
    return <span className={`week-matrix-future ${className}`} aria-label={`${label} — disponible à partir de cette date`}>{children}</span>
  }

  return <Link className={`week-matrix-link ${className}`} to={`${destination}?date=${date}`} aria-label={label} title={label}>{children}</Link>
}
