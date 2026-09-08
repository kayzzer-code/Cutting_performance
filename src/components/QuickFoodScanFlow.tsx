import { useRef, useState, type FormEvent } from 'react'
import { CalendarDays, Check, Keyboard, LoaderCircle, PackageSearch, RotateCcw, ScanBarcode, X } from 'lucide-react'
import { calculatePortion, foodReferenceToMeal, type FoodReference, type MealSlot } from '../domain/nutrition'
import { formatLongDate } from '../domain/dates'
import { formatDecimal, formatNumber } from '../domain/format'
import { journalLogForDate } from '../domain/journal'
import { ProductNotFoundError, lookupFoodByBarcode } from '../services/openFoodFacts'
import { useApp } from '../state/AppContext'
import { BarcodeScannerModal } from './BarcodeScannerModal'

interface QuickFoodScanFlowProps {
  date: string
  onClose: () => void
  onAdded: (message: string) => void
}

type ScanStep = 'camera' | 'manual' | 'loading' | 'product' | 'error'

const mealSlotLabels: Record<MealSlot, string> = {
  breakfast: 'Petit-déjeuner',
  lunch: 'Déjeuner',
  snack: 'Collation',
  dinner: 'Dîner',
}

export function QuickFoodScanFlow({ date, onClose, onAdded }: QuickFoodScanFlowProps) {
  const { state, updateLog } = useApp()
  const [step, setStep] = useState<ScanStep>('camera')
  const [barcode, setBarcode] = useState('')
  const [food, setFood] = useState<FoodReference | null>(null)
  const [quantity, setQuantity] = useState(100)
  const [mealSlot, setMealSlot] = useState<MealSlot>('lunch')
  const [error, setError] = useState('')
  const requestSequence = useRef(0)
  const portion = food ? calculatePortion(food.per100, quantity) : null

  async function search(codeInput: string) {
    const request = ++requestSequence.current
    const cleaned = codeInput.replace(/\D/g, '')
    setBarcode(cleaned)
    setError('')
    setStep('loading')
    try {
      const result = await lookupFoodByBarcode(cleaned)
      if (request !== requestSequence.current) return
      setFood(result)
      setQuantity(100)
      setStep('product')
    } catch (cause) {
      if (request !== requestSequence.current) return
      setError(cause instanceof ProductNotFoundError || cause instanceof Error ? cause.message : 'Impossible de récupérer ce produit.')
      setStep('error')
    }
  }

  function submitBarcode(event: FormEvent) {
    event.preventDefault()
    void search(barcode)
  }

  function addFood(event: FormEvent) {
    event.preventDefault()
    if (!food || quantity <= 0 || food.per100.calories === null) return
    const log = journalLogForDate(state, date)
    const meal = foodReferenceToMeal(food, quantity, mealSlot, 'meal-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7))
    updateLog(date, {
      meals: [...log.meals, meal],
      caloriesConsumed: (log.caloriesConsumed ?? 0) + meal.calories,
    })
    onAdded(`${food.name} ajouté : ${formatNumber(meal.calories)} kcal`)
  }

  if (step === 'camera') {
    return <BarcodeScannerModal onClose={onClose} onDetected={(value) => void search(value)} onManual={() => setStep('manual')} />
  }

  return <div className="modal-backdrop quick-scan-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="quick-food-modal" role="dialog" aria-modal="true" aria-labelledby="quick-food-title">
      <button className="modal-close" type="button" aria-label="Fermer l’ajout rapide" onClick={onClose}><X /></button>

      {step === 'loading' && <div className="quick-scan-loading" role="status">
        <span><LoaderCircle className="spin" /></span>
        <h2 id="quick-food-title">Recherche du produit…</h2>
        <p>Code-barres {barcode}</p>
      </div>}

      {(step === 'manual' || step === 'error') && <div className="quick-scan-manual">
        <span className="quick-scan-hero-icon"><Keyboard /></span>
        <h2 id="quick-food-title">Saisir un code-barres</h2>
        <p>Entre les chiffres présents sous le code-barres.</p>
        {step === 'error' && <div className="quick-scan-error" role="alert"><PackageSearch /><span>{error}</span></div>}
        <form onSubmit={submitBarcode}>
          <label htmlFor="global-barcode">Code-barres du produit</label>
          <input id="global-barcode" inputMode="numeric" autoComplete="off" placeholder="Ex. 3502110008039" value={barcode} onChange={(event) => setBarcode(event.target.value.replace(/\D/g, ''))} autoFocus />
          <button type="submit" disabled={!barcode}><ScanBarcode /> Rechercher le produit</button>
        </form>
        <button className="quick-rescan-action" type="button" onClick={() => setStep('camera')}><RotateCcw /> Relancer la caméra</button>
      </div>}

      {step === 'product' && food && portion && <form className="quick-product-form" onSubmit={addFood}>
        <header className="quick-product-header">
          <div className="quick-product-image">{food.imageUrl ? <img src={food.imageUrl} alt="" /> : <PackageSearch />}</div>
          <div><span>Produit détecté</span><h2 id="quick-food-title">{food.name}</h2>{food.brand && <p>{food.brand}</p>}</div>
        </header>

        <div className="quick-product-date"><CalendarDays /><span>Ajouté au journal du</span><strong>{formatLongDate(date)}</strong></div>

        <div className="quick-product-reference" aria-label={`Valeurs nutritionnelles pour 100 ${food.unit}`}>
          <QuickNutrient label="Calories" value={food.per100.calories} unit="kcal" />
          <QuickNutrient label="Protéines" value={food.per100.proteinG} unit="g" />
          <QuickNutrient label="Glucides" value={food.per100.carbohydratesG} unit="g" />
          <QuickNutrient label="Lipides" value={food.per100.fatG} unit="g" />
          <QuickNutrient label="Fibres" value={food.per100.fiberG} unit="g" />
        </div>
        <small className="quick-reference-caption">Valeurs pour 100 {food.unit} • vérifie avec l’étiquette</small>

        <div className="quick-product-inputs">
          <label>Quantité consommée<span className="quick-quantity-input"><input aria-label="Quantité consommée après le scan" required type="number" inputMode="decimal" min="0.1" max="10000" step="0.1" value={quantity || ''} onChange={(event) => setQuantity(Number(event.target.value))} autoFocus /><small>{food.unit}</small></span></label>
          <label>Repas<select aria-label="Repas après le scan" value={mealSlot} onChange={(event) => setMealSlot(event.target.value as MealSlot)}>{Object.entries(mealSlotLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        </div>

        <div className="quick-portion-result">
          <div><span>Pour {formatDecimal(quantity)} {food.unit}</span><strong>{formatNumber(portion.calories)} <small>kcal</small></strong></div>
          <div className="quick-portion-macros"><span>P <b>{macroValue(portion.proteinG)}</b></span><span>G <b>{macroValue(portion.carbohydratesG)}</b></span><span>L <b>{macroValue(portion.fatG)}</b></span><span>F <b>{macroValue(portion.fiberG)}</b></span></div>
        </div>

        {food.per100.calories === null && <div className="quick-scan-error"><PackageSearch /><span>Les calories sont absentes de la fiche. Ajoute cet aliment manuellement depuis Nutrition.</span></div>}
        <div className="quick-product-actions"><button type="button" onClick={() => setStep('camera')}><RotateCcw /> Re-scanner</button><button type="submit" disabled={food.per100.calories === null || quantity <= 0}><Check /> Ajouter à la journée</button></div>
      </form>}
    </section>
  </div>
}
function QuickNutrient({ label, value, unit }: { label: string; value: number | null; unit: string }) {
  return <div><span>{label}</span><strong>{value === null ? '—' : formatDecimal(value)} <small>{unit}</small></strong></div>
}

function macroValue(value: number | undefined): string {
  return value === undefined ? '—' : formatDecimal(value) + ' g'
}
