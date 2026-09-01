import { useState, type FormEvent } from 'react'
import { ChevronUp, Info, LockKeyhole, RotateCcw, Save, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { calculateDay } from '../domain/calculations'
import { targetDailyDeficit, adaptSettingsToProfile, estimatedBmr } from '../domain/planning'
import { createInitialState } from '../domain/seed'
import type { CalculationSettings, Profile } from '../domain/types'
import { useApp } from '../state/AppContext'
import { formatNumber } from '../domain/format'
import { useJournalDate } from '../hooks/useJournalDate'
import { journalLogForDate } from '../domain/journal'
import { ExplainedLabel } from '../components/HelpTooltip'

export function SettingsPage() {
  const { state, applyConfiguration, resetApp } = useApp()
  const { selectedDate } = useJournalDate()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<Profile>(state.profile)
  const [settings, setSettings] = useState<CalculationSettings>(state.settings)
  const [saved, setSaved] = useState(false)
  const log = journalLogForDate(state, selectedDate)
  const preview = calculateDay({ ...log, plannedBaseCalories: settings.dayTypePlans['shoulders-arms'].calories, targetSteps: settings.dayTypePlans['shoulders-arms'].steps }, profile, settings)

  function submit(event: FormEvent) { event.preventDefault(); applyConfiguration(profile, settings); setSaved(true); window.setTimeout(() => setSaved(false), 2200) }
  function patchProfile(key: keyof Profile, value: string | number) {
    const next = { ...profile, [key]: value } as Profile
    setProfile(next)
    if (key === 'bodyFatPercent' || key === 'weeklyLossTargetKg' || key === 'currentWeightKg') {
      setSettings(adaptSettingsToProfile(state.profile, next, state.settings))
    }
  }
  function patchSettings(key: keyof CalculationSettings, value: string | number) { setSettings((current) => ({ ...current, [key]: value })) }
  function patchDayPlan(key: keyof CalculationSettings['dayTypePlans'], calories: number) { setSettings((current) => ({ ...current, dayTypePlans: { ...current.dayTypePlans, [key]: { ...current.dayTypePlans[key], calories } } })) }
  function restore() { if (!window.confirm('Restaurer les valeurs conseillées dans le formulaire ? Tes journaux ne seront pas effacés.')) return; const initial = createInitialState(); setProfile(initial.profile); setSettings(initial.settings) }
  function restart() { if (!window.confirm('Effacer toutes les activités, calories, pesées et séances enregistrées, puis recommencer le paramétrage ?')) return; resetApp(); navigate('/onboarding/objectif') }

  return (
    <div className="reference-page settings-reference">
      <header className="reference-topbar page-title-topbar"><div className="title-stack"><h1>Paramètres et calculs</h1><p>Ton profil pilote le plan ; les estimations d’activité restent visibles et verrouillées</p></div><div className="recalibration-badge"><Info /> Prochain recalibrage : après 14 jours de données</div></header>
      <form className="reference-body settings-body" onSubmit={submit}>
        {saved && <div className="save-toast">Paramètres enregistrés.</div>}
        <div className="settings-reference-grid">
          <div className="settings-left-column">
            <section className="profile-settings-card reference-card"><h2><ExplainedLabel help="Ces informations déterminent l’estimation métabolique, le déficit théorique et la vitesse de perte demandée." placement="left">Profil et objectif</ExplainedLabel></h2><SettingsField label="Poids de référence" value={profile.referenceWeightKg} unit="kg" onChange={(value) => patchProfile('referenceWeightKg', value)} /><SettingsField label="Taille" value={profile.heightCm} unit="cm" onChange={(value) => patchProfile('heightCm', value)} /><SettingsField label="Masse grasse estimée" value={profile.bodyFatPercent} unit="%" onChange={(value) => patchProfile('bodyFatPercent', value)} /><SettingsField label="Poids cible" value={profile.targetWeightKg} unit="kg" tone onChange={(value) => patchProfile('targetWeightKg', value)} /><SettingsField label="Perte visée" value={profile.weeklyLossTargetKg} unit="kg / semaine" tone step="0.1" onChange={(value) => patchProfile('weeklyLossTargetKg', value)} />{profile.weeklyLossTargetKg > 0.9 && <p className="pace-caution"><Info /> Rythme agressif : surveille la récupération, les performances et la moyenne du poids sur 7 jours.</p>}<label className="settings-line"><span>Niveau d’entraînement</span><select value={profile.trainingLevel} onChange={(event) => patchProfile('trainingLevel', event.target.value)}><option value="advanced">Avancé</option><option value="intermediate">Intermédiaire</option><option value="beginner">Débutant</option></select></label></section>
            <section className="day-calories-card reference-card"><h2><ExplainedLabel help="Chaque type de journée possède une base calorique différente afin de refléter la séance prévue et son activité cible." placement="left">Calories du jour planifié</ExplainedLabel></h2><p className="auto-plan-note">Recalcul automatique selon le poids, la masse grasse et la perte visée. Tu peux ensuite affiner ces valeurs.</p>{([['lower','Lower','Base utilisée les jours d’entraînement du bas du corps.'],['upper','Upper','Base utilisée les jours d’entraînement du haut du corps.'],['shoulders-arms','Épaules–Bras','Base utilisée pour la séance épaules et bras sans mouvements de poussée.'],['rest','Repos','Base utilisée lorsqu’aucune séance de musculation n’est planifiée.']] as const).map(([key,label,help]) => <label key={key}><ExplainedLabel help={help} placement="left">{label}</ExplainedLabel><span className="day-calorie-input"><input aria-label={`Calories ${label}`} type="number" inputMode="numeric" step="50" value={settings.dayTypePlans[key].calories} onChange={(event) => patchDayPlan(key, Number(event.target.value))}/><small>kcal</small></span></label>)}</section>
          </div>
          <div className="settings-right-column">
            <section className="activity-settings-card reference-card"><h2><ExplainedLabel help="Paramètres utilisés pour transformer les pas, kilomètres et minutes de cardio en estimations de dépense." placement="left">Dépense d’activité</ExplainedLabel> <span className="fixed-coefficients"><LockKeyhole /> Coefficients intégrés</span></h2><p className="auto-plan-note">La marche, la course et la cadence sont des estimations techniques communes à tous les calculs ; elles ne sont pas modifiables depuis le formulaire.</p><SettingsField label="Marche" value={settings.walkKcalPer1000} unit="kcal / 1 000 pas" readOnly onChange={() => undefined} /><SettingsField label="Course" value={settings.runKcalPerKgKm} unit="kcal / kg / km" step="0.1" readOnly onChange={() => undefined} /><SettingsField label="Cadence estimée" value={settings.runCadenceSpm} unit="pas / min" readOnly onChange={() => undefined} /><SettingsField label="Restitution de l’excédent" value={Math.round(settings.reintegrationRate * 100)} unit="%" onChange={(value) => patchSettings('reintegrationRate', value / 100)} />
              <div className="restitution-range"><div><span>Plus prudent</span><span>Déficit constant</span></div><input type="range" min="0" max="100" value={Math.round(settings.reintegrationRate * 100)} onChange={(event) => patchSettings('reintegrationRate', Number(event.target.value) / 100)}/><strong style={{ left: `${Math.round(settings.reintegrationRate * 100)}%` }}>{Math.round(settings.reintegrationRate * 100)} %</strong></div>
              <SettingsField label="Plafond d’ajout" value={settings.positiveCap} unit="kcal" signed onChange={(value) => patchSettings('positiveCap', value)} /><SettingsField label="Réduction maximale" value={settings.negativeCap} unit="kcal" onChange={(value) => patchSettings('negativeCap', value)} /><SettingsField label="Arrondi" value={settings.roundingStep} unit="kcal" onChange={(value) => patchSettings('roundingStep', value)} />
            </section>
            <section className="formula-reference-card reference-card"><h2><ExplainedLabel help="La cible part du jour planifié puis restitue une partie de la différence entre activité réelle et activité déjà prévue." placement="left">Formule utilisée</ExplainedLabel> <ChevronUp /></h2><p><strong>Cible recalculée</strong> = calories du jour planifié + {Math.round(settings.reintegrationRate * 100)} % × (activité réelle − activité prévue)</p><small>Le plan journalier est adapté à partir de ton plan actuel, de la dépense métabolique estimée ({formatNumber(estimatedBmr(profile))} kcal) et d’un déficit théorique d’environ {formatNumber(targetDailyDeficit(profile))} kcal / jour. La séance prévue est incluse dans le type de jour. La course remplace ses pas estimés.</small><div className="formula-preview">Aperçu actuel : <strong>{formatNumber(preview.adjustedCalorieTarget)} kcal</strong> ({preview.appliedAdjustmentKcal >= 0 ? '+' : ''}{preview.appliedAdjustmentKcal} kcal)</div></section>
          </div>
        </div>
        <section className="settings-actions-reference"><button type="button" className="restore-button" onClick={restore}><RotateCcw /> Restaurer les valeurs conseillées</button><button type="submit" className="reference-action blue-action"><Save /> Enregistrer les paramètres</button></section>
        <section className="reset-data-card reference-card"><div><Trash2 /><span><strong>Recommencer avec un journal vide</strong><small>Efface les activités, calories, repas, pesées et séances, puis relance le paramétrage.</small></span></div><button type="button" onClick={restart}>Effacer mes données et recommencer</button></section>
      </form>
    </div>
  )
}

function SettingsField({ label, value, unit, onChange, step = '1', tone, signed, readOnly }: { label: string; value: number; unit: string; onChange: (value: number) => void; step?: string; tone?: boolean; signed?: boolean; readOnly?: boolean }) {
  return <label className="settings-line"><span>{label}</span><span className={`settings-input ${tone ? 'tone' : ''} ${readOnly ? 'is-readonly' : ''}`}><input aria-label={label} type="number" inputMode="decimal" step={step} value={value} readOnly={readOnly} onChange={(event) => onChange(Number(event.target.value))}/><small>{unit}</small>{signed && value > 0 && <i>+</i>}{readOnly && <LockKeyhole className="field-lock" />}</span></label>
}
