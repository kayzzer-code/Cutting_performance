import { useEffect, useState, type CSSProperties, type FormEvent, type KeyboardEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Activity, BarChart3, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Dumbbell, Flame, Pencil, Pause, Play, Plus, Shuffle, TimerReset, Trash2 } from 'lucide-react'
import { useApp } from '../state/AppContext'
import { useCloudSync } from '../state/CloudSyncContext'
import { useJournalDate } from '../hooks/useJournalDate'
import { addDays, formatLongDate, isoDate, startOfWeek } from '../domain/dates'
import { blankSet, changeSession, conventionLabels, elapsed, exerciseHistory, newLine, replaceExercise, startSession, targetText, templateForDate, trainingLog, uid, validSet, workSets } from '../domain/training'
import { aggregateMuscleVolume, aggregateMusclesForSessions, completedSessions, setTonnage, summarizeSession, summarizeSessions } from '../domain/trainingAnalytics'
import { muscleMeta } from '../domain/exerciseCatalogue'
import type { ExerciseDefinition, ExerciseLog, LoadConvention, SetLog, TrainingSession } from '../domain/types'
import { formatNumber } from '../domain/format'
import { Button, Card, Field, InfoBanner, PageHeader, ProgressBar, SelectField } from '../components/ui'
import { ExplainedLabel } from '../components/HelpTooltip'
import { ExercisePicker, Modal, SessionsShell } from '../components/sessions/SessionsUI'

const duration = (ms: number) => {
  const hours = Math.floor(ms / 3_600_000)
  const minutes = Math.floor(ms / 60_000 % 60).toString().padStart(2, '0')
  const seconds = Math.floor(ms / 1000 % 60).toString().padStart(2, '0')
  return hours ? `${hours}:${minutes}:${seconds}` : `${minutes}:${seconds}`
}
const percentDelta = (value: number | null, previous: number | null) => previous && value !== null ? Math.round((value - previous) / previous * 100) : null

export function SessionJournalPage() {
  const { state, transact, storageStatus } = useApp()
  const cloud = useCloudSync()
  const { selectedDate: date } = useJournalDate()
  const [params] = useSearchParams()
  const [now, setNow] = useState(() => Date.now())
  const [active, setActive] = useState(params.get('lineId') ?? '')
  const [correcting, setCorrecting] = useState(false)
  const [unlock, setUnlock] = useState(false)
  const [finish, setFinish] = useState(false)
  const [replacing, setReplacing] = useState<string | null>(null)
  const [global, setGlobal] = useState(false)
  const [globalChoice, setGlobalChoice] = useState<ExerciseDefinition | null>(null)
  const [addingExercise, setAddingExercise] = useState(false)
  const [editingExercise, setEditingExercise] = useState<ExerciseLog | null>(null)
  const [deletingExercise, setDeletingExercise] = useState<ExerciseLog | null>(null)
  const [deleting, setDeleting] = useState<{ line: string; set: SetLog; index: number } | null>(null)
  const [undo, setUndo] = useState<typeof deleting>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const session = state.logs[date]?.training
  const template = templateForDate(state, date)
  const future = (params.get('date') ?? date) > isoDate()
  const readOnly = future || ((date < isoDate() || session?.status === 'completed') && !correcting)
  const lines = session?.exercises ?? []
  const currentLine = lines.find(exercise => exercise.id === active) ?? lines.find(exercise => !exercise.replacedById && exercise.sets.some(set => !set.completed)) ?? lines[0]
  const currentIndex = Math.max(0, lines.findIndex(exercise => exercise.id === currentLine?.id))
  const totalSets = lines.reduce((sum, exercise) => sum + exercise.sets.length, 0)
  const completedSets = lines.reduce((sum, exercise) => sum + exercise.sets.filter(set => set.completed).length, 0)
  const liveSummary = session ? summarizeSession(session, now) : null
  const liveMuscles = aggregateMuscleVolume(lines)
  const restMs = Math.max(0, session?.restUntil ? session.restUntil - now : session?.restRemainingMs ?? 0)
  const weekStart = startOfWeek(date)
  const weekEnd = addDays(weekStart, 6)
  const previousStart = addDays(weekStart, -7)
  const previousEnd = addDays(weekStart, -1)
  const completedThisWeek = completedSessions(state, weekStart, weekEnd)
  const displayThisWeek: TrainingSession[] = session && session.status !== 'completed' && date >= weekStart && date <= weekEnd ? [...completedThisWeek, session] : completedThisWeek
  const weekSummary = summarizeSessions(displayThisWeek)
  const previousSummary = summarizeSessions(completedSessions(state, previousStart, previousEnd))
  const weekMuscles = aggregateMusclesForSessions(displayThisWeek)
  const weekTonnageDelta = percentDelta(weekSummary.tonnage, previousSummary.tonnage)
  const dailyTonnage = Array.from({ length: 7 }, (_, index) => {
    const day = addDays(weekStart, index)
    const daySession = displayThisWeek.find(item => item.date === day)
    return { day, value: daySession ? summarizeSession(daySession, now).tonnage : 0 }
  })
  const chartMax = Math.max(1, ...dailyTonnage.map(item => item.value ?? 0))

  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer) }, [])
  useEffect(() => { if (params.get('lineId')) document.getElementById(`exercise-${params.get('lineId')}`)?.scrollIntoView({ block: 'center' }) }, [params, session?.id])

  function update(updater: (value: TrainingSession) => TrainingSession) { return transact(current => changeSession(current, date, updater)) }
  function updateSet(line: ExerciseLog, set: SetLog, patch: Partial<SetLog>) {
    if (readOnly) return
    const next = { ...set, ...patch }
    const isValidation = patch.completed === true
    if (isValidation && !validSet(next, line.convention)) {
      setError('Série non validée : renseigne une charge et des répétitions valides (RIR de 0 à 10, facultatif).')
      return
    }
    setError('')
    const setIndex = line.sets.findIndex(item => item.id === set.id)
    const nextIncomplete = line.sets.slice(setIndex + 1).find(item => !item.completed)
    const success = update(current => ({
      ...current,
      exercises: current.exercises.map(exercise => exercise.id === line.id ? {
        ...exercise,
        sets: exercise.sets.map(item => {
          if (item.id === set.id) return next
          if (isValidation && nextIncomplete?.id === item.id) return { ...item, loadKg: item.loadKg ?? next.loadKg, rir: item.rir ?? next.rir }
          return item
        }),
      } : exercise),
      ...(isValidation && current.autoRest !== false && line.restSeconds ? { restUntil: Date.now() + line.restSeconds * 1000, restRemainingMs: undefined } : {}),
    }))
    if (!success || !isValidation) return
    setTimeout(() => {
      if (nextIncomplete) document.querySelector<HTMLInputElement>(`[data-reps-set="${nextIncomplete.id}"]`)?.focus()
      else {
        const nextLine = lines.slice(currentIndex + 1).find(exercise => !exercise.replacedById && exercise.sets.some(item => !item.completed))
        if (nextLine) setActive(nextLine.id)
      }
    })
  }
  function handleSetEnter(event: KeyboardEvent<HTMLInputElement>, line: ExerciseLog, set: SetLog) {
    if (event.key !== 'Enter' || set.completed) return
    event.preventDefault()
    updateSet(line, set, { completed: true })
  }
  function removeSet(item: NonNullable<typeof deleting>) {
    if (update(current => ({ ...current, exercises: current.exercises.map(exercise => {
      if (exercise.id !== item.line) return exercise
      const sets = exercise.sets.filter(set => set.id !== item.set.id)
      return { ...exercise, sets, setCount: sets.length }
    }) }))) { setUndo(item); setDeleting(null) }
  }
  function complete() {
    const timestamp = Date.now()
    const didSave = transact(current => {
      const log = trainingLog(current, date)
      const currentSession = log.training
      if (!currentSession) return current
      const completed: TrainingSession = { ...currentSession, status: 'completed', completedAt: timestamp, elapsedMs: elapsed(currentSession, timestamp), runningSince: undefined, restUntil: undefined, restRemainingMs: undefined }
      const plannedDayType = current.plannedSessions?.[date]?.dayType ?? 'rest'
      const dayType = current.templates.find(item => item.id === completed.templateId)?.dayType ?? current.plannedSessions?.[date]?.template?.dayType ?? (plannedDayType === 'rest' ? 'upper' : plannedDayType)
      const strengthActivity = {
        performed: true as const, plannedDayType, dayType, templateId: completed.templateId, templateName: completed.name,
        durationMin: Math.round((completed.elapsedMs ?? 0) / 60_000),
        exerciseCount: completed.exercises.filter(exercise => !exercise.replacedById && workSets(exercise).length > 0).length,
        workingSetCount: completed.exercises.reduce((sum, exercise) => sum + workSets(exercise).length, 0),
        source: 'journal' as const,
      }
      return { ...current, logs: { ...current.logs, [date]: { ...log, training: completed, strengthActivity } } }
    })
    if (didSave) { setFinish(false); setCorrecting(false); setMessage('Séance terminée et enregistrée. Les séries partielles sont conservées.') }
  }
  function applyReplacement(definition: ExerciseDefinition, model: boolean) {
    if (replacing && transact(current => replaceExercise(current, date, replacing, definition, model))) { setReplacing(null); setGlobalChoice(null); setGlobal(false); setMessage('Exercice remplacé. Les séries originales validées sont conservées.') }
  }
  function addOccurrenceExercise(definition: ExerciseDefinition) {
    const prescription = newLine(definition)
    const exercise: ExerciseLog = { ...prescription, id: uid('exercise-log'), sets: Array.from({ length: prescription.setCount ?? 3 }, blankSet) }
    if (update(current => ({ ...current, exercises: [...current.exercises, exercise] }))) {
      setAddingExercise(false)
      setActive(exercise.id)
      setMessage(`${definition.name} a été ajouté à cette séance uniquement.`)
    }
  }
  function saveOccurrenceExercise(next: ExerciseLog) {
    if (update(current => ({ ...current, exercises: current.exercises.map(exercise => exercise.id === next.id ? next : exercise) }))) {
      setEditingExercise(null)
      setMessage('Les paramètres de cet exercice ont été modifiés pour cette séance uniquement.')
    }
  }
  function removeOccurrenceExercise(line: ExerciseLog) {
    if (update(current => ({
      ...current,
      exercises: line.replacesId
        ? current.exercises.filter(exercise => exercise.id !== line.id).map(exercise => exercise.id === line.replacesId ? { ...exercise, replacedById: undefined, sets: exercise.sets.length ? exercise.sets : Array.from({ length: exercise.setCount ?? 3 }, blankSet) } : exercise)
        : current.exercises.filter(exercise => exercise.id !== line.id),
    }))) {
      setDeletingExercise(null)
      setActive('')
      setMessage(line.replacesId ? 'Le remplacement a été annulé et l’exercice original restauré.' : 'Exercice supprimé de cette séance uniquement.')
    }
  }
  return <SessionsShell>
    <Link className="back-link" to={`/seances?date=${date}`}>‹ Mes séances</Link>
    <PageHeader title={session?.name ?? template?.name ?? 'Jour de repos'} description={`${formatLongDate(date)} · ${session?.status === 'completed' ? 'Séance terminée' : session ? 'Séance en cours' : 'Séance prévue'}`} action={session ? <>{!readOnly && session.status !== 'completed' && <Button variant="secondary" onClick={() => update(value => value.runningSince ? { ...value, elapsedMs: elapsed(value), runningSince: undefined } : { ...value, runningSince: Date.now() })}>{session.runningSince ? <Pause /> : <Play />}{session.runningSince ? 'Pause' : 'Reprendre'}</Button>}<Button className="journal-finish-header" disabled={session.status === 'completed' || readOnly} onClick={() => completedSets < totalSets ? setFinish(true) : complete()}><CheckCircle2 />{session.status === 'completed' ? 'Séance terminée' : 'Terminer la séance'}</Button></> : undefined} />
    {message && <InfoBanner tone="success">{message}</InfoBanner>}{error && <p className="field-error" role="alert">{error}</p>}
    {future ? <InfoBanner>Planification future en lecture seule : tu peux consulter la séance et ses exercices, mais les performances seront saisissables à partir de cette date.</InfoBanner> : readOnly && <InfoBanner>Lecture seule : historique protégé. <Button variant="secondary" onClick={() => setUnlock(true)}>Corriger cette séance</Button></InfoBanner>}
    <InfoBanner>Épaule gauche : aucune poussée jusqu’à validation médicale · amplitude indolore. Les suggestions du catalogue ne constituent pas une validation médicale.</InfoBanner>
    {!session && <Card className="session-panel session-start-card"><Dumbbell /><div><h2>{template ? 'Prêt pour ta séance ?' : 'Aucune séance prévue'}</h2>{template ? <><p>{template.exercises.length} exercices · {template.exercises.reduce((sum, exercise) => sum + (exercise.setCount ?? 0), 0)} séries prévues. Les champs réels seront vides au démarrage.</p><ol>{template.exercises.map(exercise => <li key={exercise.id}>{exercise.name} — {targetText(exercise)}</li>)}</ol></> : <p>Choisis un modèle dans le planning pour t’entraîner ce jour-là.</p>}<div className="session-actions">{template && <Button disabled={readOnly || !template.exercises.length} onClick={() => { if (transact(current => startSession(current, date, template.id))) setMessage('Séance démarrée. Tu peux saisir tes séries.') }}><Play /> Démarrer la séance</Button>}<Link className="button button-secondary" to={`/seances/planning?week=${date}&date=${date}`}>Modifier le planning</Link></div></div></Card>}
    {session && <>
      <Card className="journal-session-overview"><div className="overview-icon"><Dumbbell /></div><div className="overview-copy"><span className="overview-status">{session.status === 'completed' ? 'Terminée' : session.runningSince ? 'Séance en cours' : 'En pause'}</span><h2>{session.name}</h2><p>{lines.filter(line => !line.replacedById).length} exercices · {totalSets} séries prévues · {duration(liveSummary?.durationMs ?? 0)} actives</p></div><div className="overview-progress"><div><span>Progression</span><strong>{completedSets} / {totalSets} séries</strong></div><ProgressBar value={completedSets} max={totalSets} tone="blue" /></div>{!readOnly && session.status !== 'completed' && <Button className="overview-mobile-pause" variant="secondary" onClick={() => update(value => value.runningSince ? { ...value, elapsedMs: elapsed(value), runningSince: undefined } : { ...value, runningSince: Date.now() })}>{session.runningSince ? <Pause /> : <Play />}{session.runningSince ? 'Pause' : 'Reprendre'}</Button>}</Card>
      <div className="journal-mobile-progress"><span>{lines.length ? `Exercice ${currentIndex + 1} sur ${lines.length}` : 'Aucun exercice dans cette séance'}</span><ProgressBar value={completedSets} max={totalSets} /></div>
      <div className="journal-workspace">
        <main className="journal-main-column"><div className="journal-exercises">{lines.map((line, index) => {
          const prior = exerciseHistory(state, line.exerciseId ?? '', line.equipmentId ?? '', '0000-01-01', date).filter(history => history.date < date).at(-1)
          const nextIncomplete = line.sets.find(set => !set.completed)
          const primaryMuscle = line.muscleContributions?.find(item => item.role === 'primary')
          return <Card key={line.id} id={`exercise-${line.id}`} className={`journal-exercise ${currentLine?.id === line.id ? 'mobile-active' : ''} ${params.get('lineId') === line.id ? 'highlight-exercise' : ''}`}>
            <div className="journal-exercise-heading"><span className="exercise-index">{index + 1}</span><div className="exercise-title-block"><div className="exercise-title-line"><h2>{line.name}</h2>{primaryMuscle && <span className="muscle-tag role-primary" style={{ '--muscle-color': muscleMeta(primaryMuscle.muscleId).color } as CSSProperties}>{muscleMeta(primaryMuscle.muscleId).shortLabel}</span>}</div><p>{targetText(line)}{line.targetRir !== undefined ? ` · RIR ${line.targetRir}` : ''}</p><small>{line.equipmentId === 'legacy-unspecified' ? 'Matériel historique non précisé' : line.equipmentId} · {conventionLabels[line.convention ?? 'unknown']}</small><p className="last-performance">{prior ? `Dernière fois : ${prior.best.loadKg ?? 'PDC'} kg × ${prior.best.reps}` : 'Première séance enregistrée'}</p>{line.replacesId && <span className="day-pill">Remplacement ponctuel</span>}{line.replacedById && <span className="day-pill">Original conservé — remplacé</span>}</div><div className="exercise-controls"><button className="icon-button" aria-label={`Afficher les séries de ${line.name}`} aria-expanded={currentLine?.id === line.id} onClick={() => setActive(line.id)}><ChevronDown /></button>{!readOnly && !line.replacedById && <><Button className="desktop-add-set" variant="secondary" aria-label="Ajouter une série" onClick={() => update(value => ({ ...value, exercises: value.exercises.map(exercise => exercise.id === line.id ? { ...exercise, sets: [...exercise.sets, blankSet()], setCount: exercise.sets.length + 1 } : exercise) }))}><Plus /><span>Ajouter une série</span></Button><Button variant="ghost" aria-label={`Modifier ${line.name}`} onClick={() => setEditingExercise(line)}><Pencil /></Button><Button variant="ghost" aria-label={`Remplacer ${line.name}`} onClick={() => { setReplacing(line.id); setGlobal(false) }}><Shuffle /></Button><Button variant="ghost" aria-label={`Supprimer ${line.name}`} onClick={() => setDeletingExercise(line)}><Trash2 /></Button></>}</div></div>
            {line.note && <p className="session-hint">{line.note}</p>}
            <div className="set-table" role="group" aria-label={`Séries de ${line.name}`}><div className="set-table-heading"><span>Série</span><span>Charge</span><span>Reps</span><ExplainedLabel help="Répétitions en réserve, facultatif. 0 signifie aucune répétition supplémentaire possible.">RIR</ExplainedLabel><span>Volume</span><span>OK</span><span /></div>{line.sets.map((set, setIndex) => {
              const tonnage = set.completed && set.kind !== 'warmup' ? setTonnage(set.loadKg, set.reps, line.convention) : null
              return <div className={`set-row ${set.completed ? 'validated' : ''}`} key={set.id}><span><span>{setIndex + 1}</span><select aria-label={`Type série ${setIndex + 1} ${line.name}`} disabled={readOnly} value={set.kind ?? 'work'} onChange={event => updateSet(line, set, { kind: event.target.value as SetLog['kind'] })}><option value="work">Travail</option><option value="warmup">Échauff.</option></select></span><input aria-label={`Charge série ${setIndex + 1} ${line.name}`} inputMode="decimal" type="number" min={0} max={2000} step="any" placeholder="kg" disabled={readOnly} value={set.loadKg ?? ''} onKeyDown={event => handleSetEnter(event, line, set)} onChange={event => updateSet(line, set, { loadKg: event.target.value === '' ? undefined : +event.target.value })} /><input data-reps-set={set.id} aria-label={`Répétitions série ${setIndex + 1} ${line.name}`} inputMode="numeric" type="number" min={1} max={1000} placeholder="reps" disabled={readOnly} value={set.reps ?? ''} onKeyDown={event => handleSetEnter(event, line, set)} onChange={event => updateSet(line, set, { reps: event.target.value === '' ? undefined : +event.target.value })} /><input aria-label={`RIR série ${setIndex + 1} ${line.name}`} inputMode="numeric" type="number" min={0} max={10} placeholder="—" disabled={readOnly} value={set.rir ?? ''} onKeyDown={event => handleSetEnter(event, line, set)} onChange={event => updateSet(line, set, { rir: event.target.value === '' ? undefined : +event.target.value })} /><output className="set-volume" aria-label={`Volume série ${setIndex + 1}`}>{tonnage === null ? '—' : `${formatNumber(tonnage)} kg`}</output><button className={`validate-set ${set.completed ? 'checked' : ''}`} aria-label={`${set.completed ? 'Dévalider' : 'Valider'} série ${setIndex + 1} ${line.name}`} aria-pressed={set.completed} disabled={readOnly} onClick={() => updateSet(line, set, { completed: !set.completed })}><Check /></button><button className="delete-set" aria-label={`Retirer série ${setIndex + 1} ${line.name}`} disabled={readOnly} onClick={() => { const item = { line: line.id, set, index: setIndex }; if (set.completed) setDeleting(item); else removeSet(item) }}><Trash2 /></button></div>
            })}</div>
            {!line.sets.length && <p>Aucune série enregistrée pour cet exercice original.</p>}
            {!readOnly && !line.replacedById && nextIncomplete && <Button className="mobile-validate-set" onClick={() => updateSet(line, nextIncomplete, { completed: true })}><Check /> Valider la série {line.sets.indexOf(nextIncomplete) + 1}</Button>}
            {!readOnly && !line.replacedById && <div className="mobile-exercise-actions"><Button variant="secondary" onClick={() => setEditingExercise(line)}><Pencil /> Modifier l’exercice</Button><Button variant="secondary" onClick={() => { setReplacing(line.id); setGlobal(false) }}><Shuffle /> Remplacer l’exercice</Button><Button variant="secondary" onClick={() => update(value => ({ ...value, exercises: value.exercises.map(exercise => exercise.id === line.id ? { ...exercise, sets: [...exercise.sets, blankSet()], setCount: exercise.sets.length + 1 } : exercise) }))}><Plus /> Ajouter une série</Button><Button variant="danger" onClick={() => setDeletingExercise(line)}><Trash2 /> Supprimer l’exercice</Button></div>}
          </Card>
        })}</div>
          {!readOnly && session.status !== 'completed' && <Button className="add-session-exercise" variant="secondary" onClick={() => setAddingExercise(true)}><Plus /> Ajouter un exercice à cette séance</Button>}
          {undo && <InfoBanner>Série retirée. <Button variant="secondary" onClick={() => { if (update(value => ({ ...value, exercises: value.exercises.map(exercise => { if (exercise.id !== undo.line || exercise.sets.some(set => set.id === undo.set.id)) return exercise; const sets = [...exercise.sets]; sets.splice(undo.index, 0, undo.set); return { ...exercise, sets, setCount: sets.length } }) }))) setUndo(null) }}>Annuler la suppression</Button></InfoBanner>}
          <div className="journal-mobile-nav"><Button variant="secondary" disabled={currentIndex === 0} onClick={() => setActive(lines[currentIndex - 1]?.id)}><ChevronLeft /> Précédent</Button><Button variant="secondary" disabled={currentIndex === lines.length - 1} onClick={() => setActive(lines[currentIndex + 1]?.id)}>Exercice suivant <ChevronRight /></Button></div>
          {!readOnly && session.status !== 'completed' && <RestPanel session={session} restMs={restMs} restSeconds={currentLine?.restSeconds ?? 90} update={update} />}
          {correcting && session.status === 'completed' && <Button onClick={() => { setCorrecting(false); setMessage('Correction conservée dans la séance d’origine.') }}>Terminer la correction</Button>}
          <p className="session-hint">{cloud.status === 'local' ? `${storageStatus} · Données uniquement sur cet appareil.` : cloud.label}</p>
        </main>
        <aside className="journal-live-rail" aria-label="Statistiques en direct">
          <Card className="journal-live-card"><header><div><span className="eyebrow">EN DIRECT</span><h2>Ta séance</h2></div><Activity /></header><div className="journal-kpis"><div><span>Séries</span><strong>{liveSummary?.workingSets ?? 0}</strong></div><div><span>Répétitions</span><strong>{liveSummary?.repetitions ?? 0}</strong></div><div><span>Tonnage</span><strong>{liveSummary?.tonnage === null ? '—' : formatNumber(liveSummary?.tonnage ?? 0)}<small> kg</small></strong></div><div><span>Durée</span><strong>{duration(liveSummary?.durationMs ?? 0)}</strong></div></div></Card>
          <Card className="muscle-volume-card"><header><div><span className="eyebrow">VOLUME MUSCULAIRE</span><h2>Séries effectives</h2></div><Flame /></header><MuscleBars rows={liveMuscles} empty="Valide une série pour voir sa répartition." /></Card>
          <Card className="week-load-card"><header><div><span className="eyebrow">CETTE SEMAINE</span><h2>Charge totale</h2></div><BarChart3 /></header><div className="week-load-total"><strong>{weekSummary.tonnage === null ? '—' : formatNumber(weekSummary.tonnage)} <small>kg</small></strong>{weekTonnageDelta !== null && <span className={weekTonnageDelta >= 0 ? 'positive' : 'negative'}>{weekTonnageDelta > 0 ? '+' : ''}{weekTonnageDelta} % vs sem. préc.</span>}</div><div className="week-bars" aria-label="Tonnage quotidien de la semaine">{dailyTonnage.map((item, index) => <div key={item.day}><span style={{ height: `${Math.max(item.value ? 12 : 2, ((item.value ?? 0) / chartMax) * 100)}%` }} /><small>{['L', 'M', 'M', 'J', 'V', 'S', 'D'][index]}</small></div>)}</div><div className="week-load-kpis"><span><strong>{displayThisWeek.length}</strong> séances</span><span><strong>{weekSummary.workingSets}</strong> séries</span><span><strong>{weekMuscles.length}</strong> muscles</span></div><ExplainedLabel help="Somme charge × répétitions des séries de travail validées. Une charge par haltère n’est jamais doublée. Poids du corps, assistance et convention inconnue restent hors tonnage.">Comment est calculé le tonnage ?</ExplainedLabel></Card>
        </aside>
      </div>
      <div className="journal-finish-mobile"><Button disabled={session.status === 'completed' || readOnly} onClick={() => completedSets < totalSets ? setFinish(true) : complete()}><CheckCircle2 />{session.status === 'completed' ? 'Séance terminée' : 'Terminer la séance'}</Button></div>
    </>}
    {unlock && <Modal title="Corriger l’historique de cette séance ?" onClose={() => setUnlock(false)}><p>Tu modifieras les performances de cette occurrence uniquement. Le modèle et les autres journées restent inchangés. Il ne s’agit pas de recommencer ni d’effacer la séance.</p><Button onClick={() => { setCorrecting(true); setUnlock(false) }}>Autoriser la correction de la séance</Button><Button variant="secondary" onClick={() => setUnlock(false)}>Annuler</Button></Modal>}
    {finish && <Modal title="Terminer une séance partielle ?" onClose={() => setFinish(false)}><p>{completedSets} séries validées sur {totalSets}. Les séries non validées resteront des brouillons et ne compteront pas dans les statistiques.</p><Button onClick={complete}>Terminer en l’état</Button><Button variant="secondary" onClick={() => setFinish(false)}>Continuer la séance</Button></Modal>}
    {replacing && !globalChoice && <ExercisePicker draftKey={`journal-${date}-${replacing}`} title="Remplacer un exercice" onClose={() => setReplacing(null)} onPick={definition => global ? setGlobalChoice(definition) : applyReplacement(definition, false)}><div className="session-replacement-scope"><h3>Appliquer le changement</h3><label className="scope-option"><input type="radio" name="replacement-scope" checked={!global} onChange={() => setGlobal(false)} /><span>Cette séance uniquement<small>Le modèle reste inchangé.</small></span></label><label className="scope-option"><input type="radio" name="replacement-scope" checked={global} onChange={() => setGlobal(true)} /><span>Mettre aussi à jour le modèle<small>Pour les nouvelles planifications uniquement, après confirmation.</small></span></label><InfoBanner>Les séries déjà enregistrées sur l’original seront conservées.</InfoBanner></div></ExercisePicker>}
    {globalChoice && <Modal title="Modifier aussi le modèle global ?" onClose={() => setGlobalChoice(null)}><p>{globalChoice.name} remplacera l’exercice dans cette occurrence et dans les nouvelles planifications du modèle. Les occurrences déjà planifiées ou réalisées ne changent pas.</p><Button onClick={() => applyReplacement(globalChoice, true)}>Confirmer le remplacement global</Button><Button variant="secondary" onClick={() => setGlobalChoice(null)}>Retour</Button></Modal>}
    {addingExercise && <ExercisePicker draftKey={`journal-add-${date}`} title="Ajouter un exercice à cette séance" onClose={() => setAddingExercise(false)} onPick={addOccurrenceExercise}><InfoBanner>L’exercice et ses séries seront ajoutés uniquement au {formatLongDate(date)}. Le modèle {session?.name ?? 'de la séance'} restera inchangé.</InfoBanner></ExercisePicker>}
    {editingExercise && <OccurrenceExerciseModal line={editingExercise} onClose={() => setEditingExercise(null)} onSave={saveOccurrenceExercise} />}
    {deletingExercise && <Modal title="Supprimer cet exercice de la séance ?" onClose={() => setDeletingExercise(null)}><p><strong>{deletingExercise.name}</strong> sera retiré uniquement du journal du {formatLongDate(date)}. Le modèle {session?.name ?? 'de la séance'} et les autres séances ne seront pas modifiés.</p>{deletingExercise.sets.some(set => set.completed) && <InfoBanner tone="warning">Les séries déjà validées sur cet exercice seront également supprimées des statistiques de cette séance.</InfoBanner>}<Button variant="danger" onClick={() => removeOccurrenceExercise(deletingExercise)}>Confirmer la suppression de l’exercice</Button><Button variant="secondary" onClick={() => setDeletingExercise(null)}>Annuler</Button></Modal>}
    {deleting && <Modal title="Retirer cette série validée ?" onClose={() => setDeleting(null)}><p>{deleting.set.loadKg ?? '—'} kg × {deleting.set.reps} répétitions. Tu pourras annuler la suppression tant que ce journal reste ouvert.</p><Button variant="danger" onClick={() => removeSet(deleting)}>Confirmer la suppression</Button><Button variant="secondary" onClick={() => setDeleting(null)}>Annuler</Button></Modal>}
  </SessionsShell>
}

function RestPanel({ session, restMs, restSeconds, update }: { session: TrainingSession; restMs: number; restSeconds: number; update: (updater: (session: TrainingSession) => TrainingSession) => boolean }) {
  return <Card className="session-rest"><TimerReset /><div><span>Temps de repos</span><strong>{duration(restMs)}</strong><small>Prochaine série quand tu es prêt</small></div><Button variant="secondary" onClick={() => update(value => ({ ...value, restUntil: Date.now() + restSeconds * 1000, restRemainingMs: undefined }))}>Démarrer le repos</Button><Button variant="ghost" onClick={() => update(value => value.restUntil ? { ...value, restUntil: Math.max(Date.now(), value.restUntil) + 30_000 } : { ...value, restRemainingMs: (value.restRemainingMs ?? 0) + 30_000 })}>+30 s</Button><Button variant="ghost" aria-label={session.restUntil ? 'Mettre le repos en pause' : 'Reprendre le repos'} onClick={() => update(value => value.restUntil ? { ...value, restRemainingMs: Math.max(0, value.restUntil - Date.now()), restUntil: undefined } : { ...value, restUntil: Date.now() + (value.restRemainingMs ?? 90_000), restRemainingMs: undefined })}>{session.restUntil ? <Pause /> : <Play />}</Button><label className="check-label"><input type="checkbox" checked={session.autoRest ?? true} onChange={event => update(value => ({ ...value, autoRest: event.target.checked }))} /> Repos automatique après validation</label></Card>
}

function MuscleBars({ rows, empty }: { rows: ReturnType<typeof aggregateMuscleVolume>; empty: string }) {
  if (!rows.length) return <p className="muscle-empty">{empty}</p>
  const max = Math.max(...rows.map(row => row.effectiveSets), 1)
  return <div className="muscle-bars">{rows.slice(0, 7).map(row => <details key={row.muscleId}><summary><span>{row.shortLabel}</span><span className="muscle-bar-track"><span style={{ width: `${row.effectiveSets / max * 100}%`, background: row.color }} /></span><strong>{Math.round(row.effectiveSets * 10) / 10}</strong></summary><div>{row.directSets} séries directes · {row.attributedTonnage === null ? 'tonnage indisponible' : `${formatNumber(row.attributedTonnage)} kg attribués`}{row.contributors.map(item => <small key={`${item.exerciseId}-${item.name}`}>{item.name} · {Math.round(item.effectiveSets * 10) / 10} séries</small>)}</div></details>)}</div>
}

function OccurrenceExerciseModal({ line, onClose, onSave }: { line: ExerciseLog; onClose: () => void; onSave: (line: ExerciseLog) => void }) {
  const [name, setName] = useState(line.name)
  const [equipmentId, setEquipmentId] = useState(line.equipmentId ?? '')
  const [convention, setConvention] = useState<LoadConvention>(line.convention ?? 'unknown')
  const [setCount, setSetCount] = useState(line.sets.length)
  const [repsMin, setRepsMin] = useState(line.repsMin ?? 10)
  const [repsMax, setRepsMax] = useState(line.repsMax ?? line.repsMin ?? 15)
  const [targetRir, setTargetRir] = useState<number | ''>(line.targetRir ?? '')
  const [restSeconds, setRestSeconds] = useState(line.restSeconds ?? 90)
  const [note, setNote] = useState(line.note ?? '')
  const [error, setError] = useState('')
  const completedCount = line.sets.filter(set => set.completed).length

  function submit(event: FormEvent) {
    event.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) return setError('Le nom de l’exercice est obligatoire.')
    if (!Number.isInteger(setCount) || setCount < 1 || setCount > 20) return setError('Choisis entre 1 et 20 séries.')
    if (!Number.isInteger(repsMin) || !Number.isInteger(repsMax) || repsMin < 1 || repsMax > 1000 || repsMin > repsMax) return setError('La plage de répétitions doit être valide et comprise entre 1 et 1 000.')
    if (targetRir !== '' && (!Number.isFinite(targetRir) || targetRir < 0 || targetRir > 10)) return setError('Le RIR cible doit être compris entre 0 et 10.')
    if (!Number.isInteger(restSeconds) || restSeconds < 15 || restSeconds > 600) return setError('Le repos doit être compris entre 15 et 600 secondes.')
    if (setCount < completedCount) return setError(`Impossible de descendre sous ${completedCount} séries : elles sont déjà validées. Dévalide-les d’abord si tu veux les retirer.`)

    const sets = [...line.sets]
    for (let index = sets.length - 1; index >= 0 && sets.length > setCount; index -= 1) {
      if (!sets[index].completed) sets.splice(index, 1)
    }
    if (sets.length > setCount) return setError('Les séries validées sont protégées. Dévalide les séries que tu souhaites retirer.')
    while (sets.length < setCount) sets.push(blankSet())
    onSave({
      ...line,
      name: trimmedName,
      equipmentId: equipmentId.trim() || 'legacy-unspecified',
      convention,
      setCount,
      repsMin,
      repsMax,
      targetRir: targetRir === '' ? undefined : targetRir,
      restSeconds,
      note: note.trim() || undefined,
      sets,
    })
  }

  return <Modal title={`Modifier ${line.name}`} onClose={onClose}>
    <form className="occurrence-exercise-form" onSubmit={submit}>
      <p>Ces réglages concernent uniquement cette séance. Les poids et répétitions déjà saisis sont conservés.</p>
      {error && <p className="field-error" role="alert">{error}</p>}
      <Field label="Nom de l’exercice" value={name} onChange={event => setName(event.target.value)} autoFocus />
      <div className="occurrence-exercise-grid two-columns">
        <Field label="Matériel / variante" value={equipmentId} onChange={event => setEquipmentId(event.target.value)} placeholder="machine, haltères…" />
        <SelectField label="Convention de charge" value={convention} onChange={event => setConvention(event.target.value as LoadConvention)}>{Object.entries(conventionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</SelectField>
      </div>
      <div className="occurrence-exercise-grid prescription-columns">
        <Field label="Nombre de séries" type="number" inputMode="numeric" min={1} max={20} value={setCount} onChange={event => setSetCount(Number(event.target.value))} />
        <Field label="Reps min." type="number" inputMode="numeric" min={1} max={1000} value={repsMin} onChange={event => setRepsMin(Number(event.target.value))} />
        <Field label="Reps max." type="number" inputMode="numeric" min={1} max={1000} value={repsMax} onChange={event => setRepsMax(Number(event.target.value))} />
        <Field label="RIR cible" type="number" inputMode="numeric" min={0} max={10} value={targetRir} placeholder="Facultatif" onChange={event => setTargetRir(event.target.value === '' ? '' : Number(event.target.value))} />
      </div>
      <Field label="Repos entre les séries" type="number" inputMode="numeric" min={15} max={600} step={5} suffix="s" value={restSeconds} onChange={event => setRestSeconds(Number(event.target.value))} />
      <Field label="Note pour cette séance" value={note} onChange={event => setNote(event.target.value)} placeholder="Consigne, variante, gêne éventuelle…" />
      <p className="session-hint">{completedCount ? `${completedCount} série${completedCount > 1 ? 's' : ''} déjà validée${completedCount > 1 ? 's' : ''} : elles ne seront jamais retirées automatiquement.` : 'Tu peux augmenter ou réduire le nombre de séries avant de les valider.'}</p>
      <div className="modal-footer horizontal"><Button type="submit">Enregistrer les modifications</Button><Button type="button" variant="secondary" onClick={onClose}>Annuler</Button></div>
    </form>
  </Modal>
}
