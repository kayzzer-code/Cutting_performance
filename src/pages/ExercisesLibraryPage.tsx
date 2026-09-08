import { useMemo, useState, type CSSProperties } from 'react'
import { Archive, ArchiveRestore, Clock3, Dumbbell, Pencil, Plus, Search, Star } from 'lucide-react'
import { useApp } from '../state/AppContext'
import { muscleGroups, muscleMeta } from '../domain/exerciseCatalogue'
import { conventionLabels, normalized } from '../domain/training'
import type { ExerciseDefinition, LoadConvention, MuscleGroup } from '../domain/types'
import { Button, Card, Field, PageHeader, SelectField } from '../components/ui'
import { ExercisePicker, Modal, SessionsShell } from '../components/sessions/SessionsUI'

type CatalogueView = 'all' | 'favourites' | 'recent' | 'archived'

function recentExerciseIds(state: ReturnType<typeof useApp>['state']) {
  const rows = Object.values(state.logs)
    .filter(log => log.training)
    .sort((a, b) => b.date.localeCompare(a.date))
    .flatMap(log => log.training?.exercises ?? [])
  return [...new Set(rows.map(line => line.exerciseId).filter(Boolean) as string[])]
}

export function ExercisesLibraryPage() {
  const { state, transact } = useApp()
  const [view, setView] = useState<CatalogueView>('all')
  const [search, setSearch] = useState('')
  const [muscle, setMuscle] = useState('')
  const [equipment, setEquipment] = useState('')
  const [movement, setMovement] = useState('')
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<ExerciseDefinition | null>(null)
  const recentIds = useMemo(() => recentExerciseIds(state), [state])
  const catalogue = state.catalogue ?? []
  const equipmentOptions = [...new Set(catalogue.map(item => item.equipmentId))].sort((a, b) => a.localeCompare(b, 'fr'))
  const movementOptions = [...new Set(catalogue.map(item => item.movementFamily).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, 'fr'))
  const filtered = catalogue.filter(item => {
    if (view === 'archived' ? !item.archived : item.archived) return false
    if (view === 'favourites' && !item.favourite) return false
    if (view === 'recent' && !recentIds.includes(item.id)) return false
    if (muscle && !item.muscleContributions?.some(part => part.muscleId === muscle)) return false
    if (equipment && item.equipmentId !== equipment) return false
    if (movement && item.movementFamily !== movement) return false
    const haystack = `${item.name} ${item.equipmentId} ${item.movementFamily ?? ''} ${(item.aliases ?? []).join(' ')} ${(item.muscleContributions ?? []).map(part => muscleMeta(part.muscleId).label).join(' ')}`
    return normalized(haystack).includes(normalized(search))
  })
  const patchExercise = (id: string, patch: Partial<ExerciseDefinition>) => transact(current => ({ ...current, catalogue: (current.catalogue ?? []).map(item => item.id === id ? { ...item, ...patch } : item) }))

  return <SessionsShell>
    <PageHeader title="Bibliothèque d’exercices" description={`${catalogue.filter(item => !item.archived).length} exercices prêts à intégrer à tes séances.`} action={<Button onClick={() => setAdding(true)}><Plus /> Ajouter un exercice</Button>} />
    <div className="catalogue-toolbar">
      <div className="session-search"><Search aria-hidden="true" /><input aria-label="Rechercher dans la bibliothèque" type="search" placeholder="Exercice, alias, muscle…" value={search} onChange={event => setSearch(event.target.value)} /></div>
      <SelectField label="Muscle" value={muscle} onChange={event => setMuscle(event.target.value)}><option value="">Tous</option>{muscleGroups.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</SelectField>
      <SelectField label="Matériel" value={equipment} onChange={event => setEquipment(event.target.value)}><option value="">Tous</option>{equipmentOptions.map(item => <option key={item}>{item}</option>)}</SelectField>
      <SelectField label="Mouvement" value={movement} onChange={event => setMovement(event.target.value)}><option value="">Tous</option>{movementOptions.map(item => <option key={item}>{item}</option>)}</SelectField>
    </div>
    <div className="catalogue-segments session-segments" aria-label="Filtres de bibliothèque">{([['all', 'Tous'], ['favourites', 'Favoris'], ['recent', 'Récents'], ['archived', 'Archivés']] as const).map(([id, label]) => <button key={id} aria-pressed={view === id} onClick={() => setView(id)}>{id === 'favourites' && <Star aria-hidden="true" />}{id === 'recent' && <Clock3 aria-hidden="true" />}{id === 'archived' && <Archive aria-hidden="true" />}{label}</button>)}</div>
    <div className="exercise-library-grid">{filtered.map(item => <Card className="exercise-library-card" key={item.id}>
      <header><span className="exercise-library-icon"><Dumbbell aria-hidden="true" /></span><div><h2>{item.name}</h2><p>{item.equipmentId}</p></div><button className={`icon-button catalogue-favourite ${item.favourite ? 'active' : ''}`} aria-label={item.favourite ? `Retirer ${item.name} des favoris` : `Ajouter ${item.name} aux favoris`} onClick={() => patchExercise(item.id, { favourite: !item.favourite })}><Star fill={item.favourite ? 'currentColor' : 'none'} /></button></header>
      <div className="exercise-library-meta"><span>{item.movementFamily ?? 'Mouvement non renseigné'}</span><span>{item.laterality === 'unilateral' ? 'Unilatéral' : 'Bilatéral'}</span><span>{item.defaultRestSeconds ?? 90} s repos</span></div>
      <div className="muscle-tags">{item.muscleContributions?.map(part => <span key={part.muscleId} className={`muscle-tag role-${part.role}`} style={{ '--muscle-color': muscleMeta(part.muscleId).color } as CSSProperties}>{muscleMeta(part.muscleId).shortLabel} {part.role !== 'primary' && `× ${part.coefficient}`}</span>)}</div>
      <footer><Button variant="secondary" onClick={() => setEditing(item)}><Pencil /> Modifier</Button><Button variant="ghost" onClick={() => patchExercise(item.id, { archived: !item.archived })}>{item.archived ? <ArchiveRestore /> : <Archive />}{item.archived ? 'Restaurer' : 'Archiver'}</Button></footer>
    </Card>)}</div>
    {!filtered.length && <Card className="catalogue-empty"><Dumbbell /><h2>Aucun exercice dans cette vue</h2><p>Retire un filtre ou crée une variante adaptée à ton matériel.</p><Button onClick={() => setAdding(true)}>Créer un exercice</Button></Card>}
    <p className="catalogue-footnote">Les exercices archivés restent attachés à ton historique et à tes anciennes séances.</p>
    {adding && <ExercisePicker title="Ajouter un exercice au catalogue" draftKey="exercise-library" onClose={() => setAdding(false)} onPick={() => setAdding(false)} />}
    {editing && <ExerciseEditModal exercise={editing} onClose={() => setEditing(null)} onSave={next => { patchExercise(next.id, next); setEditing(null) }} />}
  </SessionsShell>
}

function ExerciseEditModal({ exercise, onClose, onSave }: { exercise: ExerciseDefinition; onClose: () => void; onSave: (exercise: ExerciseDefinition) => void }) {
  const [draft, setDraft] = useState(exercise)
  const primary = draft.muscleContributions?.find(item => item.role === 'primary')?.muscleId ?? 'chest'
  const secondary = draft.muscleContributions?.find(item => item.role === 'secondary')
  return <Modal title="Modifier l’exercice" onClose={onClose}>
    <form className="exercise-edit-form" onSubmit={event => { event.preventDefault(); onSave(draft) }}>
      <Field label="Nom de l’exercice" required maxLength={100} value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} />
      <Field label="Matériel / variante" required maxLength={80} value={draft.equipmentId} onChange={event => setDraft({ ...draft, equipmentId: event.target.value })} />
      <Field label="Famille de mouvement" maxLength={80} value={draft.movementFamily ?? ''} onChange={event => setDraft({ ...draft, movementFamily: event.target.value })} />
      <SelectField label="Muscle principal" value={primary} onChange={event => { const next = event.target.value as MuscleGroup; setDraft({ ...draft, muscleGroup: next, muscleContributions: [{ muscleId: next, role: 'primary', coefficient: 1 }, ...(draft.muscleContributions ?? []).filter(item => item.role !== 'primary' && item.muscleId !== next)] }) }}>{muscleGroups.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</SelectField>
      <SelectField label="Muscle secondaire" value={secondary?.muscleId ?? ''} onChange={event => { const next = event.target.value as '' | MuscleGroup; setDraft({ ...draft, muscleContributions: [{ muscleId: primary, role: 'primary', coefficient: 1 }, ...(next ? [{ muscleId: next, role: 'secondary' as const, coefficient: secondary?.coefficient ?? 0.5 }] : [])] }) }}><option value="">Aucun</option>{muscleGroups.filter(item => item.id !== primary).map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</SelectField>
      {secondary && <Field label="Coefficient secondaire" type="number" min={0} max={1} step={0.1} value={secondary.coefficient} onChange={event => setDraft({ ...draft, muscleContributions: (draft.muscleContributions ?? []).map(item => item.role === 'secondary' ? { ...item, coefficient: Number(event.target.value) } : item) })} />}
      <SelectField label="Convention de charge" value={draft.convention} onChange={event => setDraft({ ...draft, convention: event.target.value as LoadConvention })}>{Object.entries(conventionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</SelectField>
      <SelectField label="Latéralité" value={draft.laterality ?? 'bilateral'} onChange={event => setDraft({ ...draft, laterality: event.target.value as 'bilateral' | 'unilateral' })}><option value="bilateral">Bilatéral</option><option value="unilateral">Unilatéral</option></SelectField>
      <Field label="Repos par défaut" type="number" min={15} max={600} step={5} suffix="s" value={draft.defaultRestSeconds ?? 90} onChange={event => setDraft({ ...draft, defaultRestSeconds: Number(event.target.value) })} />
      <div className="modal-footer"><Button type="submit">Enregistrer</Button><Button type="button" variant="secondary" onClick={onClose}>Annuler</Button></div>
    </form>
  </Modal>
}
