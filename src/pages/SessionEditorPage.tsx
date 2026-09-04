import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowDown, ArrowUp, Copy, Flame, Footprints, Plus, Save, Shuffle, Trash2 } from 'lucide-react'
import { useApp } from '../state/AppContext'
import { useJournalDate } from '../hooks/useJournalDate'
import { clone, conventionLabels, dayLabels, duplicateTemplate, newLine, saveTemplate, targetText, uid } from '../domain/training'
import { formatNumber } from '../domain/format'
import { isoDate } from '../domain/dates'
import { Button, Card, Field, InfoBanner, PageHeader, SelectField } from '../components/ui'
import { ExplainedLabel } from '../components/HelpTooltip'
import { DayIcon, DraftGuard, ExercisePicker, Modal, PlanningImpact, SessionsShell } from '../components/sessions/SessionsUI'
import type { ExerciseDefinition, TemplateExercise, TrainingTemplate } from '../domain/types'

export function SessionEditorPage() {
  const { templateId } = useParams()
  const location = useLocation()
  const { state } = useApp()
  const template = state.templates.find(t => t.id === templateId)
  return <Editor key={`${templateId ?? 'new'}-${location.pathname.endsWith('/modifier')}`} template={template} missing={!!templateId && !template} readOnly={!!templateId && !location.pathname.endsWith('/modifier')} />
}

function Editor({ template, missing, readOnly }: { template?: TrainingTemplate; missing: boolean; readOnly: boolean }) {
  const { state, transact } = useApp()
  const { dateHref } = useJournalDate()
  const navigate = useNavigate()
  const [original] = useState(() => clone(template ?? { id: uid('template'), name: '', shortName: '', dayType: 'upper', exercises: [] } as TrainingTemplate))
  const [draft, setDraft] = useState(clone(original))
  const [picker, setPicker] = useState<string | null>(null)
  const [scope, setScope] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [drag, setDrag] = useState<number | null>(null)
  const dirty = !readOnly && !saved && JSON.stringify(draft) !== JSON.stringify(original)
  const plan = state.settings.dayTypePlans[draft.dayType ?? 'upper']
  function updateLine(id: string, patch: Partial<TemplateExercise>) { setDraft(d => ({ ...d, exercises: d.exercises.map(e => e.id === id ? { ...e, ...patch } : e) })) }
  function move(from: number, to: number) { if (to < 0 || to >= draft.exercises.length) return; setDraft(d => { const exercises = [...d.exercises]; exercises.splice(to, 0, exercises.splice(from, 1)[0]); return { ...d, exercises } }) }
  function selectExercise(def: ExerciseDefinition) {
    if (picker === 'add') setDraft(d => ({ ...d, exercises: [...d.exercises, newLine(def)] }))
    else if (picker) updateLine(picker, { exerciseId: def.id, name: def.name, equipmentId: def.equipmentId, convention: def.convention })
    setPicker(null)
  }
  function persist() {
    const ok = transact(s => {
      if (s.templates.find(t => t.id === draft.id)?.version !== original.version) throw new Error('Ce modèle a changé dans un autre onglet. Recharge-le avant de modifier sa nouvelle version.')
      return saveTemplate(s, { ...draft, shortName: draft.name.split(' · ')[0], exercises: draft.exercises.map(e => ({ ...e, target: targetText(e) })) }, scope)
    })
    if (ok) { setSaved(true); setConfirm(false); setTimeout(() => navigate(dateHref(`/seances/${draft.id}`)), 0) }
  }
  if (missing) return <SessionsShell><h1>Modèle introuvable</h1><Link to={dateHref('/seances')}>Revenir aux séances</Link></SessionsShell>
  return <SessionsShell><DraftGuard dirty={dirty} /><Link className="back-link" to={dateHref('/seances')}>Séances / {readOnly ? 'Détail du modèle' : 'Modifier un modèle'}</Link>
    <form onSubmit={e => { e.preventDefault(); setError(''); if (draft.exercises.some(l => !l.setCount || !l.repsMin || !l.repsMax || l.repsMax < l.repsMin)) { setError('Vérifie les séries et les plages de répétitions de chaque exercice.'); return } if (scope) setConfirm(true); else persist() }}>
      <PageHeader title={readOnly ? draft.name : template ? `Modifier ${template.shortName}` : 'Créer une séance'} description={draft.archived ? 'Modèle archivé — historique conservé' : 'Modèle réutilisable'} action={<>{template && <Button type="button" variant="secondary" onClick={() => { const copy = duplicateTemplate(draft); if (transact(s => saveTemplate(s, copy, false))) { setSaved(true); setTimeout(() => navigate(dateHref(`/seances/${copy.id}/modifier`)), 0) } }}><Copy /> Dupliquer</Button>}{readOnly ? <Link className="button button-primary" to={dateHref(`/seances/${draft.id}/modifier`)}>Modifier le modèle</Link> : <Button type="submit"><Save /> Enregistrer le modèle</Button>}</>} />
      {error && <p role="alert" className="field-error">{error}</p>}
      <div className="session-editor-grid"><div className="session-stack"><Card className="session-panel"><h2>Informations de la séance</h2><div className="session-info-fields"><Field label="Nom de la séance" required maxLength={100} value={draft.name} readOnly={readOnly} onChange={e => setDraft({ ...draft, name: e.target.value })} /><SelectField label="Type de journée" value={draft.dayType} disabled={readOnly} onChange={e => setDraft({ ...draft, dayType: e.target.value as TrainingTemplate['dayType'] })}>{Object.entries(dayLabels).filter(([key]) => key !== 'rest').map(([key, name]) => <option key={key} value={key}>{name}</option>)}</SelectField><Field label="Objectif / description" value={draft.description ?? ''} readOnly={readOnly} maxLength={200} onChange={e => setDraft({ ...draft, description: e.target.value })} /></div></Card>
      <Card className="session-panel"><h2><ExplainedLabel help="Ces prescriptions servent aux prochaines occurrences. Les performances restent dans leur journal daté.">Exercices du modèle</ExplainedLabel></h2>
        <div className="prescription-list">{draft.exercises.map((line, index) => <div className="prescription-row" key={line.id} draggable={!readOnly} onDragStart={() => setDrag(index)} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (drag !== null) move(drag, index); setDrag(null) }}><div className="prescription-title"><strong>{index + 1}. {line.name}</strong><small>{line.equipmentId === 'legacy-unspecified' ? 'Matériel à préciser en remplaçant par une variante du catalogue' : line.equipmentId} · {conventionLabels[line.convention ?? 'unknown']}</small><span className="legacy-prescription">{line.target}</span></div>
        <div className="prescription-numbers"><Field label={`Séries ${index + 1}`} type="number" min={1} max={30} required disabled={readOnly} value={line.setCount ?? ''} onChange={e => updateLine(line.id, { setCount: e.target.value === '' ? undefined : +e.target.value })} /><Field label={`Reps min ${index + 1}`} type="number" min={1} max={1000} required disabled={readOnly} value={line.repsMin ?? ''} onChange={e => updateLine(line.id, { repsMin: e.target.value === '' ? undefined : +e.target.value })} /><Field label={`Reps max ${index + 1}`} type="number" min={line.repsMin ?? 1} max={1000} required disabled={readOnly} value={line.repsMax ?? ''} onChange={e => updateLine(line.id, { repsMax: e.target.value === '' ? undefined : +e.target.value })} /><Field label={`RIR ${index + 1}`} type="number" min={0} max={10} disabled={readOnly} value={line.targetRir ?? ''} onChange={e => updateLine(line.id, { targetRir: e.target.value === '' ? undefined : +e.target.value })} /><Field label={`Repos (s) ${index + 1}`} type="number" min={0} max={1800} disabled={readOnly} value={line.restSeconds ?? ''} onChange={e => updateLine(line.id, { restSeconds: e.target.value === '' ? undefined : +e.target.value })} /></div>
        {!readOnly && <div className="prescription-actions"><Button type="button" variant="ghost" aria-label={`Monter ${line.name}`} disabled={index === 0} onClick={() => move(index, index - 1)}><ArrowUp /></Button><Button type="button" variant="ghost" aria-label={`Descendre ${line.name}`} disabled={index === draft.exercises.length - 1} onClick={() => move(index, index + 1)}><ArrowDown /></Button><Button type="button" variant="ghost" aria-label={`Remplacer ${line.name}`} onClick={() => setPicker(line.id)}><Shuffle /></Button><Button type="button" variant="ghost" aria-label={`Retirer ${line.name}`} onClick={() => setDraft(d => ({ ...d, exercises: d.exercises.filter(e => e.id !== line.id) }))}><Trash2 /></Button></div>}
        <details><summary>Note technique</summary><Field label={`Note ${index + 1}`} value={line.note ?? ''} readOnly={readOnly} maxLength={500} onChange={e => updateLine(line.id, { note: e.target.value })} /></details></div>)}</div>
        {!draft.exercises.length && <p>Aucun exercice. Ce modèle ne pourra pas être démarré tant qu’il sera vide.</p>}
        {!readOnly && <Button type="button" variant="secondary" className="add-exercise" onClick={() => setPicker('add')}><Plus /> Ajouter un exercice</Button>}
        <InfoBanner>Pendant une séance, tu pourras remplacer un exercice pour ce jour uniquement. Aucune poussée tant que l’épaule n’a pas été validée médicalement ; amplitude indolore.</InfoBanner>
      </Card></div><aside className="session-stack"><Card className="session-panel"><h2><ExplainedLabel help="La musculation prévue est déjà comprise dans la base du type de journée. Le tonnage n’ajoute aucune calorie.">Impact sur la journée</ExplainedLabel></h2><div className="session-metric-line"><DayIcon type={draft.dayType ?? 'upper'} /><span>Type</span><strong>{dayLabels[draft.dayType ?? 'upper']}</strong></div><div className="session-metric-line"><Flame /><span>Base du plan</span><strong>{formatNumber(plan.calories)} kcal</strong></div><div className="session-metric-line"><Footprints /><span>Pas cibles</span><strong>{formatNumber(plan.steps)}</strong></div><p>Valeurs issues de tes paramètres. Aucun ajout de calorie par série.</p><Link to={dateHref('/parametres')}>Ouvrir les paramètres →</Link></Card>
      {!readOnly && <Card className="session-panel"><h2>Portée des modifications</h2><label className="scope-option"><input type="radio" name="scope" checked={!scope} onChange={() => setScope(false)} /><span>Prochaines occurrences nouvellement planifiées<small>Les jours déjà planifiés gardent leur copie actuelle.</small></span></label><label className="scope-option"><input type="radio" name="scope" checked={scope} onChange={() => setScope(true)} /><span>Inclure les séances planifiées non démarrées<small>Uniquement aujourd’hui et les jours futurs. Confirmation avant application.</small></span></label><p>Les séances en cours et réalisées restent inchangées.</p></Card>}
      {readOnly && !draft.archived && <Link className="button button-primary" to={dateHref(`/seances/planning?template=${draft.id}`)}>Planifier cette séance</Link>}</aside></div>
    </form>
    {picker && <ExercisePicker draftKey={`editor-${draft.id}-${picker}`} onPick={selectExercise} onClose={() => setPicker(null)} />}
    {confirm && <Modal title="Mettre à jour les séances planifiées ?" onClose={() => setConfirm(false)}><p>Les jours non démarrés à partir d’aujourd’hui recevront ce modèle. Leur base suivra le type {dayLabels[draft.dayType ?? 'upper']}, avec conservation des ajustements manuels, nutrition et activités. Les séances en cours ou terminées ne changent pas.</p><PlanningImpact before={state} after={saveTemplate(state, draft, true)} dates={Object.entries(state.schedule).filter(([date, id]) => date >= isoDate() && id === draft.id && !state.logs[date]?.training).map(([date]) => date).sort()} /><Button onClick={persist}>Confirmer et enregistrer</Button><Button variant="secondary" onClick={() => setConfirm(false)}>Annuler</Button></Modal>}
  </SessionsShell>
}
