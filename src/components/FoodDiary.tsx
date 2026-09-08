import { useRef, useState, type FormEvent } from 'react'
import { Database, Keyboard, LoaderCircle, PackageSearch, Pencil, ScanBarcode, Trash2, Utensils } from 'lucide-react'
import { calculatePortion, foodReferenceToMeal, mealPer100, sumMealNutrition, type FoodPer100, type FoodReference } from '../domain/nutrition'
import type { DailyLog, Meal } from '../domain/types'
import { formatDecimal, formatNumber } from '../domain/format'
import { lookupFoodByBarcode, ProductNotFoundError } from '../services/openFoodFacts'
import { ExplainedLabel } from './HelpTooltip'

interface FoodDiaryProps {
  date: string
  log: DailyLog
  currentCalories: number
  setCurrentCalories: (value: number) => void
  updateLog: (date: string, patch: Partial<DailyLog>) => void
  onScan: () => void
}

const slotLabels: Record<NonNullable<Meal['mealSlot']>, string> = {
  breakfast: 'Petit-déjeuner',
  lunch: 'Déjeuner',
  snack: 'Collation',
  dinner: 'Dîner',
}

const blankPer100 = (): FoodPer100 => ({
  calories: null,
  proteinG: null,
  carbohydratesG: null,
  fatG: null,
  fiberG: null,
})

export function FoodDiary({ date, log, currentCalories, setCurrentCalories, updateLog, onScan }: FoodDiaryProps) {
  const [barcode, setBarcode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [food, setFood] = useState<FoodReference | null>(null)
  const [quantity, setQuantity] = useState(100)
  const [mealSlot, setMealSlot] = useState<NonNullable<Meal['mealSlot']>>('lunch')
  const [editingId, setEditingId] = useState<string | null>(null)
  const lookupSequence = useRef(0)
  const totals = sumMealNutrition(log.meals)
  const nonDetailedCalories = Math.max(0, currentCalories - totals.calories)
  const portion = food ? calculatePortion(food.per100, quantity) : null

  async function findBarcode(codeInput = barcode) {
    const request = ++lookupSequence.current
    setLoading(true)
    setError('')
    setNotice('')
    try {
      const result = await lookupFoodByBarcode(codeInput)
      if (request !== lookupSequence.current) return
      setBarcode(result.barcode ?? codeInput)
      setFood(result)
      setQuantity(100)
      setEditingId(null)
    } catch (cause) {
      if (request !== lookupSequence.current) return
      setFood(null)
      setError(cause instanceof ProductNotFoundError || cause instanceof Error ? cause.message : 'Impossible de récupérer ce produit.')
    } finally {
      if (request === lookupSequence.current) setLoading(false)
    }
  }

  function startManualFood() {
    lookupSequence.current += 1
    setLoading(false)
    setError('')
    setNotice('')
    setEditingId(null)
    setFood({ name: '', source: 'manual', unit: 'g', per100: blankPer100() })
    setQuantity(100)
  }

  function editFood(meal: Meal) {
    setError('')
    setNotice('')
    setEditingId(meal.id)
    setBarcode(meal.barcode ?? '')
    setQuantity(meal.quantity ?? 100)
    setMealSlot(meal.mealSlot ?? 'lunch')
    setFood({
      barcode: meal.barcode,
      name: meal.name,
      brand: meal.brand,
      imageUrl: meal.imageUrl,
      source: meal.source ?? 'manual',
      unit: meal.quantityUnit ?? 'g',
      per100: mealPer100(meal),
    })
  }

  function saveFood(event: FormEvent) {
    event.preventDefault()
    if (!food || !food.name.trim() || quantity <= 0 || food.per100.calories === null) {
      setError('Renseigne au minimum le nom, la quantité et les calories pour 100 g ou 100 ml.')
      return
    }
    const previous = editingId ? log.meals.find((meal) => meal.id === editingId) : undefined
    const meal = foodReferenceToMeal(food, quantity, mealSlot, editingId ?? 'meal-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7))
    const meals = editingId
      ? log.meals.map((candidate) => candidate.id === editingId ? meal : candidate)
      : [...log.meals, meal]
    const nextCalories = Math.max(0, currentCalories - (previous?.calories ?? 0) + meal.calories)
    updateLog(date, { meals, caloriesConsumed: nextCalories })
    setCurrentCalories(nextCalories)
    setFood(null)
    setEditingId(null)
    setBarcode('')
    setNotice(editingId ? 'Aliment modifié et totaux recalculés.' : 'Aliment ajouté à la journée.')
  }

  function removeFood(meal: Meal) {
    const nextCalories = Math.max(0, currentCalories - meal.calories)
    updateLog(date, { meals: log.meals.filter((candidate) => candidate.id !== meal.id), caloriesConsumed: nextCalories })
    setCurrentCalories(nextCalories)
    if (editingId === meal.id) { setFood(null); setEditingId(null) }
    setNotice(meal.name + ' a été retiré de la journée.')
  }

  function updatePer100(field: keyof FoodPer100, value: string) {
    setFood((current) => current ? {
      ...current,
      per100: { ...current.per100, [field]: value === '' ? null : Math.max(0, Number(value)) },
    } : current)
  }

  return <div className="food-diary-layout">
    <section className="food-diary-card reference-card">
      <div className="food-diary-heading">
        <div>
          <h2><ExplainedLabel help="Somme des aliments détaillés pour cette date. Les calories saisies uniquement dans le mode rapide restent comptées à part." placement="left">Journal alimentaire</ExplainedLabel></h2>
          <p>{formatNumber(totals.calories)} kcal détaillées{nonDetailedCalories > 0 ? ' • ' + formatNumber(nonDetailedCalories) + ' kcal non détaillées' : ''}</p>
        </div>
        <button className="scan-food-button" type="button" onClick={onScan}><ScanBarcode /> Scanner</button>
      </div>

      <div className="macro-summary-grid" aria-label="Macronutriments détaillés">
        <MacroSummary label="Protéines" value={totals.proteinG} unit="g" tone="blue" />
        <MacroSummary label="Glucides" value={totals.carbohydratesG} unit="g" tone="teal" />
        <MacroSummary label="Lipides" value={totals.fatG} unit="g" tone="orange" />
        <MacroSummary label="Fibres" value={totals.fiberG} unit="g" tone="navy" />
      </div>

      {notice && <div className="food-notice" role="status">{notice}</div>}
      {log.meals.length === 0 ? <div className="empty-food-diary">
        <Utensils />
        <strong>Aucun aliment détaillé</strong>
        <p>Scanne un produit ou saisis-le manuellement pour commencer à suivre tes macros.</p>
      </div> : <div className="food-entry-list">
        {(['breakfast', 'lunch', 'snack', 'dinner'] as const).map((slot) => {
          const meals = log.meals.filter((meal) => (meal.mealSlot ?? 'lunch') === slot)
          if (!meals.length) return null
          return <section className="meal-slot-group" key={slot}>
            <h3>{slotLabels[slot]} <span>{formatNumber(meals.reduce((sum, meal) => sum + meal.calories, 0))} kcal</span></h3>
            {meals.map((meal) => <article className="food-entry" key={meal.id}>
              <div className="food-entry-image">{meal.imageUrl ? <img src={meal.imageUrl} alt="" /> : <PackageSearch />}</div>
              <div className="food-entry-main"><strong>{meal.name}</strong><span>{meal.brand ? meal.brand + ' • ' : ''}{meal.quantity ? formatDecimal(meal.quantity) + ' ' + (meal.quantityUnit ?? 'g') : 'Quantité non renseignée'}</span></div>
              <div className="food-entry-macros"><span>P {formatMacro(meal.proteinG)}</span><span>G {formatMacro(meal.carbohydratesG)}</span><span>L {formatMacro(meal.fatG)}</span><span>F {formatMacro(meal.fiberG)}</span></div>
              <strong className="food-entry-calories">{formatNumber(meal.calories)} <small>kcal</small></strong>
              <div className="food-entry-actions"><button type="button" aria-label={'Modifier ' + meal.name} onClick={() => editFood(meal)}><Pencil /></button><button type="button" aria-label={'Supprimer ' + meal.name} onClick={() => removeFood(meal)}><Trash2 /></button></div>
            </article>)}
          </section>
        })}
      </div>}
    </section>

    <aside className="food-add-card reference-card">
      <div className="food-add-heading"><span><Database /></span><div><h2>Ajouter un aliment</h2><p>Open Food Facts + saisie manuelle</p></div></div>
      <div className="food-source-actions">
        <button type="button" className="scan-source-action" onClick={onScan}><ScanBarcode /><span><strong>Scanner le code-barres</strong><small>Avec la caméra du téléphone</small></span></button>
        <form className="barcode-manual-form" onSubmit={(event) => { event.preventDefault(); void findBarcode() }}>
          <label htmlFor="barcode-input">Code-barres</label>
          <div><Keyboard /><input id="barcode-input" aria-label="Code-barres du produit" inputMode="numeric" autoComplete="off" placeholder="Ex. 3017624010701" value={barcode} onChange={(event) => setBarcode(event.target.value.replace(/\D/g, ''))} /><button type="submit" disabled={loading || !barcode}>{loading ? <LoaderCircle className="spin" /> : 'Rechercher'}</button></div>
        </form>
        {!food && <button className="manual-food-action" type="button" onClick={startManualFood}><Pencil /> Créer un aliment manuellement</button>}
      </div>

      {error && <div className="food-error" role="alert"><PackageSearch /><span>{error}</span><button type="button" onClick={startManualFood}>Saisir manuellement</button></div>}

      {food && <form className="food-product-editor" onSubmit={saveFood}>
        <div className="food-product-identity">
          <div className="product-image">{food.imageUrl ? <img src={food.imageUrl} alt="" /> : <PackageSearch />}</div>
          <div><span>{food.source === 'open-food-facts' ? 'Produit trouvé' : 'Aliment personnalisé'}</span><input aria-label="Nom de l’aliment" required placeholder="Nom de l’aliment" value={food.name} onChange={(event) => setFood({ ...food, name: event.target.value })} />{food.brand && <small>{food.brand}</small>}</div>
        </div>

        <div className="food-form-grid">
          <label>Moment<select aria-label="Moment du repas" value={mealSlot} onChange={(event) => setMealSlot(event.target.value as NonNullable<Meal['mealSlot']>)}>{Object.entries(slotLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
          <label>Quantité<span className="unit-input"><input aria-label="Quantité consommée" required type="number" inputMode="decimal" min="0.1" max="10000" step="0.1" value={quantity || ''} onChange={(event) => setQuantity(Number(event.target.value))} /><small>{food.unit}</small></span></label>
        </div>

        <fieldset className="per100-fields">
          <legend>Valeurs pour 100 {food.unit}</legend>
          <NutrientInput label="Calories" ariaLabel="Calories pour 100" value={food.per100.calories} unit="kcal" required onChange={(value) => updatePer100('calories', value)} />
          <NutrientInput label="Protéines" ariaLabel="Protéines pour 100" value={food.per100.proteinG} unit="g" onChange={(value) => updatePer100('proteinG', value)} />
          <NutrientInput label="Glucides" ariaLabel="Glucides pour 100" value={food.per100.carbohydratesG} unit="g" onChange={(value) => updatePer100('carbohydratesG', value)} />
          <NutrientInput label="Lipides" ariaLabel="Lipides pour 100" value={food.per100.fatG} unit="g" onChange={(value) => updatePer100('fatG', value)} />
          <NutrientInput label="Fibres" ariaLabel="Fibres pour 100" value={food.per100.fiberG} unit="g" onChange={(value) => updatePer100('fiberG', value)} />
        </fieldset>

        <div className="portion-preview">
          <span>Pour {formatDecimal(quantity)} {food.unit}</span>
          <strong>{formatNumber(portion?.calories ?? 0)} kcal</strong>
          <div><span>P {formatMacro(portion?.proteinG)}</span><span>G {formatMacro(portion?.carbohydratesG)}</span><span>L {formatMacro(portion?.fatG)}</span><span>F {formatMacro(portion?.fiberG)}</span></div>
        </div>
        {food.source === 'open-food-facts' && <p className="off-attribution">Données fournies par <a href="https://world.openfoodfacts.org/" target="_blank" rel="noreferrer">Open Food Facts</a> — à vérifier avec l’étiquette.</p>}
        <div className="food-editor-actions"><button type="button" onClick={() => { setFood(null); setEditingId(null); setError('') }}>Annuler</button><button type="submit">{editingId ? 'Enregistrer les modifications' : 'Ajouter à la journée'}</button></div>
      </form>}
    </aside>
  </div>
}

function MacroSummary({ label, value, unit, tone }: { label: string; value: number; unit: string; tone: string }) {
  return <div className={'macro-summary macro-' + tone}><span>{label}</span><strong>{formatDecimal(value)} <small>{unit}</small></strong></div>
}

function NutrientInput({ label, ariaLabel, value, unit, required = false, onChange }: { label: string; ariaLabel: string; value: number | null; unit: string; required?: boolean; onChange: (value: string) => void }) {
  return <label>{label}<span className="unit-input"><input aria-label={ariaLabel} required={required} type="number" inputMode="decimal" min="0" max="10000" step="0.1" value={value ?? ''} placeholder="—" onChange={(event) => onChange(event.target.value)} /><small>{unit}</small></span></label>
}

function formatMacro(value: number | undefined): string {
  return value === undefined ? '—' : formatDecimal(value) + ' g'
}
