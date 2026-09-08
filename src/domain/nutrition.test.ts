import { describe, expect, it } from 'vitest'
import { calculatePortion, foodReferenceToMeal, sumMealNutrition } from './nutrition'
import { normalizeOpenFoodFactsProduct } from '../services/openFoodFacts'

describe('suivi nutritionnel détaillé', () => {
  it('calcule une portion depuis les valeurs pour 100 g', () => {
    expect(calculatePortion({ calories: 81, proteinG: 5.4, carbohydratesG: 9.7, fatG: 0.4, fiberG: 5.5 }, 250)).toEqual({
      calories: 203, proteinG: 13.5, carbohydratesG: 24.3, fatG: 1, fiberG: 13.8,
    })
  })

  it('distingue une valeur nutritionnelle absente d’un zéro', () => {
    expect(calculatePortion({ calories: 100, proteinG: null, carbohydratesG: 0, fatG: null, fiberG: null }, 50)).toEqual({
      calories: 50, proteinG: undefined, carbohydratesG: 0, fatG: undefined, fiberG: undefined,
    })
  })

  it('normalise une réponse Open Food Facts', () => {
    const product = normalizeOpenFoodFactsProduct({ result: { id: 'product_found' }, product: {
      code: '3017624010701', product_name: 'Petits pois', brands: 'Exemple', product_quantity_unit: 'g',
      nutriments: { 'energy-kcal_100g': 81, proteins_100g: 5.4, carbohydrates_100g: 9.7, fat_100g: 0.4, fiber_100g: 5.5 },
    } })
    expect(product).toMatchObject({ barcode: '3017624010701', name: 'Petits pois', brand: 'Exemple', source: 'open-food-facts', unit: 'g', per100: { calories: 81, proteinG: 5.4 } })
  })

  it('additionne uniquement les macros présentes dans les aliments détaillés', () => {
    expect(sumMealNutrition([
      { id: 'a', name: 'A', calories: 200, proteinG: 10, carbohydratesG: 20, fatG: 5, fiberG: 3 },
      { id: 'b', name: 'B', calories: 100, proteinG: 4 },
    ])).toEqual({ calories: 300, proteinG: 14, carbohydratesG: 20, fatG: 5, fiberG: 3 })
  })

  it('transforme le produit scanné en entrée de journal complète', () => {
    expect(foodReferenceToMeal({
      barcode: '3560070973570', name: 'Petits pois', brand: 'Exemple', unit: 'g', source: 'open-food-facts', imageUrl: '',
      per100: { calories: 81, proteinG: 5.4, carbohydratesG: 9.7, fatG: 0.4, fiberG: 5.5 },
    }, 250, 'lunch', 'meal-1')).toMatchObject({
      id: 'meal-1', name: 'Petits pois', quantity: 250, quantityUnit: 'g', mealSlot: 'lunch', calories: 203,
      proteinG: 13.5, carbohydratesG: 24.3, fatG: 1, fiberG: 13.8,
    })
  })
})
