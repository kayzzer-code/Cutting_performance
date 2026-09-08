import { Link, useSearchParams } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { BarChart3, ClipboardCheck, Dumbbell, Flame, Target, TrendingUp, Trophy } from 'lucide-react'
import { useApp } from '../state/AppContext'
import { useJournalDate } from '../hooks/useJournalDate'
import { addDays, formatCompactDate, startOfWeek } from '../domain/dates'
import { conventionLabels, exerciseHistory } from '../domain/training'
import { aggregateMusclesForSessions, completedSessions, summarizeSessions } from '../domain/trainingAnalytics'
import { muscleGroups } from '../domain/exerciseCatalogue'
import { formatDecimal, formatNumber } from '../domain/format'
import { Card, Field, InfoBanner, PageHeader, ProgressBar, SelectField } from '../components/ui'
import { ExplainedLabel } from '../components/HelpTooltip'
import { SessionsShell } from '../components/sessions/SessionsUI'

type StatsView = 'exercise' | 'muscles' | 'weekly'

export function SessionsStatsPage() {
  const { state } = useApp()
  const { selectedDate } = useJournalDate()
  const [params, setParams] = useSearchParams()
  const catalogue = state.catalogue ?? []
  const view = (['exercise', 'muscles', 'weekly'].includes(params.get('view') ?? '') ? params.get('view') : 'exercise') as StatsView
  const exerciseId = params.get('exerciseId') ?? catalogue[0]?.id ?? ''
  const definition = catalogue.find(exercise => exercise.id === exerciseId)
  const equipments = [...new Set([definition?.equipmentId, ...Object.values(state.logs).flatMap(log => log.training?.exercises.filter(exercise => exercise.exerciseId === exerciseId).map(exercise => exercise.equipmentId) ?? [])].filter((equipment): equipment is string => !!equipment))]
  const equipmentId = params.get('equipmentId') ?? equipments[0] ?? ''
  const resolvedEquipmentId = equipments.includes(equipmentId) ? equipmentId : equipments[0] ?? equipmentId
  const days = ['28', '56', '90', '3650'].includes(params.get('period') ?? '') ? +(params.get('period')!) : 56
  const from = addDays(selectedDate, -days + 1)
  const history = exerciseHistory(state, exerciseId, resolvedEquipmentId, from, selectedDate)
  const best = history.map(item => item.best).sort((a, b) => (b.loadKg ?? 0) - (a.loadKg ?? 0) || (b.reps ?? 0) - (a.reps ?? 0))[0]
  const defaultLoad = best?.loadKg
  const fixedLoad = params.has('load') && Number.isFinite(+params.get('load')!) ? +params.get('load')! : defaultLoad
  const points = fixedLoad === undefined ? [] : history.flatMap(item => { const sets = item.sets.filter(set => set.loadKg === fixedLoad); return sets.length ? [{ date: formatCompactDate(item.date), reps: Math.max(...sets.map(set => set.reps!)) }] : [] })
  const volumes = history.filter(item => item.volume !== null)
  const average = volumes.length === history.length && volumes.length ? volumes.reduce((sum, item) => sum + item.volume!, 0) / volumes.length : null
  const delta = points.length > 1 ? points.at(-1)!.reps - points[0].reps : null
  const plannedDates = Object.entries(state.schedule).filter(([date, id]) => date >= from && date <= selectedDate && id !== 'rest').map(([date]) => date)
  const completed = plannedDates.filter(date => state.logs[date]?.training?.status === 'completed').length
  const templateId = params.get('templateId') ?? ''
  const muscleId = params.get('muscleId') ?? ''
  const periodSessions = completedSessions(state, from, selectedDate, templateId || undefined)
  const muscleRows = aggregateMusclesForSessions(periodSessions).filter(item => !muscleId || item.muscleId === muscleId)
  const weekStart = startOfWeek(selectedDate)
  const currentWeekSessions = completedSessions(state, weekStart, addDays(weekStart, 6))
  const previousWeekSessions = completedSessions(state, addDays(weekStart, -7), addDays(weekStart, -1))
  const currentWeek = summarizeSessions(currentWeekSessions)
  const previousWeek = summarizeSessions(previousWeekSessions)
  const currentMuscles = aggregateMusclesForSessions(currentWeekSessions)
  const weeklyRows = Array.from({ length: 8 }, (_, index) => {
    const start = addDays(weekStart, (index - 7) * 7)
    const sessions = completedSessions(state, start, addDays(start, 6))
    const summary = summarizeSessions(sessions)
    return { label: formatCompactDate(start), tonnage: summary.tonnage, sets: summary.workingSets, sessions: sessions.length }
  })
  function filter(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value); else next.delete(key)
    if (key === 'exerciseId') { next.delete('equipmentId'); next.delete('load') }
    setParams(next)
  }
  function deltaPercent(value: number | null, previous: number | null) { return previous && value !== null ? Math.round((value - previous) / previous * 100) : null }

  return <SessionsShell>
    <PageHeader title="Statistiques de musculation" description="Performances, volume musculaire et charge hebdomadaire issus de tes séries validées." action={view === 'exercise' ? <a className="button button-primary" href="#exercise-history"><TrendingUp /> Voir l’historique</a> : undefined} />
    <div className="stats-view-switch session-segments" aria-label="Vue des statistiques">{([['exercise', 'Par exercice'], ['muscles', 'Par muscle'], ['weekly', 'Semaine']] as const).map(([id, label]) => <button key={id} aria-pressed={view === id} onClick={() => filter('view', id)}>{label}</button>)}</div>

    {view === 'exercise' && <>
      <div className="stats-filters"><SelectField label="Exercice" value={exerciseId} onChange={event => filter('exerciseId', event.target.value)}>{catalogue.map(exercise => <option key={exercise.id} value={exercise.id}>{exercise.name}</option>)}{!catalogue.length && <option value="">Aucun exercice</option>}</SelectField><SelectField label="Matériel" value={equipmentId} onChange={event => filter('equipmentId', event.target.value)}>{!equipments.includes(equipmentId) && <option value={equipmentId}>Ancien filtre — données rapprochées</option>}{equipments.map(equipment => <option key={equipment} value={equipment}>{equipment === 'legacy-unspecified' ? 'Historique non précisé' : equipment}</option>)}</SelectField><PeriodSelect days={days} onChange={value => filter('period', value)} /><Field label="Charge fixe (kg)" type="number" inputMode="decimal" min={0} max={2000} step="any" value={fixedLoad ?? ''} onChange={event => filter('load', event.target.value)} /></div>
      <div className="stats-kpis">{[
        { label: 'Meilleure série', help: 'Plus grande charge saisie, puis répétitions pour départager. Aucune estimation de 1RM ni record inter-matériel.', value: best ? `${best.loadKg ?? 'PDC'} kg × ${best.reps}` : '—', icon: Trophy },
        { label: 'Répétitions à charge fixe', help: 'Différence entre la dernière et la première occurrence comparable à cette charge. Au moins deux dates sont nécessaires.', value: delta === null ? '—' : `${delta > 0 ? '+' : ''}${delta} reps`, icon: TrendingUp },
        { label: 'Volume moyen', help: 'Moyenne par occurrence terminée sur la période. Seules les séries de travail validées sont incluses, selon la convention de charge.', value: average === null ? '—' : `${formatNumber(average)} kg`, icon: Dumbbell },
        { label: 'Séances suivies', help: 'Occurrences terminées contenant au moins une série de travail validée pour cet exercice et ce matériel.', value: String(history.length), icon: ClipboardCheck },
      ].map(({ label, help, value, icon: Icon }) => <Card key={label}><Icon /><div><ExplainedLabel help={help}>{label}</ExplainedLabel><strong>{value}</strong></div></Card>)}</div>
      {!history.length && <InfoBanner>Aucune performance terminée pour cet exercice et ce matériel sur cette période. Les graphiques apparaîtront après tes premières séries validées.</InfoBanner>}
      <div className="stats-chart-grid"><Card className="session-panel"><h2><ExplainedLabel help="Meilleure série à cette charge dans chaque occurrence. Aucun point n’est créé pour une séance sans cette charge.">Répétitions à charge fixe</ExplainedLabel> {fixedLoad !== undefined && <span className="day-pill">{fixedLoad} kg</span>}</h2><div className="session-chart">{points.length >= 2 ? <ResponsiveContainer><LineChart data={points}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="date" /><YAxis allowDecimals={false} /><Tooltip /><Line dataKey="reps" name="Répétitions" stroke="#0a9089" strokeWidth={3} dot={{ r: 5 }} isAnimationActive={false} /></LineChart></ResponsiveContainer> : <p>Pas assez de dates comparables pour une tendance.</p>}</div></Card><Card className="session-panel"><h2><ExplainedLabel help="Somme charge × répétitions par séance terminée. Les valeurs de matériel différent ne sont pas mélangées.">Volume par séance</ExplainedLabel></h2><div className="session-chart">{volumes.length ? <ResponsiveContainer><BarChart data={volumes.map(item => ({ ...item, label: formatCompactDate(item.date) }))}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" /><YAxis /><Tooltip /><Bar dataKey="volume" name="Volume (kg)" fill="#145fcd" radius={[4, 4, 0, 0]} isAnimationActive={false} /></BarChart></ResponsiveContainer> : <p>Volume indisponible — aucune série comparable validée.</p>}</div></Card></div>
      <div className="stats-history-grid"><Card className="session-panel" id="exercise-history"><h2>Historique · {definition?.name ?? 'Exercice introuvable'}</h2><div className="session-table-scroll"><table><thead><tr><th>Date</th><th>Séance</th><th>Meilleure série</th><th>Séries validées</th><th>Volume</th><th>RIR moyen</th><th>Détail</th></tr></thead><tbody>{[...history].reverse().map(item => <tr key={item.date}><td>{formatCompactDate(item.date)}</td><td>{item.sessionName}</td><td>{item.best.loadKg ?? 'PDC'} kg × {item.best.reps}</td><td>{item.sets.length}</td><td>{item.volume === null ? '—' : `${formatNumber(item.volume)} kg`}</td><td>{item.averageRir === null ? '—' : formatDecimal(item.averageRir)}</td><td><Link aria-label={`Voir la séance du ${item.date}`} to={`/seances/journal?date=${item.date}&lineId=${item.lineId}`}>Voir</Link></td></tr>)}</tbody></table></div>{!history.length && <p>Aucun historique pour ces filtres.</p>}</Card><Card className="session-panel"><h2>Comparaison fiable</h2><p>Même exercice, même matériel, séries de travail validées et séances terminées.</p><p>Convention : {conventionLabels[definition?.convention ?? 'unknown']}.</p><p>Les données anciennes sans convention gardent leurs performances ; aucun tonnage n’est inventé.</p><InfoBanner tone="warning">Le tonnage n’est pas une mesure de dépense calorique.</InfoBanner></Card></div>
      <Card className="adherence-card"><Target /><strong>{completed} / {plannedDates.length}</strong><ExplainedLabel help={`Séances terminées parmi les jours planifiés du ${formatCompactDate(from)} au ${formatCompactDate(selectedDate)} inclus. Jours futurs exclus ; séances partielles terminées incluses. Un repos corrigé ne compte plus au dénominateur.`}>Adhérence au planning sur la période</ExplainedLabel><ProgressBar value={completed} max={plannedDates.length} /><span>{plannedDates.length ? `${Math.round(completed / plannedDates.length * 100)} %` : '—'}</span></Card>
    </>}

    {view === 'muscles' && <>
      <div className="stats-filters muscle-stats-filters"><SelectField label="Muscle" value={muscleId} onChange={event => filter('muscleId', event.target.value)}><option value="">Tous les muscles</option>{muscleGroups.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</SelectField><SelectField label="Séance" value={templateId} onChange={event => filter('templateId', event.target.value)}><option value="">Toutes les séances</option>{state.templates.filter(item => !item.archived).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</SelectField><PeriodSelect days={days} onChange={value => filter('period', value)} /></div>
      {!muscleRows.length && <InfoBanner>Aucune série de travail validée sur cette période. Termine une séance pour alimenter cette vue.</InfoBanner>}
      <div className="muscle-stat-grid">{muscleRows.map(row => <Card key={row.muscleId} className="muscle-stat-card"><header><span style={{ background: row.color }} /><div><h2>{row.label}</h2><p>{row.contributors.length} exercice{row.contributors.length > 1 ? 's' : ''}</p></div><Flame /></header><div className="muscle-stat-values"><span><small>Séries directes</small><strong>{row.directSets}</strong></span><span><small>Séries effectives</small><strong>{formatDecimal(row.effectiveSets)}</strong></span><span><small>Tonnage attribué</small><strong>{row.attributedTonnage === null ? '—' : `${formatNumber(row.attributedTonnage)} kg`}</strong></span></div><ProgressBar value={row.effectiveSets} max={Math.max(20, row.effectiveSets)} tone="blue" /><details><summary>Voir les exercices contributeurs</summary>{row.contributors.map(item => <p key={`${item.exerciseId}-${item.name}`}>{item.name}<strong>{formatDecimal(item.effectiveSets)} séries</strong></p>)}</details></Card>)}</div>
      <InfoBanner><ExplainedLabel help="Une série principale compte 1 série directe et 1 série effective. Les muscles secondaires reçoivent le coefficient défini dans le catalogue. Le tonnage attribué suit le même coefficient.">Comprendre les séries effectives</ExplainedLabel></InfoBanner>
    </>}

    {view === 'weekly' && <>
      <div className="weekly-stats-kpis">{[
        { label: 'Séances terminées', value: currentWeekSessions.length, previous: previousWeekSessions.length, icon: ClipboardCheck },
        { label: 'Séries de travail', value: currentWeek.workingSets, previous: previousWeek.workingSets, icon: Dumbbell },
        { label: 'Répétitions', value: currentWeek.repetitions, previous: previousWeek.repetitions, icon: TrendingUp },
        { label: 'Tonnage', value: currentWeek.tonnage, previous: previousWeek.tonnage, icon: BarChart3 },
      ].map(item => { const trend = deltaPercent(item.value, item.previous); const Icon = item.icon; return <Card key={item.label}><Icon /><span>{item.label}</span><strong>{item.value === null ? '—' : formatNumber(item.value)}{item.label === 'Tonnage' && item.value !== null ? ' kg' : ''}</strong><small className={trend !== null && trend >= 0 ? 'positive' : 'negative'}>{trend === null ? 'Pas de comparaison' : `${trend > 0 ? '+' : ''}${trend} % vs semaine précédente`}</small></Card> })}</div>
      <div className="weekly-stats-layout"><Card className="session-panel"><h2>Tendance sur 8 semaines</h2><div className="session-chart"><ResponsiveContainer><BarChart data={weeklyRows}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" /><YAxis /><Tooltip /><Bar dataKey="tonnage" name="Tonnage (kg)" fill="#176bdc" radius={[5, 5, 0, 0]} isAnimationActive={false} /></BarChart></ResponsiveContainer></div></Card><Card className="session-panel"><h2>Volume musculaire cette semaine</h2>{currentMuscles.length ? <div className="weekly-muscle-list">{currentMuscles.map(row => <div key={row.muscleId}><span>{row.shortLabel}</span><ProgressBar value={row.effectiveSets} max={Math.max(20, ...currentMuscles.map(item => item.effectiveSets))} /><strong>{formatDecimal(row.effectiveSets)} séries</strong></div>)}</div> : <p>Aucune séance terminée cette semaine.</p>}</Card></div>
      <InfoBanner tone="warning">Le tonnage sert à comparer ton entraînement à convention constante ; ce n’est ni une estimation de dépense calorique, ni un score de qualité.</InfoBanner>
    </>}
  </SessionsShell>
}

function PeriodSelect({ days, onChange }: { days: number; onChange: (value: string) => void }) {
  return <SelectField label="Période" value={days} onChange={event => onChange(event.target.value)}><option value={28}>4 dernières semaines</option><option value={56}>8 dernières semaines</option><option value={90}>90 derniers jours</option><option value={3650}>10 dernières années</option></SelectField>
}
