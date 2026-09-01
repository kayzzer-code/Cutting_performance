import { useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, BarChart3, Bike, Cable, CalendarDays, Check, Dumbbell, Footprints, LogOut, ShieldCheck, SportShoe, Target, UserRound } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { addDays, formatDayName, isoDate } from '../domain/dates'
import { useApp } from '../state/AppContext'
import { CuttingPerformanceLogo } from '../components/BrandLogo'
import { adaptSettingsToProfile } from '../domain/planning'
import { formatNumber } from '../domain/format'

const steps = [{ label: 'Profil', path: 'profil' }, { label: 'Objectif', path: 'objectif' }, { label: 'Planning', path: 'planning' }, { label: 'Confirmation', path: 'confirmation' }]

export function OnboardingPage() {
  const { state, applyConfiguration, updateSchedule, completeOnboarding } = useApp()
  const location = useLocation()
  const navigate = useNavigate()
  const pathStep = steps.findIndex((step) => location.pathname.endsWith(step.path))
  const [step, setStep] = useState(pathStep >= 0 ? pathStep + 1 : 2)
  const [profile, setProfile] = useState(state.profile)
  const adaptedSettings = useMemo(() => adaptSettingsToProfile(state.profile, profile, state.settings), [profile, state.profile, state.settings])

  function go(next: number) { setStep(next); navigate(`/onboarding/${steps[next - 1].path}`) }
  function saveConfiguration() { applyConfiguration(profile, adaptedSettings) }
  function finish() { saveConfiguration(); completeOnboarding(); navigate('/aujourdhui') }

  return (
    <div className="onboarding-reference">
      <header className="onboarding-top"><CuttingPerformanceLogo variant="light"/><nav>{steps.map((item, index) => <button key={item.label} className={index + 1 === step ? 'active' : index + 1 < step ? 'complete' : ''} onClick={() => go(index + 1)}><span>{index + 1 < step ? <Check/> : index + 1}</span>{item.label}</button>)}</nav><button className="save-exit" onClick={() => { saveConfiguration(); navigate('/aujourdhui') }}><LogOut/> Enregistrer et quitter</button></header>
      <main className="onboarding-main">
        <div className="onboarding-title"><h1>{step === 1 ? 'Parlons de ton profil' : step === 2 ? 'Définissons ton objectif' : step === 3 ? 'Organisons ton planning' : 'Ton plan est prêt'}</h1><p>{step === 2 ? 'Ces informations servent à calculer une première cible. Elle sera recalibrée après 7 à 14 jours de données.' : 'Tes réponses sont sauvegardées et restent modifiables plus tard.'}</p></div>

        {(step === 1 || step === 2) && <section className="objective-form-card reference-card">
          <div className="objective-column"><h2><span><UserRound/></span> Profil actuel</h2><OnboardField label="Poids actuel" value={profile.currentWeightKg} unit="kg" onChange={(value) => setProfile({ ...profile, currentWeightKg: value, referenceWeightKg: value })}/><OnboardField label="Taille" value={profile.heightCm} unit="cm" onChange={(value) => setProfile({ ...profile, heightCm: value })}/><OnboardField label="Masse grasse estimée" value={profile.bodyFatPercent} unit="%" onChange={(value) => setProfile({ ...profile, bodyFatPercent: value })}/><OnboardField label="Expérience musculation" value={profile.experienceYears} unit="ans" onChange={(value) => setProfile({ ...profile, experienceYears: value })}/></div>
          <div className="objective-column"><h2><span><Target/></span> Objectif de sèche</h2><OnboardField label="Poids cible" value={profile.targetWeightKg} unit="kg" onChange={(value) => setProfile({ ...profile, targetWeightKg: value })}/><OnboardField label="Perte souhaitée" value={profile.weeklyLossTargetKg} unit="kg / semaine" onChange={(value) => setProfile({ ...profile, weeklyLossTargetKg: value })}/><OnboardField label="Durée estimée" value={Math.ceil((profile.currentWeightKg - profile.targetWeightKg) / Math.max(.1, profile.weeklyLossTargetKg))} unit="semaines" onChange={() => undefined}/><label className="loss-speed"><span>Allure de perte</span><input type="range" min="0.4" max="1" step="0.1" value={profile.weeklyLossTargetKg} onChange={(event) => setProfile({ ...profile, weeklyLossTargetKg: Number(event.target.value) })}/><div><span>0,4 kg</span><strong>{profile.weeklyLossTargetKg.toFixed(1).replace('.', ',')} kg / semaine</strong><span>1,0 kg</span></div></label>{profile.weeklyLossTargetKg > 0.9 && <p className="pace-caution"><ShieldCheck /> 1 kg / semaine est un rythme agressif : valide-le avec ta tendance réelle sur 7 à 14 jours.</p>}</div>
        </section>}

        {step === 3 && <section className="planning-onboarding-card reference-card"><h2><Dumbbell/> Planning de départ</h2>{Array.from({ length: 7 }, (_, index) => addDays(isoDate(), index)).map((date) => <label key={date}><span>{formatDayName(date)}</span><select value={state.schedule[date] ?? 'rest'} onChange={(event) => updateSchedule(date, event.target.value)}><option value="rest">Repos</option>{state.templates.map((template) => <option key={template.id} value={template.id}>{template.shortName}</option>)}</select><strong>{formatNumber(state.logs[date]?.targetSteps ?? state.settings.targetSteps)} pas</strong></label>)}</section>}

        {step === 4 && <section className="confirmation-onboarding-card reference-card"><ShieldCheck/><h2>Récapitulatif du plan</h2><div><span>Poids de départ<strong>{profile.currentWeightKg} kg</strong></span><span>Objectif<strong>{profile.targetWeightKg} kg</strong></span><span>Rythme<strong>{profile.weeklyLossTargetKg} kg / sem.</strong></span><span>Réévaluation<strong>7 à 14 jours</strong></span></div><p>Aucune poussée ne sera proposée jusqu’à modification explicite de la contrainte d’épaule.</p></section>}

        <section className="sport-organization"><h2><span><Dumbbell/></span> Organisation sportive</h2><div><span><Dumbbell/> Upper–Lower <Check/></span><span><CalendarDays/> 4–5 séances / semaine <Check/></span><span><Footprints/> Course à pied <Check/></span><span><Bike/> Vélo <Check/></span><span><Cable/> Corde à sauter <Check/></span><span><SportShoe/> Marche quotidienne <Check/></span></div></section>
        <div className="shoulder-constraint"><ShieldCheck/><Check/> Épaule gauche : éviter tous les mouvements de poussée</div>
        <section className="first-estimate reference-card"><div><span className="estimate-icon"><BarChart3/></span><strong>Première<br/>estimation</strong></div><div><span>Apport moyen</span><strong>{formatNumber(adaptedSettings.baseCalories)} <small>kcal / jour</small></strong></div><div><span>Pas cibles</span><strong>15 000–18 000 <small>/ jour</small></strong></div><div><span>Réévaluation après</span><strong>7 <small>jours</small></strong></div></section>
        <footer className="onboarding-actions-reference"><button disabled={step === 1} onClick={() => go(step - 1)}><ArrowLeft/> Retour</button>{step < 4 ? <button className="primary" onClick={() => { saveConfiguration(); go(step + 1) }}>Continuer vers {steps[step].label.toLowerCase()} <ArrowRight/></button> : <button className="primary" onClick={finish}>Accéder au tableau de bord <ArrowRight/></button>}</footer>
      </main>
    </div>
  )
}

function OnboardField({ label, value, unit, onChange }: { label: string; value: number; unit: string; onChange: (value: number) => void }) {
  return <label className="onboard-field"><span>{label}</span><input type="number" inputMode="decimal" step="0.1" value={value} onChange={(event) => onChange(Number(event.target.value))}/><small>{unit}</small></label>
}
