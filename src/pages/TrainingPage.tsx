import { useMemo, useState } from 'react'
import { AlertTriangle, Check, CheckCircle2, Clock3, Dumbbell, Plus, TrendingUp } from 'lucide-react'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { addDays, formatLongDate, formatShortDate } from '../domain/dates'
import { useApp } from '../state/AppContext'
import { formatNumber } from '../domain/format'
import { useJournalDate } from '../hooks/useJournalDate'
import { journalLogForDate } from '../domain/journal'
import { ExplainedLabel } from '../components/HelpTooltip'

export function TrainingPage() {
  const { state, startTraining, updateTrainingSet, completeTraining, updateSchedule, updateLog } = useApp()
  const { selectedDate } = useJournalDate()
  const scheduledId = state.schedule[selectedDate] === 'rest' ? 'shoulders-arms' : state.schedule[selectedDate]
  const [templateId, setTemplateId] = useState(scheduledId ?? 'shoulders-arms')
  const template = state.templates.find((item) => item.id === templateId) ?? state.templates[0]
  const training = state.logs[selectedDate]?.training
  const activeTraining = training?.templateId === templateId ? training : undefined
  const exercises = activeTraining ? activeTraining.exercises : template.exercises.map((exercise) => ({ ...exercise, sets: [] }))
  const completedSets = activeTraining?.exercises.reduce((sum, exercise) => sum + exercise.sets.filter((set) => set.completed).length, 0) ?? 0
  const totalSets = activeTraining?.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0) ?? template.exercises.reduce((sum, exercise) => sum + (Number.parseInt(exercise.target, 10) || 3), 0)
  const volume = activeTraining?.exercises.reduce((sum, exercise) => sum + exercise.sets.reduce((setSum, set) => setSum + set.loadKg * set.reps, 0), 0) ?? 0
  const [selectedExercise, setSelectedExercise] = useState(exercises[0]?.id ?? '')
  const [statusMessage, setStatusMessage] = useState('')
  const selected = exercises.find((exercise) => exercise.id === selectedExercise) ?? exercises[0]
  const progressData = useMemo(() => selected?.sets.map((set, index) => ({ label: `Série ${index + 1}`, volume: set.loadKg * set.reps })) ?? [], [selected])
  const planDates = Array.from({ length: 8 }, (_, index) => addDays(selectedDate, index))

  function addExercise() {
    if (!activeTraining || activeTraining.status === 'completed') {
      if (training && training.templateId !== templateId && !window.confirm('Remplacer la séance en cours par ce modèle ?')) return
      startTraining(selectedDate, templateId)
      updateSchedule(selectedDate, templateId)
      setStatusMessage(activeTraining?.status === 'completed' ? 'Nouvelle séance démarrée.' : 'Séance démarrée : tu peux maintenant saisir tes séries.')
      return
    }
    const name = window.prompt('Nom du nouvel exercice')?.trim()
    if (!name) return
    const slug = name.toLocaleLowerCase('fr-FR').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'exercice'
    updateLog(selectedDate, { training: { ...activeTraining, exercises: [...activeTraining.exercises, { id: `custom-${activeTraining.exercises.length + 1}-${slug}`, name, target: '3 × 10–15', sets: [] }] } })
  }

  function finishSession() {
    if (!activeTraining || activeTraining.status !== 'in-progress') return
    completeTraining(selectedDate)
    setStatusMessage('Séance terminée et enregistrée dans ton journal.')
  }

  return (
    <div className="reference-page training-reference">
      <header className="reference-topbar page-title-topbar training-header"><div className="title-stack"><h1><ExplainedLabel help={`Tu dois réaliser ta séance ${template.shortName} de musculation pour la date sélectionnée. Le journal conserve les charges, répétitions et séries validées.`} placement="left">Séance {template.shortName}</ExplainedLabel></h1><p>{formatLongDate(selectedDate)} <b>•</b> Hypertrophie <b>•</b> 1 à 3 RIR</p></div><div className="training-tabs">{['upper-a', 'lower-b', 'shoulders-arms'].map((id) => { const item = state.templates.find((candidate) => candidate.id === id); return item ? <button key={id} className={templateId === id ? 'active' : ''} onClick={() => { setTemplateId(id); setSelectedExercise(state.templates.find((candidate) => candidate.id === id)?.exercises[0]?.id ?? '') }}>{item.shortName}</button> : null })}</div></header>
      <div className="reference-body training-body">
        {statusMessage && <div className="save-toast training-toast">{statusMessage}</div>}
        <section className="training-kpis-reference">
          <TrainingKpi icon={<Clock3 />} label="Statut" value={activeTraining?.status === 'completed' ? 'Terminée' : activeTraining ? 'En cours' : '—'} help="Indique si la séance n’a pas encore commencé, est en cours de saisie ou a été terminée." placement="left" />
          <TrainingKpi icon={<Dumbbell />} label="Volume" value={formatNumber(volume)} unit="kg" tone="teal" help="Somme de charge × répétitions pour toutes les séries enregistrées dans cette séance." />
          <TrainingKpi icon={<CheckCircle2 />} label="Séries réalisées" value={`${completedSets} / ${totalSets}`} tone="teal" help="Nombre de séries validées par rapport au nombre total créé dans le journal." />
          <TrainingKpi icon={<TrendingUp />} label="Progression" value={totalSets ? `${Math.round(completedSets / totalSets * 100)} %` : '—'} tone="teal" help="Pourcentage des séries de la séance actuellement marquées comme terminées." placement="right" />
        </section>

        <div className="shoulder-warning"><AlertTriangle /> Épaule gauche : aucune poussée jusqu’à validation médicale <b>•</b> amplitude indolore</div>

        <section className="training-main-grid">
          <div className="training-journal-card reference-card"><h2><ExplainedLabel help="Zone de saisie des charges et répétitions. Démarre d’abord la séance pour rendre les séries modifiables." placement="left">Journal de séance</ExplainedLabel></h2><div className="training-table-scroll"><table className="training-table-reference"><thead><tr><th>Exercice</th><th><ExplainedLabel help="Nombre de séries et plage de répétitions prévues pour l’exercice.">Prescription</ExplainedLabel></th><th>Série 1</th><th>Série 2</th><th>Série 3</th><th>Série 4</th><th><ExplainedLabel help="Répétitions en réserve : nombre estimé de répétitions encore possibles avant l’échec.">RIR</ExplainedLabel></th><th><ExplainedLabel help="Permet de valider toutes les séries de l’exercice comme réalisées." placement="right">Statut</ExplainedLabel></th></tr></thead><tbody>{exercises.map((exercise) => <tr key={exercise.id}><td>{exercise.name}</td><td>{exercise.target}</td>{Array.from({ length: 4 }, (_, index) => { const set = exercise.sets[index]; return <td key={index}>{set ? <label className="inline-set"><input aria-label={`${exercise.name}, charge série ${index + 1}`} type="number" value={set.loadKg} disabled={activeTraining?.status === 'completed'} onChange={(event) => updateTrainingSet(selectedDate, exercise.id, set.id, { loadKg: Number(event.target.value) })}/><span>kg ×</span><input aria-label={`${exercise.name}, répétitions série ${index + 1}`} type="number" value={set.reps} disabled={activeTraining?.status === 'completed'} onChange={(event) => updateTrainingSet(selectedDate, exercise.id, set.id, { reps: Number(event.target.value) })}/></label> : '—'}</td> })}<td>{exercise.sets[0]?.rir ?? '—'}</td><td>{exercise.sets.length ? <button className={`round-check ${exercise.sets.every((set) => set.completed) ? 'done' : ''}`} disabled={activeTraining?.status === 'completed'} onClick={() => exercise.sets.forEach((set) => updateTrainingSet(selectedDate, exercise.id, set.id, { completed: true }))}><Check /></button> : <span className="pending-label">À faire</span>}</td></tr>)}</tbody></table></div></div>
          <aside className="exercise-progress-card reference-card"><h2><ExplainedLabel help="Visualise le volume de chaque série pour l’exercice sélectionné." placement="right">Progression de l’exercice</ExplainedLabel></h2><select value={selected?.id ?? ''} onChange={(event) => setSelectedExercise(event.target.value)}>{exercises.map((exercise) => <option key={exercise.id} value={exercise.id}>{exercise.name}</option>)}</select><div className="exercise-chart-title"><ExplainedLabel help="Charge multipliée par répétitions pour chacune des séries.">Volume par série (kg)</ExplainedLabel>{volume > 0 && <b>Meilleure séance</b>}</div><div className="exercise-progress-chart">{progressData.length ? <ResponsiveContainer width="100%" height="100%"><LineChart data={progressData}><XAxis dataKey="label" axisLine={false} tickLine={false}/><YAxis axisLine={false} tickLine={false}/><Tooltip/><Line type="monotone" dataKey="volume" stroke="#0a9089" strokeWidth={3} dot={{ r: 5, fill: '#0a9089' }} isAnimationActive={false}/></LineChart></ResponsiveContainer> : <p className="empty-chart-message">La courbe apparaîtra après la première série validée.</p>}</div></aside>
        </section>

        <section className="training-actions-reference"><button type="button" className="outline-teal-action" onClick={addExercise}><Plus /> {activeTraining?.status === 'completed' ? 'Recommencer la séance' : activeTraining ? 'Ajouter un exercice' : 'Démarrer la séance'}</button><button type="button" className="reference-action blue-action" disabled={!activeTraining || activeTraining.status !== 'in-progress'} onClick={finishSession}><CheckCircle2 /> {activeTraining?.status === 'completed' ? 'Séance terminée' : 'Terminer la séance'}</button></section>

        <details className="planning-details reference-card"><summary><ExplainedLabel help="Permet de corriger le type de séance, les calories planifiées et les pas cibles à partir de la date sélectionnée." placement="left">Modifier le planning des 8 prochains jours</ExplainedLabel></summary><div>{planDates.map((date) => { const dayLog = journalLogForDate(state, date); return <label key={date}><span>{formatShortDate(date)}</span><select value={state.schedule[date] ?? 'rest'} onChange={(event) => updateSchedule(date, event.target.value)}><option value="rest">Repos</option>{state.templates.map((item) => <option key={item.id} value={item.id}>{item.shortName}</option>)}</select><input type="number" value={dayLog.plannedBaseCalories ?? state.settings.baseCalories} onChange={(event) => updateLog(date, { plannedBaseCalories: Number(event.target.value) })}/><input type="number" value={dayLog.targetSteps ?? state.settings.targetSteps} onChange={(event) => updateLog(date, { targetSteps: Number(event.target.value) })}/></label> })}</div></details>
      </div>
    </div>
  )
}

function TrainingKpi({ icon, label, value, unit, tone = 'navy', help, placement = 'center' }: { icon: React.ReactNode; label: string; value: string; unit?: string; tone?: string; help: string; placement?: 'left' | 'center' | 'right' }) {
  return <div className={`training-kpi reference-card kpi-${tone}`}><span className="hero-icon-circle">{icon}</span><div><ExplainedLabel help={help} placement={placement}>{label}</ExplainedLabel><strong>{value} {unit && <small>{unit}</small>}</strong></div></div>
}
