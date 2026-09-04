import { Link, useSearchParams } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ClipboardCheck, Dumbbell, Target, TrendingUp, Trophy } from 'lucide-react'
import { useApp } from '../state/AppContext'
import { useJournalDate } from '../hooks/useJournalDate'
import { addDays, formatCompactDate } from '../domain/dates'
import { conventionLabels, exerciseHistory } from '../domain/training'
import { formatDecimal, formatNumber } from '../domain/format'
import { Card, Field, InfoBanner, PageHeader, ProgressBar, SelectField } from '../components/ui'
import { ExplainedLabel } from '../components/HelpTooltip'
import { SessionsShell } from '../components/sessions/SessionsUI'

export function SessionsStatsPage() {
  const { state } = useApp()
  const { selectedDate } = useJournalDate()
  const [params, setParams] = useSearchParams()
  const catalogue = state.catalogue ?? []
  const exerciseId = params.get('exerciseId') ?? catalogue[0]?.id ?? ''
  const definition = catalogue.find(e => e.id === exerciseId)
  const equipments = [...new Set([definition?.equipmentId, ...Object.values(state.logs).flatMap(l => l.training?.exercises.filter(e => e.exerciseId === exerciseId).map(e => e.equipmentId) ?? [])].filter((e): e is string => !!e))]
  const equipmentId = params.get('equipmentId') ?? equipments[0] ?? ''
  const days = ['28', '56', '90', '3650'].includes(params.get('period') ?? '') ? +(params.get('period')!) : 56
  const from = addDays(selectedDate, -days + 1)
  const history = exerciseHistory(state, exerciseId, equipmentId, from, selectedDate)
  const best = history.map(h => h.best).sort((a, b) => (b.loadKg ?? 0) - (a.loadKg ?? 0) || (b.reps ?? 0) - (a.reps ?? 0))[0]
  const defaultLoad = best?.loadKg
  const fixedLoad = params.has('load') && Number.isFinite(+params.get('load')!) ? +params.get('load')! : defaultLoad
  const points = fixedLoad === undefined ? [] : history.flatMap(h => { const sets = h.sets.filter(s => s.loadKg === fixedLoad); return sets.length ? [{ date: formatCompactDate(h.date), reps: Math.max(...sets.map(s => s.reps!)) }] : [] })
  const volumes = history.filter(h => h.volume !== null)
  const average = volumes.length === history.length && volumes.length ? volumes.reduce((sum, h) => sum + h.volume!, 0) / volumes.length : null
  const delta = points.length > 1 ? points.at(-1)!.reps - points[0].reps : null
  const plannedDates = Object.entries(state.schedule).filter(([date, id]) => date >= from && date <= selectedDate && id !== 'rest').map(([date]) => date)
  const completed = plannedDates.filter(date => state.logs[date]?.training?.status === 'completed').length
  function filter(key: string, value: string) { const next = new URLSearchParams(params); next.set(key, value); if (key === 'exerciseId') { next.delete('equipmentId'); next.delete('load') } setParams(next) }
  return <SessionsShell><PageHeader title="Progression par exercice" description="Compare tes séances, pas des exercices différents." action={<a className="button button-primary" href="#exercise-history"><TrendingUp /> Voir l’historique</a>} />
    <div className="stats-filters"><SelectField label="Exercice" value={exerciseId} onChange={e => filter('exerciseId', e.target.value)}>{catalogue.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}{!catalogue.length && <option value="">Aucun exercice</option>}</SelectField><SelectField label="Matériel" value={equipmentId} onChange={e => filter('equipmentId', e.target.value)}>{equipments.map(e => <option key={e} value={e}>{e === 'legacy-unspecified' ? 'Historique non précisé' : e}</option>)}</SelectField><SelectField label="Période" value={days} onChange={e => filter('period', e.target.value)}><option value={28}>4 dernières semaines</option><option value={56}>8 dernières semaines</option><option value={90}>90 derniers jours</option><option value={3650}>10 dernières années</option></SelectField><Field label="Charge fixe (kg)" type="number" inputMode="decimal" min={0} max={2000} step="any" value={fixedLoad ?? ''} onChange={e => filter('load', e.target.value)} /></div>
    <div className="stats-kpis">{[
      { label: 'Meilleure série', help: 'Plus grande charge saisie, puis répétitions pour départager. Aucune estimation de 1RM ni record inter-matériel.', value: best ? `${best.loadKg ?? 'PDC'} kg × ${best.reps}` : '—', icon: Trophy },
      { label: 'Répétitions à charge fixe', help: 'Différence entre la dernière et la première occurrence comparable à cette charge. Au moins deux dates sont nécessaires.', value: delta === null ? '—' : `${delta > 0 ? '+' : ''}${delta} reps`, icon: TrendingUp },
      { label: 'Volume moyen', help: 'Moyenne par occurrence terminée sur la période. Seules les séries de travail validées sont incluses, selon la convention de charge.', value: average === null ? '—' : `${formatNumber(average)} kg`, icon: Dumbbell },
      { label: 'Séances suivies', help: 'Occurrences terminées contenant au moins une série de travail validée pour cet exercice et ce matériel.', value: String(history.length), icon: ClipboardCheck },
    ].map(({ label, help, value, icon: Icon }) => <Card key={label}><Icon /><div><ExplainedLabel help={help}>{label}</ExplainedLabel><strong>{value}</strong></div></Card>)}</div>
    {!history.length && <InfoBanner>Aucune performance terminée pour cet exercice et ce matériel sur cette période. Les graphiques apparaîtront après tes premières séries validées.</InfoBanner>}
    <div className="stats-chart-grid"><Card className="session-panel"><h2><ExplainedLabel help="Meilleure série à cette charge dans chaque occurrence. Aucun point n’est créé pour une séance sans cette charge.">Répétitions à charge fixe</ExplainedLabel> {fixedLoad !== undefined && <span className="day-pill">{fixedLoad} kg</span>}</h2><div className="session-chart">{points.length >= 2 ? <ResponsiveContainer><LineChart data={points}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="date" /><YAxis allowDecimals={false} /><Tooltip /><Line dataKey="reps" name="Répétitions" stroke="#0a9089" strokeWidth={3} dot={{ r: 5 }} isAnimationActive={false} /></LineChart></ResponsiveContainer> : <p>Pas assez de dates comparables pour une tendance.</p>}</div></Card><Card className="session-panel"><h2><ExplainedLabel help="Somme charge × répétitions par séance terminée. Les valeurs de matériel différent ne sont pas mélangées.">Volume par séance</ExplainedLabel></h2><div className="session-chart">{volumes.length ? <ResponsiveContainer><BarChart data={volumes.map(h => ({ ...h, label: formatCompactDate(h.date) }))}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" /><YAxis /><Tooltip /><Bar dataKey="volume" name="Volume (kg)" fill="#145fcf" radius={[4, 4, 0, 0]} isAnimationActive={false} /></BarChart></ResponsiveContainer> : <p>Volume indisponible — aucune série comparable validée.</p>}</div></Card></div>
    <div className="stats-history-grid"><Card className="session-panel" id="exercise-history"><h2>Historique · {definition?.name ?? 'Exercice introuvable'}</h2><div className="session-table-scroll"><table><thead><tr><th>Date</th><th>Séance</th><th>Meilleure série</th><th>Séries validées</th><th>Volume</th><th>RIR moyen</th><th>Détail</th></tr></thead><tbody>{[...history].reverse().map(h => <tr key={h.date}><td>{formatCompactDate(h.date)}</td><td>{h.sessionName}</td><td>{h.best.loadKg ?? 'PDC'} kg × {h.best.reps}</td><td>{h.sets.length}</td><td>{h.volume === null ? '—' : `${formatNumber(h.volume)} kg`}</td><td>{h.averageRir === null ? '—' : formatDecimal(h.averageRir)}</td><td><Link aria-label={`Voir la séance du ${h.date}`} to={`/seances/journal?date=${h.date}&lineId=${h.lineId}`}>Voir</Link></td></tr>)}</tbody></table></div>{!history.length && <p>Aucun historique pour ces filtres.</p>}</Card><Card className="session-panel"><h2>Comparaison fiable</h2><p>Même exercice, même matériel, séries de travail validées et séances terminées.</p><p>Convention : {conventionLabels[definition?.convention ?? 'unknown']}.</p><p>Les données anciennes sans convention gardent leurs charges et répétitions ; aucun tonnage n’est inventé.</p><InfoBanner tone="warning">Le tonnage n’est pas une mesure de calories brûlées.</InfoBanner></Card></div>
    <Card className="adherence-card"><Target /><strong>{completed} / {plannedDates.length}</strong><ExplainedLabel help={`Séances terminées parmi les jours planifiés du ${formatCompactDate(from)} au ${formatCompactDate(selectedDate)} inclus. Jours futurs exclus ; séances partielles terminées incluses. Un repos corrigé ne compte plus au dénominateur.`}>Adhérence au planning sur la période</ExplainedLabel><ProgressBar value={completed} max={plannedDates.length} /><span>{plannedDates.length ? `${Math.round(completed / plannedDates.length * 100)} %` : '—'}</span></Card>
  </SessionsShell>
}
