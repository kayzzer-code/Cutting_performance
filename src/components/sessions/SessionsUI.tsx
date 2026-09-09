import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink, useBlocker } from 'react-router-dom'
import { BicepsFlexed, Dumbbell, LibraryBig, Moon, X } from 'lucide-react'
import { useJournalDate } from '../../hooks/useJournalDate'
import { useApp } from '../../state/AppContext'
import { useCloudSync } from '../../state/CloudSyncContext'
import { Button, Field, SelectField } from '../ui'
import { conventionLabels, dayLabels, normalized, trainingLog, uid } from '../../domain/training'
import { calculateDay } from '../../domain/calculations'
import { formatShortDate } from '../../domain/dates'
import { formatNumber } from '../../domain/format'
import { muscleGroups, muscleMeta } from '../../domain/exerciseCatalogue'
import type { AppState, DayType, ExerciseDefinition, LoadConvention, MuscleGroup } from '../../domain/types'

export function SessionsShell({ children }: { children: ReactNode }) {
  const { dateHref } = useJournalDate()
  const { storageStatus } = useApp()
  const cloud = useCloudSync()
  return <section className="sessions-page"><nav className="session-tabs" aria-label="Onglets séances">
    <NavLink to={dateHref('/seances')} end>Mes séances</NavLink><NavLink to={dateHref('/seances/exercices')}><LibraryBig aria-hidden="true" /> Exercices</NavLink><NavLink to={dateHref('/seances/planning')}>Planning</NavLink><NavLink to={dateHref('/seances/statistiques')}>Statistiques</NavLink><Link className="journal-shortcut" to={dateHref('/seances/journal')}>Journal du jour</Link>
  </nav><div className="session-save-status" role="status">{cloud.status === 'local' ? storageStatus : cloud.label}</div>{children}</section>
}
export function DayIcon({ type }: { type: DayType }) {
  const Icon = type === 'rest' ? Moon : type === 'shoulders-arms' ? BicepsFlexed : Dumbbell
  return <span className={`session-type-icon type-${type}`}><Icon aria-hidden="true" /></span>
}
export function PlanningImpact({ before, after, dates }: { before: AppState; after: AppState; dates: string[] }) {
  const [all, setAll] = useState(false)
  return <div className="planning-impact"><p>{dates.length} journées concernées. Ajustements manuels conservés.</p><div className="planning-preview">{dates.slice(0, all ? undefined : 7).map(date => {
    const old = calculateDay(trainingLog(before, date), before.profile, before.settings)
    const next = calculateDay(trainingLog(after, date), after.profile, after.settings)
    return <div key={date}><strong>{formatShortDate(date)} · {dayLabels[before.plannedSessions?.[date]?.dayType ?? 'rest']} → {dayLabels[after.plannedSessions?.[date]?.dayType ?? 'rest']}</strong><span>Base : {formatNumber(old.plannedBaseCalories)} → {formatNumber(next.plannedBaseCalories)} kcal</span><span>Pas : {formatNumber(old.targetSteps)} → {formatNumber(next.targetSteps)}</span><b>Cible : {formatNumber(old.adjustedCalorieTarget)} → {formatNumber(next.adjustedCalorieTarget)} kcal</b></div>
  })}</div>{dates.length > 7 && <Button variant="secondary" onClick={() => setAll(!all)}>{all ? 'Réduire la liste' : `Voir les ${dates.length} jours`}</Button>}</div>
}
export function Modal({ title, children, onClose, drawer = false }: { title: string; children: ReactNode; onClose: () => void; drawer?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null)
  const id = useId()
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const dialog = ref.current!
    dialog.showModal()
    return () => { dialog.close(); previous?.focus() }
  }, [])
  return <dialog className={`session-modal ${drawer ? 'session-drawer' : ''}`} ref={ref} aria-labelledby={id} onCancel={e => { e.preventDefault(); onClose() }}>
    <header><h2 id={id}>{title}</h2><button className="icon-button" aria-label="Fermer le panneau" onClick={onClose}><X /></button></header>{children}
  </dialog>
}
export function DraftGuard({ dirty }: { dirty: boolean }) {
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && currentLocation.pathname + currentLocation.search !== nextLocation.pathname + nextLocation.search)
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = '' } }
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])
  return blocker.state === 'blocked' ? <Modal title="Quitter le brouillon ?" onClose={() => blocker.reset()}><p>Les modifications non enregistrées seront abandonnées.</p><div className="session-actions"><Button variant="secondary" onClick={() => blocker.reset()}>Continuer la modification</Button><Button variant="danger" onClick={() => blocker.proceed()}>Abandonner et quitter</Button></div></Modal> : null
}
type PickerDraft = {
  search: string
  selected: string
  custom: boolean
  name: string
  equipment: string
  convention: LoadConvention
  muscle: string
  equipmentFilter: string
  movement: string
  customMuscle: MuscleGroup
  customSecondary: '' | MuscleGroup
  customSecondaryCoefficient: number
  customMovement: string
  laterality: 'bilateral' | 'unilateral'
  restSeconds: number
}
const pickerDrafts = new Map<string, PickerDraft>()
export function ExercisePicker({ onPick, onClose, title = 'Ajouter un exercice', children, draftKey = 'catalogue' }: { onPick: (exercise: ExerciseDefinition) => void; onClose: () => void; title?: string; children?: ReactNode; draftKey?: string }) {
  const { state, transact } = useApp()
  const [cached] = useState(() => pickerDrafts.get(draftKey))
  const [search, setSearch] = useState(cached?.search ?? '')
  const [selected, setSelected] = useState(cached?.selected ?? '')
  const [custom, setCustom] = useState(cached?.custom ?? false)
  const [name, setName] = useState(cached?.name ?? '')
  const [equipment, setEquipment] = useState(cached?.equipment ?? '')
  const [convention, setConvention] = useState<LoadConvention>(cached?.convention ?? 'total')
  const [muscle, setMuscle] = useState(cached?.muscle ?? '')
  const [equipmentFilter, setEquipmentFilter] = useState(cached?.equipmentFilter ?? '')
  const [movement, setMovement] = useState(cached?.movement ?? '')
  const [customMuscle, setCustomMuscle] = useState<MuscleGroup>(cached?.customMuscle ?? 'chest')
  const [customSecondary, setCustomSecondary] = useState<'' | MuscleGroup>(cached?.customSecondary ?? '')
  const [customSecondaryCoefficient, setCustomSecondaryCoefficient] = useState(cached?.customSecondaryCoefficient ?? 0.5)
  const [customMovement, setCustomMovement] = useState(cached?.customMovement ?? '')
  const [laterality, setLaterality] = useState<'bilateral' | 'unilateral'>(cached?.laterality ?? 'bilateral')
  const [restSeconds, setRestSeconds] = useState(cached?.restSeconds ?? 90)
  useEffect(() => { pickerDrafts.set(draftKey, { search, selected, custom, name, equipment, convention, muscle, equipmentFilter, movement, customMuscle, customSecondary, customSecondaryCoefficient, customMovement, laterality, restSeconds }) }, [draftKey, search, selected, custom, name, equipment, convention, muscle, equipmentFilter, movement, customMuscle, customSecondary, customSecondaryCoefficient, customMovement, laterality, restSeconds])
  const equipmentOptions = [...new Set((state.catalogue ?? []).filter(e => !e.archived).map(e => e.equipmentId))].sort((a, b) => a.localeCompare(b, 'fr'))
  const movementOptions = [...new Set((state.catalogue ?? []).filter(e => !e.archived).map(e => e.movementFamily).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, 'fr'))
  const defs = (state.catalogue ?? []).filter(e => {
    if (e.archived || muscle && !e.muscleContributions?.some(item => item.muscleId === muscle)) return false
    if (equipmentFilter && e.equipmentId !== equipmentFilter) return false
    if (movement && e.movementFamily !== movement) return false
    return normalized(`${e.name} ${e.equipmentId} ${e.movementFamily ?? ''} ${(e.aliases ?? []).join(' ')} ${(e.muscleContributions ?? []).map(item => muscleMeta(item.muscleId).label).join(' ')}`).includes(normalized(search))
  })
  return <Modal title={title} onClose={onClose} drawer>
    <Field label="Chercher un exercice" type="search" value={search} onChange={e => setSearch(e.target.value)} />
    <div className="exercise-picker-filters"><SelectField label="Muscle" value={muscle} onChange={e => setMuscle(e.target.value)}><option value="">Tous</option>{muscleGroups.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</SelectField><SelectField label="Matériel" value={equipmentFilter} onChange={e => setEquipmentFilter(e.target.value)}><option value="">Tous</option>{equipmentOptions.map(item => <option key={item}>{item}</option>)}</SelectField><SelectField label="Mouvement" value={movement} onChange={e => setMovement(e.target.value)}><option value="">Tous</option>{movementOptions.map(item => <option key={item}>{item}</option>)}</SelectField></div>
    <div className="exercise-catalogue">{defs.map(e => <label key={e.id} className={selected === e.id ? 'selected' : ''}><input type="radio" name="catalogue-exercise" checked={selected === e.id} onChange={() => { setSelected(e.id); setCustom(false) }} /><span><strong>{e.name}</strong><small>{e.equipmentId === 'legacy-unspecified' ? 'Matériel historique non précisé' : e.equipmentId} · {e.movementFamily ?? conventionLabels[e.convention]}</small><span className="muscle-tags">{e.muscleContributions?.slice(0, 3).map(item => <span key={item.muscleId} className={`muscle-tag role-${item.role}`}>{muscleMeta(item.muscleId).shortLabel}</span>)}</span></span></label>)}{!defs.length && <p>Aucun exercice trouvé. Crée ton exercice personnalisé.</p>}</div>
    <Button variant="secondary" onClick={() => setCustom(!custom)}>Créer un exercice personnalisé</Button>
    {custom && <form className="custom-exercise-form" onSubmit={e => { e.preventDefault(); const def: ExerciseDefinition = { id: uid('exercise'), name: name.trim(), equipmentId: equipment.trim(), convention, isCustom: true, muscleGroup: customMuscle, movementFamily: customMovement.trim() || 'Autre', laterality, defaultRestSeconds: restSeconds, muscleContributions: [{ muscleId: customMuscle, role: 'primary', coefficient: 1 }, ...(customSecondary ? [{ muscleId: customSecondary, role: 'secondary' as const, coefficient: customSecondaryCoefficient }] : [])] }; if (def.name && def.equipmentId && transact(s => ({ ...s, catalogue: [...(s.catalogue ?? []), def] }))) { setSelected(def.id); setCustom(false) } }}>
      <Field label="Nom de l’exercice" value={name} required maxLength={100} onChange={e => setName(e.target.value)} /><Field label="Matériel / variante" value={equipment} required maxLength={80} placeholder="Ex. machine A, haltères…" onChange={e => setEquipment(e.target.value)} />
      <div className="custom-exercise-grid"><SelectField label="Muscle principal" value={customMuscle} onChange={e => setCustomMuscle(e.target.value as MuscleGroup)}>{muscleGroups.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</SelectField><SelectField label="Muscle secondaire" value={customSecondary} onChange={e => setCustomSecondary(e.target.value as '' | MuscleGroup)}><option value="">Aucun</option>{muscleGroups.filter(item => item.id !== customMuscle).map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</SelectField>{customSecondary && <Field label="Coefficient secondaire" type="number" min={0} max={1} step={0.1} value={customSecondaryCoefficient} onChange={e => setCustomSecondaryCoefficient(Number(e.target.value))} />}<Field label="Famille de mouvement" value={customMovement} maxLength={80} placeholder="Ex. Tirage horizontal" onChange={e => setCustomMovement(e.target.value)} /><SelectField label="Latéralité" value={laterality} onChange={e => setLaterality(e.target.value as 'bilateral' | 'unilateral')}><option value="bilateral">Bilatéral</option><option value="unilateral">Unilatéral</option></SelectField><Field label="Repos par défaut" type="number" min={15} max={600} step={5} suffix="s" value={restSeconds} onChange={e => setRestSeconds(Number(e.target.value))} /></div>
      <SelectField label="Convention de charge" value={convention} onChange={e => setConvention(e.target.value as LoadConvention)}>{Object.entries(conventionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</SelectField><Button type="submit">Créer dans le catalogue</Button>
    </form>}
    {children}
    <div className="modal-footer"><Button disabled={!selected || custom} onClick={() => { const e = state.catalogue?.find(e => e.id === selected); if (e) { pickerDrafts.delete(draftKey); onPick(e) } }}>Confirmer le choix</Button><Button variant="secondary" onClick={onClose}>Annuler</Button></div>
  </Modal>
}
