import { useState, type FormEvent } from 'react'
import { Crosshair, Flame, Info, Pencil, Plus, Save, TrendingUp, Utensils } from 'lucide-react'
import { calculateDay, calculateWeeklyMargin } from '../domain/calculations'
import { formatLongDate, weekDates } from '../domain/dates'
import { useApp } from '../state/AppContext'
import { formatNumber } from '../domain/format'
import { useJournalDate } from '../hooks/useJournalDate'
import { journalLogForDate } from '../domain/journal'
import { ExplainedLabel } from '../components/HelpTooltip'

export function NutritionPage() {
  const { state, setCalories, addMeal, updateLog, setWeeklyStrategy } = useApp()
  const { selectedDate } = useJournalDate()
  const log = journalLogForDate(state, selectedDate)
  const calc = calculateDay(log, state.profile, state.settings)
  const [calories, setCaloriesInput] = useState(log.caloriesConsumed ?? 0)
  const [mealOpen, setMealOpen] = useState(false)
  const [mealName, setMealName] = useState('')
  const [mealCalories, setMealCalories] = useState(0)
  const [editingMealId, setEditingMealId] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const weekLogs = weekDates(selectedDate).map((date) => journalLogForDate(state, date))
  const weeklyMargin = calculateWeeklyMargin(weekLogs, state.profile, state.settings)
  const marginBefore = weeklyMargin + (log.caloriesConsumed ?? 0)
  const projectedMargin = marginBefore - calories
  const remaining = calc.adjustedCalorieTarget - calories
  const remainingDays = Math.max(1, weekDates(selectedDate).filter((date) => date > selectedDate).length)
  const suggestion = Math.round(projectedMargin / remainingDays / 10) * 10

  function saveTotal(event: FormEvent) {
    event.preventDefault()
    setCalories(selectedDate, Math.max(0, calories))
    setSaved(true)
    window.setTimeout(() => setSaved(false), 2200)
  }

  function saveMeal(event: FormEvent) {
    event.preventDefault()
    if (!mealName.trim() || mealCalories <= 0) return
    if (editingMealId) {
      const existing = log.meals.find((meal) => meal.id === editingMealId)
      if (!existing) return
      const nextTotal = Math.max(0, calories - existing.calories + mealCalories)
      updateLog(selectedDate, {
        meals: log.meals.map((meal) => meal.id === editingMealId ? { ...meal, name: mealName.trim(), calories: mealCalories } : meal),
        caloriesConsumed: nextTotal,
      })
      setCaloriesInput(nextTotal)
    } else {
      addMeal(selectedDate, mealName.trim(), mealCalories)
      setCaloriesInput((value) => value + mealCalories)
    }
    setMealName('')
    setMealCalories(0)
    setEditingMealId(null)
    setMealOpen(false)
  }

  return (
    <div className="reference-page nutrition-reference">
      <header className="reference-topbar page-title-topbar"><div className="title-stack"><h1>Calories du jour</h1><p>{formatLongDate(selectedDate)} <b>•</b> Cible recalculée après activité</p></div></header>
      <div className="reference-body nutrition-body">
        {saved && <div className="save-toast">Calories enregistrées dans le bilan de la semaine.</div>}
        <section className="nutrition-summary-strip reference-card">
          <SummaryMetric icon={<Crosshair />} label="Cible du jour" value={calc.adjustedCalorieTarget} tone="teal" help="Apport calorique recommandé après recalcul avec les activités enregistrées pour cette date." placement="left" />
          <SummaryMetric icon={<Utensils />} label="Déjà consommé" value={calories} tone="navy" help="Total calorique actuellement saisi, soit directement, soit par addition des repas." />
          <SummaryMetric icon={<Flame />} label={remaining >= 0 ? 'Reste pour cette date' : 'Dépassé pour cette date'} value={Math.abs(remaining)} tone={remaining >= 0 ? 'teal' : 'orange'} help="Différence entre la cible recalculée et les calories saisies. Elle devient un dépassement lorsque le total consommé dépasse la cible." placement="right" />
        </section>

        <section className="nutrition-main-grid">
          <form className="quick-calorie-card reference-card" onSubmit={saveTotal}>
            <h2><ExplainedLabel help="Tu peux saisir seulement le total de la journée. La répartition par repas reste facultative." placement="left">Saisie rapide</ExplainedLabel></h2>
            <label className="giant-calorie-input"><input aria-label="Calories consommées aujourd’hui" type="number" inputMode="numeric" min="0" step="10" value={calories} onChange={(event) => setCaloriesInput(Number(event.target.value))} /><span>kcal consommées<br/>pour cette date</span></label>
            <div className="quick-add-row"><button type="button" onClick={() => setCaloriesInput((value) => value + 100)}>+100</button><button type="button" onClick={() => setCaloriesInput((value) => value + 250)}>+250</button><button type="button" onClick={() => setCaloriesInput((value) => value + 500)}>+500</button><button type="button" onClick={() => setCaloriesInput(0)}>Remplacer la valeur</button></div>
            <div className="meal-heading"><ExplainedLabel help="Les repas servent uniquement à détailler le total. Le suivi fonctionne même si tu ne renseignes que les calories quotidiennes." placement="left">Répartition par repas (optionnelle)</ExplainedLabel><button type="button" onClick={() => setMealOpen((value) => !value)}><Plus /> Ajouter</button></div>
            <div className="reference-meal-list">
              {log.meals.length === 0 ? <div className="empty-meal">Aucun repas détaillé — seul le total quotidien est requis.</div> : log.meals.map((meal) => <div key={meal.id}><Utensils /><span>{meal.name}</span><strong>{formatNumber(meal.calories)} kcal</strong><button type="button" aria-label={`Modifier ${meal.name}`} onClick={() => { setMealName(meal.name); setMealCalories(meal.calories); setEditingMealId(meal.id); setMealOpen(true) }}><Pencil /></button></div>)}
            </div>
            {mealOpen && <div className="inline-meal-editor"><input aria-label="Nom du repas" placeholder="Nom du repas" value={mealName} onChange={(event) => setMealName(event.target.value)} /><span className="unit-input"><input aria-label="Calories du repas" type="number" inputMode="numeric" min="0" value={mealCalories} onChange={(event) => setMealCalories(Number(event.target.value))} /><small>kcal</small></span><button type="button" onClick={saveMeal}>{editingMealId ? 'Modifier' : 'Ajouter'}</button></div>}
            <p className="small-info"><Info /> Seul le total quotidien est requis.</p>
            <button className="reference-action teal-action" type="submit"><Save /><span>Enregistrer {formatNumber(calories)} kcal</span></button>
          </form>

          <div className="nutrition-week-column">
            <section className="weekly-impact-card reference-card">
              <h2><ExplainedLabel help="Montre comment la saisie de cette date modifie le cumul calorique de toute la semaine sélectionnée." placement="left">Impact sur la semaine</ExplainedLabel></h2>
              <div className="vertical-equation"><div><ExplainedLabel help="Marge hebdomadaire calculée avant d’intégrer la valeur actuellement présente dans le champ de saisie." placement="left">Solde avant saisie</ExplainedLabel><strong className="teal-text">{marginBefore >= 0 ? '+' : '−'}{formatNumber(Math.abs(marginBefore))} <small>kcal</small></strong></div><div><b>−</b><ExplainedLabel help="Calories que tu es sur le point d’enregistrer pour la date sélectionnée.">Calories saisies</ExplainedLabel><strong>−{formatNumber(calories)} <small>kcal</small></strong></div><div><b>=</b><ExplainedLabel help="Réserve ou dépassement cumulé après cette saisie. Positive : calories encore disponibles. Négative : cible hebdomadaire dépassée." placement="right">Marge hebdo disponible</ExplainedLabel><strong className="teal-text">{projectedMargin >= 0 ? '+' : '−'}{formatNumber(Math.abs(projectedMargin))} <small>kcal</small></strong></div></div>
              <div className="margin-choice"><button type="button" className={state.weeklyStrategy === 'even' ? 'active' : ''} onClick={() => setWeeklyStrategy('even')}><i /> Garder la marge</button><button type="button" className={state.weeklyStrategy === 'flexible' ? 'active' : ''} onClick={() => setWeeklyStrategy('flexible')}><i /> Répartir sur les jours restants</button></div>
            </section>
            <section className="weekly-suggestion-card"><div className="suggestion-head"><span className="suggestion-icon"><TrendingUp /></span><div><ExplainedLabel help="Répartition indicative de la marge restante sur les jours suivants de la semaine sélectionnée." placement="right">Suggestion :</ExplainedLabel><strong>{suggestion >= 0 ? '+' : '−'}{formatNumber(Math.abs(suggestion))} <small>kcal</small></strong><p>sur chacun des {remainingDays} prochains jours</p></div></div><p><Info /> La compensation hebdomadaire ne modifie pas automatiquement les repas déjà enregistrés.</p></section>
          </div>
        </section>
      </div>
    </div>
  )
}

function SummaryMetric({ icon, label, value, tone, help, placement = 'center' }: { icon: React.ReactNode; label: string; value: number; tone: string; help: string; placement?: 'left' | 'center' | 'right' }) {
  return <div className={`nutrition-summary-metric metric-${tone}`}><span className="hero-icon-circle">{icon}</span><div><ExplainedLabel help={help} placement={placement}>{label}</ExplainedLabel><strong>{formatNumber(value)} <small>kcal</small></strong></div></div>
}
