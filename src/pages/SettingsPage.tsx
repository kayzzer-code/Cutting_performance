import { useEffect, useMemo, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import { Archive, Bike, CalendarDays, Check, ChevronDown, CircleGauge, Dumbbell, Flag, HeartPulse, Info, LockKeyhole, Medal, Plus, RotateCcw, Save, Scale, Sparkles, Target, Trash2, TrendingDown, TrendingUp, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { calculateDay } from '../domain/calculations'
import { formatCompactDate, formatLongDate, isoDate } from '../domain/dates'
import { formatDecimal, formatNumber } from '../domain/format'
import { defaultGoal, goalProgress, goalStats, goalTypeLabels, profileFromGoal } from '../domain/objectives'
import { adaptSettingsToProfile, estimatedBmr, targetDailyDeficit } from '../domain/planning'
import { createInitialState } from '../domain/seed'
import { reconfigureState, trainingLog } from '../domain/training'
import type { AppState, CalculationSettings, FitnessGoal, GoalPriority, GoalType, Profile } from '../domain/types'
import { useApp } from '../state/AppContext'

const goalIcons: Record<GoalType, typeof Target> = {
  'fat-loss': TrendingDown, 'lean-gain': TrendingUp, maintenance: HeartPulse,
  strength: Dumbbell, endurance: Bike, event: Medal,
}
const typeDescriptions: Record<GoalType, string> = {
  'fat-loss': 'Réduire le poids et la masse grasse en préservant les performances.',
  'lean-gain': 'Construire du muscle avec une prise de gras plafonnée.',
  maintenance: 'Stabiliser la composition corporelle et rester performant.',
  strength: 'Faire progresser une performance de référence.',
  endurance: 'Développer le cardio, la course ou le vélo.',
  event: 'Préparer une échéance datée, par exemple un Ironman.',
}

export function SettingsPage() {
  const { state, transact, resetApp } = useApp()
  const navigate = useNavigate()
  const today = isoDate()
  const activeGoal = state.goals.find(item => item.id === state.activeGoalId && item.status === 'active')
  const [goal, setGoal] = useState<FitnessGoal | undefined>(activeGoal)
  const [settings, setSettings] = useState<CalculationSettings>(state.settings)
  const [saved, setSaved] = useState(false)
  const [creatorOpen, setCreatorOpen] = useState(false)
  const [newGoal, setNewGoal] = useState(() => defaultGoal('fat-loss', state.profile, today))
  // The editable draft must be refreshed after a saved/new active objective replaces it.
  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => { setGoal(activeGoal); setSettings(state.settings) }, [activeGoal, state.settings])

  const stats = useMemo(() => activeGoal ? goalStats(state, activeGoal, today) : undefined, [activeGoal, state, today])
  const currentWeight = stats?.currentWeight ?? state.profile.currentWeightKg
  const previewLog = trainingLog(state, today)
  const draftProfile = goal ? { ...profileFromGoal(state.profile, goal), currentWeightKg: state.profile.currentWeightKg } : state.profile
  const preview = calculateDay({ ...previewLog, plannedBaseCalories: settings.dayTypePlans['shoulders-arms'].calories, targetSteps: settings.dayTypePlans['shoulders-arms'].steps }, draftProfile, settings)

  function patchGoal<K extends keyof FitnessGoal>(key: K, value: FitnessGoal[K]) {
    if (!goal) return
    let next = { ...goal, [key]: value }
    if (key === 'type') next = normalizeGoalForType(next, value as GoalType)
    setGoal(next)
    if (['referenceBodyFatPercent', 'targetWeightChangeKgPerWeek', 'referenceWeightKg', 'heightCm'].includes(key)) {
      const nextProfile = { ...profileFromGoal(state.profile, next), currentWeightKg: state.profile.currentWeightKg }
      setSettings(adaptSettingsToProfile(state.profile, nextProfile, state.settings))
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!goal) return
    const nextProfile = { ...profileFromGoal(state.profile, goal), currentWeightKg: state.profile.currentWeightKg }
    transact(current => reconfigureState({ ...current, goals: current.goals.map(item => item.id === goal.id ? goal : item) }, nextProfile, settings))
    setSaved(true); window.setTimeout(() => setSaved(false), 2200)
  }

  function createObjective(event: FormEvent) {
    event.preventDefault()
    if (activeGoal && !window.confirm(`Archiver « ${activeGoal.name} » aujourd’hui et démarrer ce nouvel objectif ?`)) return
    const started = { ...newGoal, status: 'active' as const, createdAt: today }
    const nextProfile = profileFromGoal(state.profile, started)
    const nextSettings = adaptSettingsToProfile(state.profile, nextProfile, state.settings)
    transact(current => reconfigureState({
      ...current,
      goals: [...current.goals.map(item => item.id === current.activeGoalId && item.status === 'active' ? { ...item, status: 'completed' as const, endedAt: today } : item), started],
      activeGoalId: started.id,
    }, nextProfile, nextSettings))
    setCreatorOpen(false)
  }

  function finishGoal() {
    if (!activeGoal || !window.confirm(`Terminer « ${activeGoal.name} » aujourd’hui ? Son bilan restera disponible dans l’historique.`)) return
    transact(current => ({ ...current, goals: current.goals.map(item => item.id === activeGoal.id ? { ...item, status: 'completed', endedAt: today } : item), activeGoalId: undefined }))
  }
  function openCreator(type: GoalType = 'fat-loss') { setNewGoal(defaultGoal(type, state.profile, today)); setCreatorOpen(true) }
  function restore() {
    if (!window.confirm('Restaurer les coefficients et bases caloriques conseillés ? Tes objectifs et journaux restent intacts.')) return
    const initial = createInitialState(); setSettings(adaptSettingsToProfile(initial.profile, state.profile, initial.settings))
  }
  function restart() { if (!window.confirm('Effacer toutes les activités, calories, objectifs, pesées et séances, puis recommencer ?')) return; resetApp(); navigate('/onboarding/objectif') }

  return <div className="reference-page objectives-reference">
    <header className="reference-topbar page-title-topbar"><div className="title-stack"><h1>Objectifs</h1><p>Chaque phase possède ses dates, son plan et son bilan</p></div><button className="header-primary-action" type="button" onClick={() => openCreator()}><Plus /> Nouvel objectif</button></header>
    <div className="reference-body objectives-body">
      {saved && <div className="save-toast">Objectif et calculs enregistrés.</div>}
      {activeGoal && goal && stats ? <>
        <ObjectiveHero goal={activeGoal} currentWeight={currentWeight} progress={goalProgress(activeGoal, currentWeight, today)} onFinish={finishGoal} />
        <section className="objective-kpis">
          <ObjectiveKpi icon={<CalendarDays />} label="Durée" value={`${stats.durationDays} jours`} detail={`${stats.trackedDays} jours renseignés`} />
          <ObjectiveKpi icon={<Scale />} label="Évolution" value={`${stats.weightChange > 0 ? '+' : ''}${formatDecimal(stats.weightChange)} kg`} detail={`${formatDecimal(stats.firstWeight)} → ${formatDecimal(stats.currentWeight)} kg`} tone="teal" />
          <ObjectiveKpi icon={<CircleGauge />} label="Calories moyennes" value={stats.averageCalories ? `${formatNumber(stats.averageCalories)} kcal` : '—'} detail={stats.calorieDays ? `${stats.calorieDays} jours saisis` : 'Données insuffisantes'} />
          <ObjectiveKpi icon={<Dumbbell />} label="Entraînement" value={`${stats.trainingSessions} séances`} detail={`${formatDecimal(stats.cardioMinutes / 60)} h de cardio`} />
        </section>
        <form className="objective-config" onSubmit={submit}>
          <section className="objective-main-card reference-card">
            <div className="objective-section-title"><div><span><Target /></span><div><h2>Finalité de l’objectif</h2><p>Ces données définissent la trajectoire et la période analysée.</p></div></div><span className="active-pill"><i /> Actif</span></div>
            <GoalFields goal={goal} onPatch={patchGoal} />
            <PriorityPicker goal={goal} onChange={priorities => patchGoal('priorities', priorities)} />
            <label className="objective-note"><span>Notes et finalité personnelle</span><textarea value={goal.objectiveNote ?? ''} placeholder="Ex. préserver ma masse musculaire, améliorer mon temps sur 10 km…" onChange={event => patchGoal('objectiveNote', event.target.value)} /></label>
          </section>
          <div className="objective-side-column">
            <section className="objective-plan-card reference-card"><h2><Sparkles /> Ce que l’application suit</h2><PlanCapabilities type={goal.type} /></section>
            <details className="objective-calculation-card reference-card"><summary><span><CircleGauge /> Calories et calculs avancés</span><ChevronDown /></summary><div className="objective-calculation-content">
              <p className="auto-plan-note">Les bases sont recalculées selon la composition corporelle et le rythme de poids. Les coefficients techniques restent verrouillés.</p>
              {([['lower','Lower'],['upper','Upper'],['shoulders-arms','Épaules–Bras'],['rest','Repos']] as const).map(([key, label]) => <label className="compact-setting" key={key}><span>{label}</span><span><input aria-label={`Calories ${label}`} type="number" step="50" value={settings.dayTypePlans[key].calories} onChange={event => setSettings(current => ({ ...current, dayTypePlans: { ...current.dayTypePlans, [key]: { ...current.dayTypePlans[key], calories: Number(event.target.value) } } }))} /><small>kcal</small></span></label>)}
              <label className="compact-setting"><span>Restitution activité</span><span><input aria-label="Restitution de l’excédent" type="number" min="0" max="100" value={Math.round(settings.reintegrationRate * 100)} onChange={event => setSettings(current => ({ ...current, reintegrationRate: Number(event.target.value) / 100 }))} /><small>%</small></span></label>
              <div className="locked-coefficients"><LockKeyhole /><span>Marche {settings.walkKcalPer1000} kcal / 1 000 pas · Course {formatDecimal(settings.runKcalPerKgKm)} kcal / kg / km</span></div>
              <div className="objective-formula"><strong>Aperçu : {formatNumber(preview.adjustedCalorieTarget)} kcal</strong><small>Métabolisme estimé {formatNumber(estimatedBmr(draftProfile))} kcal · balance visée {formatNumber(-targetDailyDeficit(draftProfile))} kcal/j</small></div>
            </div></details>
            <div className="objective-form-actions"><button type="button" className="restore-button" onClick={restore}><RotateCcw /> Bases conseillées</button><button className="reference-action blue-action" type="submit"><Save /> Enregistrer</button></div>
          </div>
        </form>
      </> : <section className="no-active-objective reference-card"><span><Flag /></span><h2>Aucun objectif actif</h2><p>Ton dernier cycle est archivé. Démarre une nouvelle phase sans perdre son historique.</p><button className="reference-action blue-action" onClick={() => openCreator()}><Plus /> Créer mon prochain objectif</button></section>}
      <GoalHistory state={state} />
      <section className="reset-data-card reference-card"><div><Trash2 /><span><strong>Recommencer avec un journal vide</strong><small>Efface aussi tout l’historique des objectifs.</small></span></div><button type="button" onClick={restart}>Effacer mes données et recommencer</button></section>
    </div>
    {creatorOpen && <GoalCreator goal={newGoal} activeGoal={activeGoal} onChange={setNewGoal} onClose={() => setCreatorOpen(false)} onSubmit={createObjective} />}
  </div>
}

function normalizeGoalForType(goal: FitnessGoal, type: GoalType): FitnessGoal {
  const rate = type === 'fat-loss' ? -Math.max(.1, Math.abs(goal.targetWeightChangeKgPerWeek || .6)) : type === 'lean-gain' ? Math.max(.1, Math.abs(goal.targetWeightChangeKgPerWeek || .2)) : 0
  return { ...goal, type, name: goalTypeLabels[type], targetWeightChangeKgPerWeek: rate, priorities: defaultPriorities(type), enduranceDiscipline: type === 'event' ? 'ironman' : type === 'endurance' ? 'general' : undefined }
}
function defaultPriorities(type: GoalType): GoalPriority[] { if (type === 'strength') return ['strength']; if (type === 'endurance') return ['cardio']; if (type === 'event') return ['event', 'cardio']; return ['body-composition'] }

function ObjectiveHero({ goal, currentWeight, progress, onFinish }: { goal: FitnessGoal; currentWeight: number; progress: number; onFinish: () => void }) {
  const Icon = goalIcons[goal.type]
  return <section className="objective-hero reference-card"><div className="objective-hero-icon"><Icon /></div><div className="objective-hero-copy"><span>OBJECTIF ACTIF · {goalTypeLabels[goal.type]}</span><h2>{goal.name}</h2><p><CalendarDays /> Du {formatCompactDate(goal.startDate)} {goal.targetDate ? `au ${formatCompactDate(goal.targetDate)}` : 'sans date de fin'} <b>•</b> {formatDecimal(currentWeight)} kg actuellement</p></div><div className="objective-progress-ring" style={{ '--objective-progress': `${progress * 3.6}deg` } as CSSProperties}><div><strong>{formatNumber(progress)} %</strong><span>progression</span></div></div><button className="finish-objective" type="button" onClick={onFinish}><Archive /> Terminer</button></section>
}
function ObjectiveKpi({ icon, label, value, detail, tone = 'navy' }: { icon: ReactNode; label: string; value: string; detail: string; tone?: string }) { return <article className={`objective-kpi reference-card ${tone}`}><span>{icon}</span><div><small>{label}</small><strong>{value}</strong><p>{detail}</p></div></article> }

function GoalFields({ goal, onPatch }: { goal: FitnessGoal; onPatch: <K extends keyof FitnessGoal>(key: K, value: FitnessGoal[K]) => void }) {
  const bodyGoal = goal.type === 'fat-loss' || goal.type === 'lean-gain' || goal.type === 'maintenance'
  return <div className="goal-fields-grid">
    <Field label="Nom de l’objectif"><input value={goal.name} onChange={event => onPatch('name', event.target.value)} /></Field>
    <Field label="Type d’objectif"><select value={goal.type} onChange={event => onPatch('type', event.target.value as GoalType)}>{Object.entries(goalTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
    <Field label="Date de début"><input type="date" value={goal.startDate} onChange={event => onPatch('startDate', event.target.value)} /></Field>
    <Field label="Échéance"><input type="date" min={goal.startDate} value={goal.targetDate ?? ''} onChange={event => onPatch('targetDate', event.target.value || undefined)} /></Field>
    <NumberField label="Poids de référence" value={goal.referenceWeightKg} unit="kg" step="0.1" onChange={value => onPatch('referenceWeightKg', value)} />
    {bodyGoal && <NumberField label="Poids cible" value={goal.targetWeightKg} unit="kg" step="0.1" onChange={value => onPatch('targetWeightKg', value)} />}
    <NumberField label="Masse grasse de départ" value={goal.referenceBodyFatPercent} unit="%" step="0.1" onChange={value => onPatch('referenceBodyFatPercent', value)} />
    {goal.type === 'fat-loss' && <NumberField label="Masse grasse cible" value={goal.targetBodyFatPercent ?? Math.max(5, goal.referenceBodyFatPercent - 5)} unit="%" step="0.1" onChange={value => onPatch('targetBodyFatPercent', value)} />}
    <NumberField label="Taille" value={goal.heightCm} unit="cm" onChange={value => onPatch('heightCm', value)} />
    {goal.type === 'fat-loss' && <><NumberField label="Perte visée" value={Math.abs(goal.targetWeightChangeKgPerWeek)} unit="kg / sem." step="0.1" onChange={value => onPatch('targetWeightChangeKgPerWeek', -Math.abs(value))} />{Math.abs(goal.targetWeightChangeKgPerWeek) > .9 && <p className="pace-caution"><Info /> Rythme agressif : surveille la récupération et les performances.</p>}</>}
    {goal.type === 'lean-gain' && <><NumberField label="Gain visé" value={Math.abs(goal.targetWeightChangeKgPerWeek)} unit="kg / sem." step="0.1" onChange={value => onPatch('targetWeightChangeKgPerWeek', Math.abs(value))} /><NumberField label="Hausse de masse grasse max." value={goal.maxBodyFatIncreasePercent ?? 1} unit="point" step="0.1" onChange={value => onPatch('maxBodyFatIncreasePercent', value)} /></>}
    <Field label="Niveau d’entraînement"><select value={goal.trainingLevel} onChange={event => onPatch('trainingLevel', event.target.value as Profile['trainingLevel'])}><option value="beginner">Débutant</option><option value="intermediate">Intermédiaire</option><option value="advanced">Avancé</option></select></Field>
    {(goal.type === 'endurance' || goal.type === 'event') && <Field label="Discipline"><select value={goal.enduranceDiscipline ?? 'general'} onChange={event => onPatch('enduranceDiscipline', event.target.value as FitnessGoal['enduranceDiscipline'])}><option value="general">Forme générale</option><option value="running">Course à pied</option><option value="cycling">Vélo</option><option value="triathlon">Triathlon</option><option value="ironman">Ironman</option></select></Field>}
    {goal.type === 'event' && <Field label="Événement"><input placeholder="Ex. Ironman de Nice" value={goal.eventName ?? ''} onChange={event => onPatch('eventName', event.target.value)} /></Field>}
    {goal.type === 'strength' && <><Field label="Performance ciblée"><input placeholder="Ex. développé couché" value={goal.strengthExercise ?? ''} onChange={event => onPatch('strengthExercise', event.target.value)} /></Field><NumberField label="Charge cible" value={goal.strengthTargetKg ?? 0} unit="kg" step="0.5" onChange={value => onPatch('strengthTargetKg', value)} /></>}
  </div>
}

function PriorityPicker({ goal, onChange }: { goal: FitnessGoal; onChange: (priorities: GoalPriority[]) => void }) {
  const choices: [GoalPriority, string][] = [['body-composition','Composition'],['strength','Force'],['cardio','Cardio'],['explosiveness','Explosivité'],['event','Événement']]
  return <fieldset className="priority-picker"><legend>Priorités secondaires</legend><div>{choices.map(([value, label]) => { const selected = goal.priorities.includes(value); return <button type="button" aria-pressed={selected} key={value} onClick={() => onChange(selected ? goal.priorities.filter(item => item !== value) : [...goal.priorities, value])}>{selected && <Check />}{label}</button> })}</div></fieldset>
}

function PlanCapabilities({ type }: { type: GoalType }) {
  const copy: Record<GoalType, string[]> = {
    'fat-loss': ['Trajectoire de poids et masse grasse', 'Déficit et calories ajustées à l’activité', 'Musculation, cardio et récupération'],
    'lean-gain': ['Surplus calorique contrôlé', 'Garde-fou sur la masse grasse', 'Volume et performances de musculation'],
    maintenance: ['Zone de poids stable', 'Composition corporelle et habitudes', 'Cardio, explosivité et performances'],
    strength: ['Progression par exercice', 'Volume, tonnage et records', 'Poids et nutrition en soutien'],
    endurance: ['Minutes, distance, allure et watts', 'Charge cardio par semaine', 'Planning détaillé à construire dans Séances'],
    event: ['Compte à rebours jusqu’à l’épreuve', 'Course, vélo et charge hebdomadaire', 'Plan spécifique à construire dans Séances'],
  }
  return <ul>{copy[type].map(item => <li key={item}><Check />{item}</li>)}</ul>
}

function GoalHistory({ state }: { state: AppState }) {
  const history = state.goals.filter(goal => goal.status !== 'active').sort((a, b) => (b.endedAt ?? b.startDate).localeCompare(a.endedAt ?? a.startDate))
  return <section className="goal-history"><div className="history-heading"><div><h2>Historique des objectifs</h2><p>Retrouve les résultats et les habitudes de chaque phase terminée.</p></div><span>{history.length} cycle{history.length > 1 ? 's' : ''}</span></div>{history.length ? <div className="goal-history-grid">{history.map(goal => { const stats = goalStats(state, goal); const Icon = goalIcons[goal.type]; return <article className="history-goal-card reference-card" key={goal.id}><div className="history-goal-head"><span><Icon /></span><div><small>{goal.status === 'completed' ? 'TERMINÉ' : 'ANNULÉ'}</small><h3>{goal.name}</h3></div></div><p>{formatLongDate(goal.startDate)} → {goal.endedAt ? formatLongDate(goal.endedAt) : '—'}</p><div><span><b>{stats.durationDays}</b> jours</span><span><b>{stats.weightChange > 0 ? '+' : ''}{formatDecimal(stats.weightChange)}</b> kg</span><span><b>{stats.averageCalories ? formatNumber(stats.averageCalories) : '—'}</b> kcal moy.</span><span><b>{stats.trainingSessions}</b> séances</span></div></article> })}</div> : <div className="empty-goal-history"><Archive /> Les objectifs terminés apparaîtront ici avec leur durée, évolution de poids, calories moyennes et entraînements.</div>}</section>
}

function GoalCreator({ goal, activeGoal, onChange, onClose, onSubmit }: { goal: FitnessGoal; activeGoal?: FitnessGoal; onChange: (goal: FitnessGoal) => void; onClose: () => void; onSubmit: (event: FormEvent) => void }) {
  function patch<K extends keyof FitnessGoal>(key: K, value: FitnessGoal[K]) { let next = { ...goal, [key]: value }; if (key === 'type') next = normalizeGoalForType(next, value as GoalType); onChange(next) }
  return <div className="modal-backdrop objective-creator-backdrop" onClick={onClose}><form className="objective-creator" role="dialog" aria-modal="true" aria-labelledby="new-goal-title" onSubmit={onSubmit} onClick={event => event.stopPropagation()}><button className="modal-close" type="button" aria-label="Fermer" onClick={onClose}><X /></button><div className="creator-heading"><span><Flag /></span><div><h2 id="new-goal-title">Créer un nouvel objectif</h2><p>Choisis la finalité ; les champs et le suivi s’adaptent.</p></div></div>{activeGoal && <div className="creator-warning"><Info /> Ton objectif actuel sera archivé avec son bilan uniquement lorsque tu valideras le nouveau.</div>}<div className="goal-type-picker">{(Object.keys(goalTypeLabels) as GoalType[]).map(type => { const Icon = goalIcons[type]; return <button type="button" className={goal.type === type ? 'selected' : ''} aria-pressed={goal.type === type} key={type} onClick={() => patch('type', type)}><Icon /><span><strong>{goalTypeLabels[type]}</strong><small>{typeDescriptions[type]}</small></span>{goal.type === type && <Check />}</button> })}</div><GoalFields goal={goal} onPatch={patch} /><PriorityPicker goal={goal} onChange={priorities => patch('priorities', priorities)} /><div className="creator-actions"><button type="button" onClick={onClose}>Annuler</button><button type="submit"><Flag /> {activeGoal ? 'Archiver et démarrer' : 'Démarrer cet objectif'}</button></div></form></div>
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="goal-field"><span>{label}</span>{children}</label> }
function NumberField({ label, value, unit, step = '1', onChange }: { label: string; value: number; unit: string; step?: string; onChange: (value: number) => void }) { return <Field label={label}><span className="goal-number-input"><input type="number" inputMode="decimal" value={value} step={step} onChange={event => onChange(Number(event.target.value))} /><small>{unit}</small></span></Field> }
