import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, CalendarDays, ChevronLeft, ChevronRight, LockKeyhole, Repeat2, Save } from 'lucide-react'
import { useApp } from '../state/AppContext'
import { useJournalDate } from '../hooks/useJournalDate'
import { addDays, formatCompactDate, formatLongDate, formatShortDate, isIsoDate, isoDate, startOfWeek, weekDates } from '../domain/dates'
import { calculateDay } from '../domain/calculations'
import { previewSchedule, scheduleDifference, templateForDate, trainingLog, typeOfTemplate } from '../domain/training'
import { formatNumber } from '../domain/format'
import { Button, Card, Field, InfoBanner, PageHeader } from '../components/ui'
import { ExplainedLabel } from '../components/HelpTooltip'
import { DayIcon, DraftGuard, Modal, SessionsShell } from '../components/sessions/SessionsUI'

export function SessionsPlanningPage() {
  const { state, transact } = useApp()
  const { selectedDate } = useJournalDate()
  const [params, setParams] = useSearchParams()
  const requested = params.get('week')
  const week = startOfWeek(isIsoDate(requested) ? requested : selectedDate)
  const dates = weekDates(week)
  const [changes, setChanges] = useState<Record<string, string>>({})
  const [baseline, setBaseline] = useState(state.revision)
  const [replaceManual, setReplaceManual] = useState(false)
  const [unlocked, setUnlocked] = useState<string[]>([])
  const [correction, setCorrection] = useState<string | null>(null)
  const [activeDate, setActiveDate] = useState(selectedDate)
  const [chooseDate, setChooseDate] = useState<string | null>(null)
  const [choice, setChoice] = useState(params.get('template') ?? 'rest')
  const [move, setMove] = useState<{ from: string; to: string } | null>(null)
  const [repeat, setRepeat] = useState(false)
  const [sourceWeek, setSourceWeek] = useState(week)
  const [destinationWeek, setDestinationWeek] = useState(addDays(week, 7))
  const [message, setMessage] = useState('')
  const [confirm, setConfirm] = useState(false)
  const next = previewSchedule(state, changes, replaceManual)
  const templates = state.templates.filter(t => !t.archived)
  const canEdit = (date: string) => date >= isoDate() || unlocked.includes(date)
  function stage(date: string, id: string) {
    if (!canEdit(date)) { setCorrection(date); return }
    if (!Object.keys(changes).length) setBaseline(state.revision)
    setChanges(current => { const result = { ...current, [date]: id }; if ((state.schedule[date] ?? 'rest') === id) delete result[date]; return result })
    setMessage('')
  }
  function navigateWeek(date: string) { const nextParams = new URLSearchParams(params); nextParams.set('week', startOfWeek(date)); setParams(nextParams); setActiveDate(date) }
  function moved(swap: boolean) { if (!move) return; stage(move.to, next.schedule[move.from] ?? 'rest'); stage(move.from, swap ? next.schedule[move.to] ?? 'rest' : 'rest'); setMove(null) }
  const chosenDate = dates.includes(activeDate) ? activeDate : dates[0]
  return <SessionsShell><DraftGuard dirty={Object.keys(changes).length > 0} /><PageHeader title="Planifier mes séances" description="Prépare ta semaine et vérifie l’effet sur tes cibles." action={<><Button variant="secondary" onClick={() => setRepeat(true)}><Repeat2 /> Répéter la semaine</Button><Button disabled={!Object.keys(changes).length} onClick={() => setConfirm(true)}><Save /> Enregistrer le planning</Button></>} />
    {message && <InfoBanner tone="success">{message}</InfoBanner>}
    <div className="planning-toolbar"><button className="icon-button" aria-label="Semaine précédente" onClick={() => navigateWeek(addDays(week, -7))}><ChevronLeft /></button><label><CalendarDays /><span>{formatCompactDate(dates[0])} – {formatCompactDate(dates[6])}</span><input aria-label="Choisir la semaine du planning" type="date" value={week} onChange={e => isIsoDate(e.target.value) && navigateWeek(e.target.value)} /></label><button className="icon-button" aria-label="Semaine suivante" onClick={() => navigateWeek(addDays(week, 7))}><ChevronRight /></button><p>Glisse une séance ou choisis-la dans une journée.</p></div>
    <Card className="template-palette">{[...templates.map(t => ({ id: t.id, label: t.shortName, type: typeOfTemplate(t) })), { id: 'rest', label: 'Repos', type: 'rest' as const }].map(t => <button key={t.id} className={`day-pill type-${t.type}`} draggable onDragStart={e => e.dataTransfer.setData('text/plain', JSON.stringify({ templateId: t.id }))} onClick={() => { setChoice(t.id); setChooseDate(chosenDate) }}><DayIcon type={t.type} />{t.label}</button>)}</Card>
    <div className="mobile-planning-dates">{dates.map(date => <button className={chosenDate === date ? 'selected' : ''} key={date} onClick={() => setActiveDate(date)}>{formatShortDate(date)}</button>)}</div>
    <div className="planning-week-grid">{dates.map(date => {
      const template = templateForDate(next, date)
      const log = trainingLog(next, date)
      const calc = calculateDay(log, state.profile, state.settings)
      const type = next.plannedSessions?.[date]?.dayType ?? typeOfTemplate(template)
      return <Card className={`planning-day ${chosenDate === date ? 'mobile-active' : ''} ${date === selectedDate ? 'current-day' : ''}`} key={date} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (!canEdit(date)) { setCorrection(date); return } try { const payload = JSON.parse(e.dataTransfer.getData('text/plain')); if (payload.from && payload.from !== date) { if (!canEdit(payload.from)) return; setMove({ from: payload.from, to: date }) } else if (payload.templateId) stage(date, payload.templateId) } catch { /* Foreign drag payload is ignored. */ } }}>
        <h2>{formatShortDate(date)}</h2><button className={`day-pill type-${type}`} draggable={canEdit(date)} onDragStart={e => e.dataTransfer.setData('text/plain', JSON.stringify({ from: date }))} onClick={() => { if (!canEdit(date)) setCorrection(date); else { setChooseDate(date); setChoice(next.schedule[date] ?? 'rest') } }}>{template?.shortName ?? (next.schedule[date] && next.schedule[date] !== 'rest' ? 'Modèle introuvable' : 'Repos')}</button>
        <span className="planning-status">{!canEdit(date) && <LockKeyhole />}{log.training?.status === 'completed' ? 'Réalisée' : log.training ? 'En cours' : date < isoDate() ? 'Passée' : 'Planifiée'}</span><p>{template ? `${template.exercises.length} exercices` : '—'}</p><small>Base planifiée</small><strong className="planning-calories">{formatNumber(calc.plannedBaseCalories)} <small>kcal</small></strong><small>{formatNumber(calc.targetSteps)} pas cibles</small>
        <label className="planning-select"><span className="sr-only">Séance du {date}</span><select aria-label={`Séance du ${date}`} disabled={!canEdit(date)} value={next.schedule[date] ?? 'rest'} onChange={e => stage(date, e.target.value)}><option value="rest">Repos</option>{templates.map(t => <option key={t.id} value={t.id}>{t.shortName}</option>)}{template && !templates.some(t => t.id === template.id) && <option value={template.id}>{template.shortName} (archivé, déjà prévu)</option>}</select></label>
        {template && <Link to={`/seances/${template.id}?date=${date <= isoDate() ? date : selectedDate}`}>Voir les exercices</Link>}{date <= isoDate() && log.training && <Link to={`/seances/journal?date=${date}`}>Voir le journal réel</Link>}{!canEdit(date) && <button className="text-button" onClick={() => setCorrection(date)}>Corriger cette journée</button>}
        <div className="mobile-day-impact"><span>Ajustement d’activité : {formatNumber(calc.appliedAdjustmentKcal)} kcal</span><strong>Cible recalculée : {formatNumber(calc.adjustedCalorieTarget)} kcal</strong></div>
      </Card>
    })}</div>
    <div className="planning-bottom"><Card className="session-panel"><h2><ExplainedLabel help="Compare les cibles complètes, recalculées avec les pas et le cardio déjà saisis. Une variation de base n’est pas forcément la variation finale.">Aperçu du changement</ExplainedLabel></h2>
      {!Object.keys(changes).length ? <p>Aucun changement en attente. Choisis une séance pour voir l’avant / après.</p> : <><div className="planning-preview">{Object.keys(changes).sort().map(date => {
        const old = calculateDay(trainingLog(state, date), state.profile, state.settings)
        const after = calculateDay(trainingLog(next, date), next.profile, next.settings)
        return <div key={date}><strong>{formatLongDate(date)}</strong><span>{templateForDate(state, date)?.shortName ?? 'Repos'} <ArrowRight /> {templateForDate(next, date)?.shortName ?? 'Repos'}</span><span>Base : {formatNumber(old.plannedBaseCalories)} → {formatNumber(after.plannedBaseCalories)} kcal</span><span>Pas : {formatNumber(old.targetSteps)} → {formatNumber(after.targetSteps)}</span><b>Cible finale : {formatNumber(old.adjustedCalorieTarget)} → {formatNumber(after.adjustedCalorieTarget)} kcal</b></div>
      })}</div><p className="preview-total">Variation totale des cibles : {formatNumber(Object.keys(changes).reduce((sum, date) => sum + scheduleDifference(state, next, date), 0))} kcal</p><label className="check-label"><input type="checkbox" checked={replaceManual} onChange={e => setReplaceManual(e.target.checked)} /> Remplacer aussi les personnalisations de base et de pas par les valeurs du type.</label><p>Par défaut, les écarts manuels et répartitions de marge sont conservés.</p><Button variant="secondary" onClick={() => { setChanges({}); setReplaceManual(false) }}>Annuler les changements</Button></>}
      <InfoBanner>Le cardio, la nutrition et les pesées restent conservés. L’aperçu n’est pas encore enregistré.</InfoBanner>
    </Card><Card className="session-panel"><h2><ExplainedLabel help="La restitution, les plafonds et les arrondis sont ceux de tes paramètres actuels.">Comment la cible est calculée</ExplainedLabel></h2><div className="session-formula"><span>Base du type de journée</span><b>+</b><span>Ajustement d’activité</span><b>=</b><span>Cible du jour</span></div><p>La musculation prévue est déjà incluse dans la base. Elle n’est pas ajoutée une seconde fois.</p><p>Une séance non terminée n’est pas automatiquement un repos. Pour déclarer une séance non réalisée, choisis explicitement « Repos » puis valide l’aperçu.</p></Card></div>
    <InfoBanner>Historique protégé : les exercices et performances passés ne sont jamais réécrits par le planning.</InfoBanner>
    {correction && <Modal title="Corriger cette journée" onClose={() => setCorrection(null)}><p>Tu vas autoriser la correction du planning du {formatLongDate(correction)}. La séance réellement enregistrée, les repas et les activités resteront inchangés. Les cibles seront recalculées seulement après validation du planning.</p><Button onClick={() => { setUnlocked([...unlocked, correction]); setCorrection(null) }}>Autoriser la correction</Button><Button variant="secondary" onClick={() => setCorrection(null)}>Annuler</Button></Modal>}
    {chooseDate && <Modal title="Choisir une séance" drawer onClose={() => setChooseDate(null)}><p>Pour le {formatLongDate(chooseDate)}. Les activités saisies seront conservées.</p><div className="planning-choices">{[{ id: 'rest', name: 'Repos', dayType: 'rest' as const }, ...templates].map(t => <label key={t.id}><span>{t.name}<small>{formatNumber(state.settings.dayTypePlans[t.dayType ?? 'rest'].calories)} kcal de base</small></span><input type="radio" name="day-choice" checked={choice === t.id} onChange={() => setChoice(t.id)} /></label>)}</div><Button onClick={() => { stage(chooseDate, choice); setChooseDate(null) }}>Appliquer à ce jour (aperçu)</Button><Button variant="secondary" onClick={() => setChooseDate(null)}>Annuler</Button></Modal>}
    {move && <Modal title="Déplacer cette séance" onClose={() => setMove(null)}><p>De {formatShortDate(move.from)} vers {formatShortDate(move.to)}. Choisis le traitement de la séance déjà prévue à destination.</p><Button onClick={() => moved(true)}>Échanger les deux jours</Button><Button variant="secondary" onClick={() => moved(false)}>Remplacer la destination et mettre la source à repos</Button><Button variant="secondary" onClick={() => setMove(null)}>Annuler</Button></Modal>}
    {repeat && <Modal title="Répéter la semaine" onClose={() => setRepeat(false)}><Field label="Semaine source" type="date" value={sourceWeek} onChange={e => setSourceWeek(e.target.value)} /><Field label="Semaine destination" type="date" value={destinationWeek} min={isoDate()} onChange={e => setDestinationWeek(e.target.value)} /><p>Seules les séances prévues sont copiées. Aucune performance, calorie consommée, activité ni pesée. Les jours passés de la semaine destination sont exclus.</p><Button disabled={!isIsoDate(sourceWeek) || !isIsoDate(destinationWeek) || destinationWeek < isoDate()} onClick={() => { if (!Object.keys(changes).length) setBaseline(state.revision); const copy = Object.fromEntries(weekDates(destinationWeek).filter(d => d >= isoDate()).map(d => [d, state.schedule[addDays(startOfWeek(sourceWeek), weekDates(destinationWeek).indexOf(d))] ?? 'rest'])); setChanges({ ...changes, ...copy }); setRepeat(false) }}>Prévisualiser la copie</Button></Modal>}
    {confirm && <Modal title="Enregistrer le planning ?" onClose={() => setConfirm(false)}><p>{Object.keys(changes).length} journées seront modifiées selon l’aperçu. {replaceManual ? 'Les bases et pas personnalisés seront remplacés.' : 'Les ajustements manuels seront conservés.'} Aucun historique réel ne sera effacé.</p><Button onClick={() => { if (transact(s => { if (s.revision !== baseline) throw new Error('Le journal a changé depuis le début de cet aperçu. Annule les changements et recommence avec les dernières données.'); return previewSchedule(s, changes, replaceManual) })) { setChanges({}); setConfirm(false); setReplaceManual(false); setMessage('Planning enregistré. Toutes les cibles ont été recalculées.') } }}>Confirmer le planning</Button><Button variant="secondary" onClick={() => setConfirm(false)}>Revenir à l’aperçu</Button></Modal>}
  </SessionsShell>
}
