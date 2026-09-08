import type { Meal } from './types'

export interface FoodPer100 {
  calories: number | null
  proteinG: number | null
  carbohydratesG: number | null
  fatG: number | null
  fiberG: number | null
}

export interface FoodReference {
  barcode?: string
  name: string
  brand?: string
  imageUrl?: string
  source: 'open-food-facts' | 'manual'
  unit: 'g' | 'ml'
  per100: FoodPer100
}

export interface PortionNutrition {
  calories: number
  proteinG?: number
  carbohydratesG?: number
  fatG?: number
  fiberG?: number
}

export function calculatePortion(per100: FoodPer100, quantity: number): PortionNutrition {
  const multiplier = Math.max(0, quantity) / 100
  const scaled = (value: number | null) => value === null ? undefined : roundNutrient(value * multiplier)
  return {
    calories: Math.round((per100.calories ?? 0) * multiplier),
    proteinG: scaled(per100.proteinG),
    carbohydratesG: scaled(per100.carbohydratesG),
    fatG: scaled(per100.fatG),
    fiberG: scaled(per100.fiberG),
  }
}

export function mealPer100(meal: Meal): FoodPer100 {
  return {
    calories: meal.caloriesPer100 ?? null,
    proteinG: meal.proteinPer100G ?? null,
    carbohydratesG: meal.carbohydratesPer100G ?? null,
    fatG: meal.fatPer100G ?? null,
    fiberG: meal.fiberPer100G ?? null,
  }
}

export function sumMealNutrition(meals: Meal[]): Required<PortionNutrition> {
  return meals.reduce((sum, meal) => ({
    calories: sum.calories + meal.calories,
    proteinG: sum.proteinG + (meal.proteinG ?? 0),
    carbohydratesG: sum.carbohydratesG + (meal.carbohydratesG ?? 0),
    fatG: sum.fatG + (meal.fatG ?? 0),
    fiberG: sum.fiberG + (meal.fiberG ?? 0),
  }), { calories: 0, proteinG: 0, carbohydratesG: 0, fatG: 0, fiberG: 0 })
}

function roundNutrient(value: number): number {
  return Math.round(value * 10) / 10
}
