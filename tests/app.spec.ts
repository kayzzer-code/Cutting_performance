import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/aujourdhui')
  await page.evaluate(() => localStorage.clear())
})

test('navigation principale et écrans dynamiques', async ({ page }) => {
  await page.goto('/aujourdhui')
  await expect(page.getByText('Cible du jour recalculée', { exact: true })).toBeVisible()
  await expect(page.locator('.equation-card')).toContainText('Activité supplémentaire')

  const routes = ['activites', 'nutrition', 'semaine', 'progression', 'musculation', 'objectifs']
  for (const route of routes) {
    await page.goto(`/${route}`)
    await expect(page.locator('h1')).toBeVisible()
  }
})

test('un nouvel objectif archive le cycle actif et adapte sa configuration', async ({ page }) => {
  await page.goto('/objectifs')
  await expect(page.locator('h1')).toHaveText('Objectifs')
  await expect(page.locator('.objective-hero')).toContainText('Sèche vers 80 kg')
  await page.getByRole('button', { name: 'Nouvel objectif' }).click()
  const dialog = page.getByRole('dialog', { name: 'Créer un nouvel objectif' })
  await dialog.getByRole('button', { name: /Prise de masse contrôlée/ }).click()
  await expect(dialog.getByText('Gain visé')).toBeVisible()
  await dialog.getByLabel('Nom de l’objectif').fill('Lean bulk 80 → 83 kg')
  const targetWeight = dialog.getByText('Poids cible').locator('..').getByRole('spinbutton')
  await targetWeight.fill('83')
  page.once('dialog', confirmation => confirmation.accept())
  await dialog.getByRole('button', { name: 'Archiver et démarrer' }).click()
  await expect(page.locator('.objective-hero')).toContainText('Lean bulk 80 → 83 kg')
  await expect(page.locator('.goal-history-grid')).toContainText('Sèche vers 80 kg')
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('cutting-performance-app:v1')!))
  expect(stored.goals).toHaveLength(2)
  expect(stored.goals.find((goal: { id: string }) => goal.id === stored.activeGoalId)).toMatchObject({ type: 'lean-gain', targetWeightKg: 83, status: 'active' })
})

test('Jour centralise la saisie des activités et masque l’ancien onglet Activités', async ({ page }) => {
  await page.goto('/aujourdhui')
  await expect(page.locator('.desktop-nav')).not.toContainText('Activités')
  await expect(page.locator('.mobile-nav')).not.toContainText('Activités')
  await expect(page.locator('.day-activity-grid > *')).toHaveCount(5)
  await expect(page.getByLabel(/ouvrir la séance/)).toHaveAttribute('href', /\/seances\/journal/)
  await expect(page.getByLabel('Renseigner les pas hors course')).toContainText(/0.*\/.*\d+.*réalisés \/ cible/)

  await page.getByLabel('Renseigner les pas hors course').click()
  const stepsDialog = page.getByRole('dialog', { name: 'Pas hors course' })
  await expect(stepsDialog).toBeVisible()
  await expect(stepsDialog.locator('.step-goal-card')).toContainText(/0.*sur.*pas/)
  await stepsDialog.getByLabel('Pas hors course réalisés').fill('20000')
  await expect(stepsDialog.locator('.step-goal-card')).toContainText('20 000')
  await expect(stepsDialog).toContainText('Enregistré automatiquement')
  const selectedDate = await page.getByLabel('Choisir la date du journal').inputValue()
  expect(await page.evaluate((date) => JSON.parse(localStorage.getItem('cutting-performance-app:v1')!).logs[date].totalSteps, selectedDate)).toBe(20000)
  await stepsDialog.getByRole('button', { name: 'Fermer la saisie d’activité' }).click()
  await expect(page.getByLabel('Renseigner les pas hors course')).toContainText('20 000')

  await page.getByLabel('Renseigner une course').click()
  const runDialog = page.getByRole('dialog', { name: 'Course à pied' })
  await runDialog.getByLabel('Durée de course').fill('60')
  await runDialog.getByLabel('Distance de course').fill('10')
  await expect(runDialog).toContainText('6:00 / km')
  await runDialog.getByRole('button', { name: 'Fermer la saisie d’activité' }).click()
  await expect(page.getByLabel('Renseigner une course')).toContainText('1 h • 10,0 km')
  await expect(page.getByLabel('Renseigner les pas hors course')).toContainText('20 000')

  await page.getByLabel('Cardio suivant').click()
  await page.getByLabel('Renseigner une sortie vélo').click()
  const bikeDialog = page.getByRole('dialog', { name: 'Vélo' })
  await bikeDialog.getByLabel('Durée vélo').fill('45')
  await bikeDialog.getByLabel('Watts moyens').fill('180')
  await expect(bikeDialog).toContainText('Enregistré automatiquement')
  await bikeDialog.getByRole('button', { name: 'Fermer la saisie d’activité' }).click()
  await expect(page.getByLabel('Renseigner une sortie vélo')).toContainText('45 min • 180 W')

  await page.locator('.today-actions').getByRole('button', { name: 'Ajouter un autre cardio' }).click()
  await expect(page.getByRole('dialog', { name: 'Quel cardio as-tu fait ?' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Corde à sauter/ })).toBeVisible()
  await page.getByRole('button', { name: /StairMaster/ }).click()
  const stairDialog = page.getByRole('dialog', { name: 'StairMaster' })
  await stairDialog.getByLabel('Durée').fill('6')
  await stairDialog.getByLabel('Secondes').fill('30')
  await expect(stairDialog).toContainText('78 marches/min')
  const activities = await page.evaluate((date) => JSON.parse(localStorage.getItem('cutting-performance-app:v1')!).logs[date].activities, selectedDate)
  expect(activities.find((activity: { type: string }) => activity.type === 'running')).toMatchObject({ durationMin: 60, distanceKm: 10 })
  expect(activities.find((activity: { type: string }) => activity.type === 'cycling')).toMatchObject({ durationMin: 45, averageWatts: 180 })
  expect(activities.find((activity: { type: string }) => activity.type === 'stair-climber')).toMatchObject({ durationMin: 6.5, level: 10 })
})

test('la marche inclinée est calculée puis apparaît comme KPI navigable', async ({ page }) => {
  await page.goto('/aujourdhui')
  await page.locator('.today-actions').getByRole('button', { name: 'Ajouter un autre cardio' }).click()
  await page.getByRole('button', { name: /Marche inclinée/ }).click()

  const dialog = page.getByRole('dialog', { name: 'Marche inclinée' })
  await dialog.getByLabel('Durée').fill('30')
  await dialog.getByLabel('Vitesse du tapis').fill('5')
  await dialog.getByLabel('Inclinaison du tapis').fill('10')
  await expect(dialog).toContainText('7,7 MET')
  await expect(dialog).toContainText('315 kcal')
  await expect(dialog).toContainText('Enregistré automatiquement')
  await dialog.getByRole('button', { name: 'Fermer la saisie d’activité' }).click()

  const treadmillCard = page.getByLabel('Modifier Marche inclinée')
  await expect(treadmillCard).toBeVisible()
  await expect(treadmillCard).toContainText('30 min • 5,0 km/h • 10,0 %')
  await expect(treadmillCard).toContainText('315 kcal estimées')
  await page.getByLabel('Cardio précédent').click()
  await expect(page.getByLabel('Renseigner une sortie vélo')).toBeVisible()
  await page.getByLabel('Cardio suivant').click()
  await expect(treadmillCard).toBeVisible()

  const selectedDate = await page.getByLabel('Choisir la date du journal').inputValue()
  const treadmill = await page.evaluate((date) => JSON.parse(localStorage.getItem('cutting-performance-app:v1')!).logs[date].activities.find((activity: { type: string }) => activity.type === 'incline-treadmill'), selectedDate)
  expect(treadmill).toMatchObject({ durationMin: 30, speedKmh: 5, inclinePercent: 10 })
})

test('une activité ajuste la cible, évite le double comptage et persiste', async ({ page }) => {
  await page.goto('/activites')
  const targetCard = page.locator('.summary-line').filter({ hasText: 'Nouvelle cible' })
  const targetBefore = await targetCard.locator('strong').textContent()
  await page.getByRole('spinbutton', { name: 'Pas hors course', exact: true }).fill('10000')
  await page.getByLabel('Durée de course').fill('96')
  await page.getByLabel('Distance de course').fill('17')
  await expect(page.getByText('5:39 / km', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Enregistrer les activités' }).click()
  await expect(page.getByText(/Activités enregistrées/)).toBeVisible()
  await page.reload()
  await expect(page.getByRole('spinbutton', { name: 'Pas hors course', exact: true })).toHaveValue('10000')
  await expect(page.getByLabel('Durée de course')).toHaveValue('96')
  const targetAfter = await targetCard.locator('strong').textContent()
  expect(targetAfter).not.toBe(targetBefore)
})

test('le vélo en watts et le Stairmaster recalculent puis persistent leur dépense', async ({ page }) => {
  await page.goto('/activites')
  await page.getByLabel('Durée vélo', { exact: true }).fill('60')
  await page.getByLabel('Watts moyens vélo', { exact: true }).fill('180')
  await expect(page.locator('.bike-entry-card .readonly-field')).toContainText('689')

  await page.getByRole('button', { name: 'Escalier', exact: true }).click()
  await page.getByLabel('Minutes escalier', { exact: true }).fill('6')
  await page.getByLabel('Secondes escalier', { exact: true }).fill('30')
  await page.getByLabel('Niveau escalier Matrix', { exact: true }).fill('10')
  await expect(page.locator('.stair-cardio')).toContainText('78')
  await expect(page.locator('.stair-cardio')).toContainText('87')

  await page.getByRole('button', { name: 'Enregistrer les activités' }).click()
  await expect(page.getByText(/Activités enregistrées/)).toBeVisible()
  const selectedDate = await page.getByLabel('Choisir la date du journal').inputValue()
  const stored = await page.evaluate((date) => {
    const state = JSON.parse(localStorage.getItem('cutting-performance-app:v1')!)
    return state.logs[date].activities
  }, selectedDate)
  expect(stored.find((activity: { type: string }) => activity.type === 'cycling')).toMatchObject({ durationMin: 60, averageWatts: 180 })
  expect(stored.find((activity: { type: string }) => activity.type === 'stair-climber')).toMatchObject({ durationMin: 6.5, level: 10, stepRateSpm: 78 })

  await page.reload()
  await expect(page.getByLabel('Durée vélo', { exact: true })).toHaveValue('60')
  await expect(page.getByLabel('Watts moyens vélo', { exact: true })).toHaveValue('180')
  await expect(page.locator('.bike-entry-card .readonly-field')).toContainText('689')
  await page.goto(`/aujourdhui?date=${selectedDate}`)
  await expect(page.locator('.daily-summary-card')).toContainText('1 h • 180 W')
})

test('une séance imprévue adapte la journée sans modifier le planning', async ({ page }) => {
  await page.goto('/activites')
  const performed = page.getByLabel('Séance de musculation réalisée')
  const target = page.locator('.summary-line').filter({ hasText: 'Nouvelle cible' }).locator('strong')

  await expect(performed).toBeChecked()
  await expect(target).toContainText('2 900')
  await performed.uncheck()
  await expect(target).toContainText('2 850')
  await performed.check()
  await expect(target).toContainText('2 900')

  const currentDate = await page.getByLabel('Choisir la date du journal').inputValue()
  const previousDate = new Date(`${currentDate}T12:00:00`)
  previousDate.setDate(previousDate.getDate() - 1)
  const restDate = previousDate.toISOString().slice(0, 10)
  await page.goto(`/activites?date=${restDate}`)

  await expect(performed).not.toBeChecked()
  await expect(page.getByText('Prévu :', { exact: false }).first()).toContainText('Repos')
  await performed.check()
  await page.getByLabel('Séance réalisée', { exact: true }).selectOption('shoulders-arms')
  await page.getByLabel('Durée de la séance').fill('60')
  await page.getByLabel('Nombre d’exercices').fill('6')
  await page.getByLabel('Nombre de séries de travail').fill('16')
  await expect(page.locator('.summary-line').filter({ hasText: 'Ajustement séance' }).locator('strong')).toContainText('+50')
  await expect(target).toContainText('2 900')
  await page.getByRole('button', { name: 'Enregistrer les activités' }).click()
  await page.reload()

  await expect(performed).toBeChecked()
  await expect(page.getByLabel('Séance réalisée', { exact: true })).toHaveValue('shoulders-arms')
  await expect(page.getByLabel('Durée de la séance')).toHaveValue('60')
  await expect(page.getByLabel('Nombre d’exercices')).toHaveValue('6')
  await expect(page.getByLabel('Nombre de séries de travail')).toHaveValue('16')
  const stored = await page.evaluate((date) => {
    const state = JSON.parse(localStorage.getItem('cutting-performance-app:v1')!)
    return { schedule: state.schedule[date], strength: state.logs[date].strengthActivity }
  }, restDate)
  expect(stored.schedule).toBe('rest')
  expect(stored.strength).toMatchObject({ performed: true, plannedDayType: 'rest', dayType: 'shoulders-arms', durationMin: 60, exerciseCount: 6, workingSetCount: 16 })

  await page.goto(`/aujourdhui?date=${restDate}`)
  await expect(page.locator('.daily-summary-card')).toContainText('Épaules-bras')
  await expect(page.locator('.equation-card')).toContainText('Base selon séance réelle')
})

test('la nutrition enregistrée alimente le bilan de la semaine', async ({ page }) => {
  await page.goto('/nutrition')
  await page.getByRole('button', { name: 'Saisie rapide' }).click()
  await page.getByLabel('Calories consommées aujourd’hui').fill('2750')
  await page.getByRole('button', { name: /Enregistrer 2.?750 kcal/ }).click()
  await expect(page.getByText(/Calories enregistrées/)).toBeVisible()
  await page.goto('/semaine')
  await expect(page.locator('.week-matrix-card')).toContainText('2 750')
})

test('un produit scanné calcule les macros, alimente le total puis reste modifiable', async ({ page }) => {
  await page.route('**/api/open-food-facts/3560070973570**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'success',
        result: { id: 'product_found' },
        product: {
          code: '3560070973570',
          product_name: 'Petits pois extra-fins',
          brands: 'Produit test',
          product_quantity_unit: 'g',
          nutriments: {
            'energy-kcal_100g': 81,
            proteins_100g: 5.4,
            carbohydrates_100g: 9.7,
            fat_100g: 0.4,
            fiber_100g: 5.5,
          },
        },
      }),
    })
  })
  await page.goto('/nutrition')
  const nutritionModes = page.locator('.nutrition-mode-tabs button')
  await expect(nutritionModes).toHaveText(['Aliments & macros', 'Saisie rapide'])
  await expect(page.getByRole('button', { name: 'Aliments & macros' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('Journal alimentaire', { exact: true })).toBeVisible()
  await page.getByLabel('Code-barres du produit').fill('3560070973570')
  await page.getByRole('button', { name: 'Rechercher' }).click()
  await expect(page.getByLabel('Nom de l’aliment')).toHaveValue('Petits pois extra-fins')

  await page.getByLabel('Quantité consommée').fill('250')
  await expect(page.locator('.portion-preview')).toContainText('203 kcal')
  await expect(page.locator('.portion-preview')).toContainText('P 13,5 g')
  await page.getByRole('button', { name: 'Ajouter à la journée' }).click()
  await expect(page.getByText('Petits pois extra-fins', { exact: true })).toBeVisible()
  await expect(page.locator('.macro-summary-grid')).toContainText('13,5')

  await page.getByRole('button', { name: 'Saisie rapide' }).click()
  await expect(page.getByLabel('Calories consommées aujourd’hui')).toHaveValue('203')
  await page.reload()
  await expect(page.getByText('Petits pois extra-fins', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Modifier Petits pois extra-fins' }).click()
  await page.getByLabel('Quantité consommée').fill('200')
  await page.getByRole('button', { name: 'Enregistrer les modifications' }).click()
  await expect(page.locator('.food-entry-calories')).toContainText('162')
  await page.getByRole('button', { name: 'Supprimer Petits pois extra-fins' }).click()
  await expect(page.getByText('Aucun aliment détaillé')).toBeVisible()
  await page.getByRole('button', { name: 'Saisie rapide' }).click()
  await expect(page.getByLabel('Calories consommées aujourd’hui')).toHaveValue('0')
})

test('le scanner global ajoute rapidement un aliment à la date active sur téléphone', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Scénario réservé à la vue téléphone')
  await page.route('**/api/open-food-facts/3560070973570**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'success',
        result: { id: 'product_found' },
        product: {
          code: '3560070973570',
          product_name: 'Petits pois extra-fins',
          brands: 'Produit test',
          product_quantity_unit: 'g',
          nutriments: {
            'energy-kcal_100g': 81,
            proteins_100g: 5.4,
            carbohydrates_100g: 9.7,
            fat_100g: 0.4,
            fiber_100g: 5.5,
          },
        },
      }),
    })
  })

  for (const route of ['/aujourdhui', '/activites', '/nutrition', '/semaine', '/seances']) {
    await page.goto(route)
    await expect(page.locator('.global-scan-button')).toBeVisible()
  }

  await page.goto('/activites')
  await page.locator('.global-scan-button').click()
  await expect(page.getByRole('dialog', { name: 'Scanner un produit' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Photo nette' })).toBeVisible()
  await page.getByRole('button', { name: 'Saisir le code manuellement' }).click()
  await page.getByLabel('Code-barres du produit').fill('3560070973570')
  await page.getByRole('button', { name: 'Rechercher le produit' }).click()
  await expect(page.getByRole('dialog', { name: 'Petits pois extra-fins' })).toBeVisible()
  await page.getByLabel('Quantité consommée après le scan').fill('250')
  await expect(page.locator('.quick-portion-result')).toContainText('203 kcal')
  await expect(page.locator('.quick-portion-result')).toContainText('P 13,5 g')
  await page.getByLabel('Repas après le scan').selectOption('snack')
  await page.getByRole('button', { name: 'Ajouter à la journée' }).click()
  await expect(page.getByRole('status')).toContainText('Petits pois extra-fins ajouté : 203 kcal')

  await page.goto('/nutrition')
  await expect(page.locator('.nutrition-summary-strip')).toContainText('203')
  await expect(page.locator('.nutrition-macro-overview')).toContainText('13,5')
  await page.getByRole('button', { name: 'Aliments & macros' }).click()
  await expect(page.getByText('Petits pois extra-fins', { exact: true })).toBeVisible()
})

test('le scanner global guide les codes invalides et bloque une fiche sans calories', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Scénario réservé à la vue téléphone')
  await page.route('**/api/open-food-facts/1234567890124**', async (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      status: 'success', result: { id: 'product_found' }, product: {
        code: '1234567890124', product_name: 'Produit incomplet', product_quantity_unit: 'g',
        nutriments: { proteins_100g: 12 },
      },
    }),
  }))
  await page.goto('/nutrition')
  await page.locator('.nutrition-mobile-scan').click()
  await page.getByRole('button', { name: 'Saisir le code manuellement' }).click()
  const scannerDialog = page.locator('.quick-food-modal')
  await scannerDialog.getByLabel('Code-barres du produit').fill('123')
  await page.getByRole('button', { name: 'Rechercher le produit' }).click()
  await expect(page.getByRole('alert')).toContainText('entre 8 et 14 chiffres')

  await scannerDialog.getByLabel('Code-barres du produit').fill('1234567890124')
  await page.getByRole('button', { name: 'Rechercher le produit' }).click()
  await expect(page.getByRole('dialog', { name: 'Produit incomplet' })).toContainText('Les calories sont absentes')
  await expect(page.getByRole('button', { name: 'Ajouter à la journée' })).toBeDisabled()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
})

test('le détail nutrition reste utilisable sans caméra ni produit référencé', async ({ page }) => {
  await page.route('**/api/open-food-facts/1234567890123**', async (route) => {
    await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'not_found' }) })
  })
  await page.goto('/nutrition')
  await page.getByRole('button', { name: 'Aliments & macros' }).click()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)

  await page.getByRole('button', { name: 'Scanner', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Scanner un produit' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Scanner un produit' })).toBeHidden()

  await page.getByLabel('Code-barres du produit').fill('123')
  await page.getByRole('button', { name: 'Rechercher' }).click()
  await expect(page.getByRole('alert')).toContainText('entre 8 et 14 chiffres')
  await page.getByLabel('Code-barres du produit').fill('1234567890123')
  await page.getByRole('button', { name: 'Rechercher' }).click()
  await expect(page.getByRole('alert')).toContainText('pas encore référencé')

  await page.getByRole('button', { name: 'Saisir manuellement' }).click()
  await page.getByLabel('Nom de l’aliment').fill('Aliment maison')
  await page.getByLabel('Calories pour 100').fill('120')
  await page.getByLabel('Protéines pour 100').fill('8')
  await page.getByLabel('Quantité consommée').fill('150')
  await page.getByRole('button', { name: 'Ajouter à la journée' }).click()
  await expect(page.getByText('Aliment maison', { exact: true })).toBeVisible()
  await expect(page.locator('.food-entry-calories')).toContainText('180')
})

test('Open Food Facts prend automatiquement le relais si la route intermédiaire échoue', async ({ page }) => {
  await page.route('**/api/open-food-facts/3502110008039**', async (route) => {
    await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'invalid_barcode' }) })
  })
  await page.route('https://world.openfoodfacts.org/api/v3/product/3502110008039**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'success',
        result: { id: 'product_found' },
        product: {
          code: '3502110008039',
          product_name: 'Pepsi Max',
          brands: 'Pepsi',
          product_quantity_unit: 'ml',
          nutriments: {
            'energy-kcal_100g': 0.4,
            proteins_100g: 0,
            carbohydrates_100g: 0,
            fat_100g: 0,
            fiber_100g: 0,
          },
        },
      }),
    })
  })

  await page.goto('/nutrition')
  await page.getByRole('button', { name: 'Aliments & macros' }).click()
  await page.getByLabel('Code-barres du produit').fill('3502110008039')
  await page.getByRole('button', { name: 'Rechercher' }).click()
  await expect(page.getByLabel('Nom de l’aliment')).toHaveValue('Pepsi Max')
  await expect(page.locator('.food-product-editor')).toContainText('Pepsi')
})

test('les valeurs de la semaine ouvrent le détail du bon jour', async ({ page }) => {
  await page.goto('/semaine')
  const currentDate = await page.getByLabel('Choisir la date du journal').inputValue()
  const previousDate = new Date(`${currentDate}T12:00:00`)
  previousDate.setDate(previousDate.getDate() - 1)
  const historicalDate = previousDate.toISOString().slice(0, 10)
  const historicalLabel = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(previousDate)

  await page.goto(`/semaine?date=${historicalDate}`)
  await page.getByRole('link', { name: `Voir le détail de la cible du ${historicalLabel}` }).click()
  await expect(page).toHaveURL(new RegExp(`/aujourdhui\\?date=${historicalDate}`))
  await expect(page.getByLabel('Choisir la date du journal')).toHaveValue(historicalDate)
  await expect(page.locator('.equation-card')).toContainText('Jour planifié')
  await expect(page.locator('.equation-card')).toContainText('Activité supplémentaire')
  await expect(page.locator('.equation-card')).toContainText('Restitution')

  await page.goto(`/semaine?date=${historicalDate}`)
  await page.getByRole('link', { name: `Saisir les calories réelles du ${historicalLabel}` }).click()
  await expect(page).toHaveURL(new RegExp(`/nutrition\\?date=${historicalDate}`))
  await expect(page.getByLabel('Choisir la date du journal')).toHaveValue(historicalDate)
  await expect(page.getByRole('button', { name: 'Aliments & macros' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Saisie rapide' }).click()
  await expect(page.getByLabel('Calories consommées aujourd’hui')).toBeVisible()
})

test('la semaine affiche et permet de modifier la séance programmée', async ({ page }) => {
  await page.goto('/semaine')
  const currentDate = await page.getByLabel('Choisir la date du journal').inputValue()
  const sessionSelect = page.getByLabel(`Séance programmée du ${currentDate}`)
  const currentTemplate = await sessionSelect.inputValue()
  const nextTemplate = currentTemplate === 'rest' ? 'upper-a' : 'rest'
  const date = new Date(`${currentDate}T12:00:00`)
  const longDate = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(date)
  const target = page.getByRole('link', { name: `Voir le détail de la cible du ${longDate}` })
  const previousTarget = await target.textContent()

  await sessionSelect.selectOption(nextTemplate)
  await expect(sessionSelect).toHaveValue(nextTemplate)
  await expect(target).not.toHaveText(previousTarget ?? '')

  await page.reload()
  await expect(page.getByLabel(`Séance programmée du ${currentDate}`)).toHaveValue(nextTemplate)
})

test('l’objectif recalcule le plan et les coefficients techniques restent verrouillés', async ({ page }) => {
  await page.goto('/objectifs')
  await page.locator('.objective-calculation-card summary').click()
  await expect(page.locator('.locked-coefficients')).toContainText('Marche')
  await expect(page.locator('.locked-coefficients')).toContainText('Course')

  await page.getByLabel('Masse grasse de départ').fill('25')
  await page.getByLabel('Perte visée').fill('1')
  await expect(page.getByLabel('Calories Upper')).toHaveValue('2850')
  await expect(page.getByLabel('Calories Épaules–Bras')).toHaveValue('2650')
  await expect(page.getByText(/Rythme agressif/)).toBeVisible()

  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click()
  await expect(page.getByText('Objectif et calculs enregistrés.')).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('Masse grasse de départ')).toHaveValue('25')
  await expect(page.getByLabel('Perte visée')).toHaveValue('1')
})

test('une séance peut être démarrée, terminée partiellement puis corrigée sans effacer son historique', async ({ page }) => {
  await page.goto('/musculation')
  await page.getByRole('button', { name: 'Démarrer la séance' }).click()
  await expect(page.getByText(/Séance démarrée/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Terminer la séance' })).toBeEnabled()

  await page.getByRole('button', { name: 'Terminer la séance' }).click()
  await page.getByRole('button', { name: 'Terminer en l’état' }).click()
  await expect(page.getByText(/Séance terminée et enregistrée/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Séance terminée' })).toBeDisabled()

  await page.getByRole('button', { name: 'Corriger cette séance' }).click()
  await page.getByRole('button', { name: 'Autoriser la correction de la séance' }).click()
  await expect(page.getByRole('button', { name: 'Terminer la correction' })).toBeEnabled()
})

test('la remise à zéro efface le journal et relance le paramétrage', async ({ page }) => {
  await page.goto('/nutrition')
  await page.getByRole('button', { name: 'Saisie rapide' }).click()
  await page.getByLabel('Calories consommées aujourd’hui').fill('2750')
  await page.getByRole('button', { name: /Enregistrer 2.?750 kcal/ }).click()

  await page.goto('/objectifs')
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Effacer mes données et recommencer' }).click()
  await expect(page).toHaveURL(/\/onboarding\/objectif$/)

  const actualEntries = await page.evaluate(() => {
    const saved = localStorage.getItem('cutting-performance-app:v1')
    if (!saved) return -1
    const state = JSON.parse(saved)
    return Object.values(state.logs).filter((log: any) =>
      log.caloriesConsumed !== undefined || log.weightKg !== undefined || log.activities.length > 0 || log.training,
    ).length
  })
  expect(actualEntries).toBe(0)
})

test('la date du header permet de saisir et retrouver une journée historique', async ({ page, isMobile }) => {
  await page.goto('/aujourdhui')
  const dateInput = page.getByLabel('Choisir la date du journal')
  const currentDate = await dateInput.inputValue()
  const previousDate = new Date(`${currentDate}T12:00:00`)
  previousDate.setDate(previousDate.getDate() - 1)
  const historicalDate = previousDate.toISOString().slice(0, 10)

  await page.getByRole('button', { name: 'Jour précédent' }).click()
  await expect(dateInput).toHaveValue(historicalDate)
  await expect(page).toHaveURL(new RegExp(`date=${historicalDate}`))
  await expect(page.getByRole('button', { name: 'Revenir à aujourd’hui' })).toBeVisible()

  await page.getByRole('link', { name: /Saisir mes calories/ }).click()
  await expect(page).toHaveURL(new RegExp(`/nutrition\\?date=${historicalDate}`))
  await page.getByRole('button', { name: 'Saisie rapide' }).click()
  await page.getByLabel('Calories consommées aujourd’hui').fill('2450')
  await page.getByRole('button', { name: /Enregistrer 2.?450 kcal/ }).click()

  await page.getByRole('button', { name: 'Revenir à aujourd’hui' }).click()
  await expect(dateInput).toHaveValue(currentDate)
  await page.getByRole('button', { name: 'Saisie rapide' }).click()
  await expect(page.getByLabel('Calories consommées aujourd’hui')).toHaveValue('0')

  await page.goto(`/nutrition?date=${historicalDate}`)
  await page.getByRole('button', { name: 'Saisie rapide', exact: true }).click()
  await expect(page.getByLabel('Calories consommées aujourd’hui')).toHaveValue('2450')

  const todayLink = isMobile
    ? page.locator('.mobile-nav').getByRole('link', { name: 'Jour' })
    : page.locator('.desktop-nav').getByRole('link', { name: 'Aujourd’hui' })
  await todayLink.click()
  await page.getByLabel('Renseigner les pas hors course').click()
  await expect(page).toHaveURL(new RegExp(`/aujourdhui\\?date=${historicalDate}`))
  await expect(page.getByRole('dialog', { name: 'Pas hors course' })).toBeVisible()
  await expect(page.getByLabel('Choisir la date du journal')).toHaveValue(historicalDate)
})

test('les aides contextuelles expliquent les calculs au clic et au clavier', async ({ page }) => {
  await page.goto('/aujourdhui')
  const plannedHelp = page.getByRole('button', { name: 'Aide : Jour planifié' })
  await plannedHelp.click()
  await expect(page.getByRole('tooltip').filter({ hasText: 'Base calorique correspondant au type de journée planifié' })).toBeVisible()
  await expect(page).toHaveURL(/\/aujourdhui$/)

  await plannedHelp.press('Escape')
  await expect(page.getByRole('tooltip').filter({ hasText: 'Base calorique correspondant au type de journée planifié' })).toBeHidden()

  await page.getByRole('button', { name: 'Aide : Séance :' }).click()
  await expect(page.getByRole('tooltip').filter({ hasText: 'Tu dois réaliser ta séance' })).toBeVisible()
  await expect(page).toHaveURL(/\/aujourdhui$/)

  await page.goto('/nutrition')
  await page.getByRole('button', { name: 'Saisie rapide' }).click()
  await page.getByRole('button', { name: 'Aide : Impact sur la semaine' }).click()
  await expect(page.getByRole('tooltip').filter({ hasText: 'modifie le cumul calorique' })).toBeVisible()

  await page.goto('/semaine')
  await page.getByRole('button', { name: 'Aide : Que faire de la marge ?' }).click()
  await expect(page.getByRole('tooltip').filter({ hasText: 'conserver l’écart' })).toBeVisible()
})

test('les formulaires restent utilisables sur mobile', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Scénario réservé à la vue téléphone')
  await page.goto('/nutrition')
  await page.getByRole('button', { name: 'Saisie rapide' }).click()
  await page.getByLabel('Calories consommées aujourd’hui').fill('3000')
  await expect(page.getByRole('button', { name: /Enregistrer 3.?000 kcal/ })).toBeVisible()
  await page.goto('/activites')
  await expect(page.getByRole('spinbutton', { name: 'Pas hors course', exact: true })).toBeVisible()
  await expect(page.locator('.mobile-nav')).toBeVisible()
})

test('les grandes valeurs nutritionnelles ne se chevauchent pas sur téléphone', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Scénario réservé à la vue téléphone')
  await page.goto('/nutrition')
  await page.getByRole('button', { name: 'Saisie rapide' }).click()
  await page.getByLabel('Calories consommées aujourd’hui').fill('3250')
  await expect(page.getByText('kcal consommées', { exact: false })).toBeVisible()

  const compactSummary = await page.locator('.nutrition-summary-strip').evaluate((summary) => {
    const box = summary.getBoundingClientRect()
    const items = [...summary.querySelectorAll('.nutrition-summary-metric')].map((item) => item.getBoundingClientRect())
    return box.height <= 110 && items.length === 3 && items.every((item) => Math.abs(item.top - items[0].top) < 2)
  })
  expect(compactSummary).toBe(true)
  await expect(page.locator('.nutrition-macro-overview')).toBeVisible()
  await expect(page.locator('.nutrition-mobile-scan')).toBeVisible()

  const quickControlsFit = await page.locator('.quick-calorie-card').evaluate((card) => {
    const main = card.querySelector('.giant-calorie-input')!.getBoundingClientRect()
    const row = card.querySelector('.quick-add-row')!.getBoundingClientRect()
    const buttons = [...card.querySelectorAll('.quick-add-row button')].map((element) => element.getBoundingClientRect())
    const noPairOverlaps = buttons.every((first, index) => buttons.slice(index + 1).every((second) =>
      first.right <= second.left || second.right <= first.left || first.bottom <= second.top || second.bottom <= first.top,
    ))
    return main.bottom <= row.top && noPairOverlaps && buttons.every((button) => button.left >= row.left && button.right <= row.right)
  })
  expect(quickControlsFit).toBe(true)

  await page.getByRole('button', { name: 'Aliments & macros' }).click()
  await page.getByRole('button', { name: 'Créer un aliment manuellement' }).click()
  await page.getByLabel('Nom de l’aliment').fill('Préparation protéinée aux petits pois extra-fins et légumes méditerranéens')
  await page.getByLabel('Calories pour 100').fill('950')
  await page.getByLabel('Protéines pour 100').fill('250')
  await page.getByLabel('Glucides pour 100').fill('315')
  await page.getByLabel('Lipides pour 100').fill('180')
  await page.getByLabel('Fibres pour 100').fill('99')
  await page.getByLabel('Quantité consommée').fill('275')
  await expect(page.locator('.portion-preview')).toContainText('2 613 kcal')
  await page.getByRole('button', { name: 'Ajouter à la journée' }).click()
  await expect(page.locator('.macro-summary-grid')).toContainText('866,3')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  const macrosFit = await page.locator('.macro-summary').evaluateAll((cards) => cards.every((card) => {
    const value = card.querySelector('strong')
    return Boolean(value) && value!.scrollWidth <= value!.clientWidth
  }))
  expect(macrosFit).toBe(true)
})
