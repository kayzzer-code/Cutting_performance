import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Archive, CalendarDays, Copy, Flame, Pencil, Plus, Search } from 'lucide-react'
import { useApp } from '../state/AppContext'
import { useJournalDate } from '../hooks/useJournalDate'
import { addDays, formatShortDate, isoDate } from '../domain/dates'
import { dayLabels, duplicateTemplate, normalized, previewSchedule, saveTemplate, targetText, typeOfTemplate } from '../domain/training'
import { formatNumber } from '../domain/format'
import { Button, Card, InfoBanner, PageHeader } from '../components/ui'
import { DayIcon, Modal, PlanningImpact, SessionsShell } from '../components/sessions/SessionsUI'
import type { TrainingTemplate } from '../domain/types'

export function SessionsLibraryPage() {
  const { state, transact } = useApp()
  const { dateHref, selectedDate } = useJournalDate()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [archived, setArchived] = useState(false)
  const [archive, setArchive] = useState<TrainingTemplate | null>(null)
  const [replaceFuture, setReplaceFuture] = useState(false)
  const [message, setMessage] = useState('')
  const templates = state.templates.filter(t => !!t.archived === archived && (filter === 'all' || t.dayType === filter) && normalized(`${t.name} ${t.description ?? ''}`).includes(normalized(search)))
  const future = archive ? Object.entries(state.schedule).filter(([d, id]) => d >= isoDate() && id === archive.id && !state.logs[d]?.training) : []
  return <SessionsShell><PageHeader title="Mes séances" description="Tes modèles, prêts à planifier et à suivre." action={<Link className="button button-primary" to={dateHref('/seances/nouvelle')}><Plus /> Créer une séance</Link>} />
    {message && <InfoBanner tone="success">{message}</InfoBanner>}
    <div className="session-filters"><label className="session-search"><Search /><input aria-label="Rechercher une séance" type="search" placeholder="Rechercher une séance" value={search} onChange={e => setSearch(e.target.value)} /></label><div className="session-segments">{[['all', 'Toutes'], ['upper', 'Upper'], ['lower', 'Lower'], ['shoulders-arms', 'Épaules-bras']].map(([id, label]) => <button key={id} aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>)}</div><label className="check-label"><input type="checkbox" checked={archived} onChange={e => setArchived(e.target.checked)} /> Archives</label></div>
    <p className="session-hint">Les calories de base suivent le type de journée ; le cardio est ajusté séparément.</p>
    <div className="session-library-grid">{templates.map(t => <Card className="template-card" key={t.id}><div className="template-card-heading"><DayIcon type={typeOfTemplate(t)} /><div><h2>{t.shortName}</h2><p>{t.description || t.name.split(' · ')[1] || 'Modèle personnalisé'}</p><small>{t.exercises.length} exercices · {t.exercises.reduce((sum, e) => sum + (e.setCount ?? 0), 0)} séries</small><span className={`day-pill type-${t.dayType}`}>{dayLabels[typeOfTemplate(t)]}{t.archived ? ' · Archivé' : ''}</span></div></div><ol>{t.exercises.slice(0, 3).map(e => <li key={e.id}><span>{e.name}</span><small>{targetText(e)}</small></li>)}</ol>{!t.exercises.length && <p>Modèle vide — ajoute des exercices avant de démarrer.</p>}<footer><span><Flame /> Base {formatNumber(state.settings.dayTypePlans[typeOfTemplate(t)].calories)} kcal</span><Link className="button button-secondary" to={dateHref(`/seances/${t.id}`)}>Voir la séance</Link><Link className="icon-button" aria-label={`Modifier ${t.shortName}`} to={dateHref(`/seances/${t.id}/modifier`)}><Pencil /></Link><button className="icon-button" aria-label={`Dupliquer ${t.shortName}`} onClick={() => { if (transact(s => saveTemplate(s, duplicateTemplate(t), false))) setMessage('Modèle dupliqué, sans copier de performances.') }}><Copy /></button><button className="icon-button" aria-label={`${t.archived ? 'Restaurer' : 'Archiver'} ${t.shortName}`} onClick={() => { if (t.archived) transact(s => saveTemplate(s, { ...t, archived: false }, false)); else { setArchive(t); setReplaceFuture(false) } }}><Archive /></button></footer></Card>)}
    {!archived && <Link className="create-template-card" to={dateHref('/seances/nouvelle')}><span><Plus /></span><strong>Créer une séance</strong><p>Partir de zéro ou dupliquer un modèle</p></Link>}</div>
    {!templates.length && <InfoBanner>Aucun modèle ne correspond à ta recherche.</InfoBanner>}
    <Card className="upcoming-sessions"><h2>À venir</h2><div>{[1, 2, 3].map(n => { const date = addDays(selectedDate, n); const t = state.templates.find(t => t.id === state.schedule[date]); return <Link key={date} to={`/seances/planning?week=${date}`}><span>{formatShortDate(date)}</span><DayIcon type={typeOfTemplate(t)} /><strong>{t?.shortName ?? 'Repos'}</strong></Link> })}<Link className="button button-secondary" to={dateHref('/seances/planning')}><CalendarDays /> Ouvrir le planning</Link></div></Card>
    {archive && <Modal title={`Archiver ${archive.shortName} ?`} onClose={() => setArchive(null)}><p>L’historique restera intact. Le modèle sera masqué dans les nouveaux choix.</p><p>{future.length} journées futures ou non démarrées utilisent ce modèle.</p><label className="check-label"><input type="checkbox" checked={replaceFuture} onChange={e => setReplaceFuture(e.target.checked)} /> Passer ces journées à repos (ajustements manuels conservés).</label><p>Sans cette option, leurs exercices et leur base restent conservés.</p>{replaceFuture && <PlanningImpact before={state} after={previewSchedule(state, Object.fromEntries(future.map(([d]) => [d, 'rest'])))} dates={future.map(([d]) => d).sort()} />}<div className="session-actions"><Button variant="danger" onClick={() => { if (transact(s => { const next = replaceFuture ? previewSchedule(s, Object.fromEntries(future.map(([d]) => [d, 'rest']))) : s; return saveTemplate(next, { ...archive, archived: true }, false) })) { setArchive(null); setMessage('Modèle archivé. Historique conservé.') } }}>Confirmer l’archivage</Button><Button variant="secondary" onClick={() => setArchive(null)}>Annuler</Button></div></Modal>}
  </SessionsShell>
}
