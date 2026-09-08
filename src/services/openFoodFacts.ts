import type { FoodReference } from '../domain/nutrition'

export class ProductNotFoundError extends Error {
  constructor() { super('Ce produit n’est pas encore référencé dans Open Food Facts.') }
}

export async function lookupFoodByBarcode(barcodeInput: string): Promise<FoodReference> {
  const barcode = barcodeInput.replace(/\D/g, '')
  if (!/^\d{8,14}$/.test(barcode)) throw new Error('Le code-barres doit contenir entre 8 et 14 chiffres.')
  const fields = 'code,product_name,brands,image_front_small_url,serving_size,quantity,product_quantity_unit,nutriments'
  const response = await fetch(`/api/open-food-facts/${encodeURIComponent(barcode)}?fields=${fields}`)
  if (response.status === 404) throw new ProductNotFoundError()
  if (!response.ok) throw new Error('Open Food Facts est momentanément indisponible. Réessaie ou saisis le produit manuellement.')
  const data: unknown = await response.json()
  const product = normalizeOpenFoodFactsProduct(data, barcode)
  if (!product) throw new ProductNotFoundError()
  return product
}

export function normalizeOpenFoodFactsProduct(input: unknown, fallbackBarcode = ''): FoodReference | null {
  if (!isRecord(input) || !isRecord(input.product)) return null
  if (isRecord(input.result) && input.result.id !== undefined && input.result.id !== 'product_found') return null
  const product = input.product
  const nutriments = isRecord(product.nutriments) ? product.nutriments : {}
  const barcode = stringValue(product.code) || fallbackBarcode
  const name = stringValue(product.product_name) || stringValue(product.brands) || (barcode ? `Produit ${barcode}` : '')
  if (!name) return null
  const productUnit = stringValue(product.product_quantity_unit).toLowerCase()
  return {
    barcode: barcode || undefined,
    name,
    brand: stringValue(product.brands) || undefined,
    imageUrl: stringValue(product.image_front_small_url) || undefined,
    source: 'open-food-facts',
    unit: productUnit === 'ml' ? 'ml' : 'g',
    per100: {
      calories: numberValue(nutriments['energy-kcal_100g']),
      proteinG: numberValue(nutriments.proteins_100g),
      carbohydratesG: numberValue(nutriments.carbohydrates_100g),
      fatG: numberValue(nutriments.fat_100g),
      fiberG: numberValue(nutriments.fiber_100g),
    },
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}
