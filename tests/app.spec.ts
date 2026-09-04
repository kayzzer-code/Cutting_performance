import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/aujourdhui')
  await page.evaluate(() => localStorage.clear())
})

test('navigation principale et écrans dynamiques', async ({ page }) => {
  await page.goto('/aujourdhui')
  await expect(page.getByText('Cible du jour recalculée', { exact: true })).toBeVisible()
  await expect(page.locator('.equation-card')).toContainText('Activité supplémentaire')

  const routes = ['activites', 'nutrition', 'semaine', 'progression', 'musculation', 'parametres']
  for (const route of routes) {
    await page.goto(`/${route}`)
    await expect(page.locator('h1')).toBeVisible()
  }
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
  await page.getByLabel('Calories consommées aujourd’hui').fill('2750')
  await page.getByRole('button', { name: /Enregistrer 2.?750 kcal/ }).click()
  await expect(page.getByText(/Calories enregistrées/)).toBeVisible()
  await page.goto('/semaine')
  await expect(page.locator('.week-matrix-card')).toContainText('2 750')
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
  await expect(page.getByLabel('Calories consommées aujourd’hui')).toBeVisible()
})

test('le profil recalcule le plan et les coefficients techniques restent verrouillés', async ({ page }) => {
  await page.goto('/parametres')
  await expect(page.getByLabel('Marche')).toHaveAttribute('readonly', '')
  await expect(page.getByLabel('Course')).toHaveAttribute('readonly', '')
  await expect(page.getByLabel('Cadence estimée')).toHaveAttribute('readonly', '')

  await page.getByLabel('Masse grasse estimée').fill('25')
  await page.getByLabel('Perte visée').fill('1')
  await expect(page.getByLabel('Calories Upper')).toHaveValue('2850')
  await expect(page.getByLabel('Calories Épaules–Bras')).toHaveValue('2650')
  await expect(page.getByText(/Rythme agressif/)).toBeVisible()

  await page.getByRole('button', { name: 'Enregistrer les paramètres' }).click()
  await expect(page.getByText('Paramètres enregistrés.')).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('Masse grasse estimée')).toHaveValue('25')
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
  await page.getByLabel('Calories consommées aujourd’hui').fill('2750')
  await page.getByRole('button', { name: /Enregistrer 2.?750 kcal/ }).click()

  await page.goto('/parametres')
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
  await page.getByLabel('Calories consommées aujourd’hui').fill('2450')
  await page.getByRole('button', { name: /Enregistrer 2.?450 kcal/ }).click()

  await page.getByRole('button', { name: 'Revenir à aujourd’hui' }).click()
  await expect(dateInput).toHaveValue(currentDate)
  await expect(page.getByLabel('Calories consommées aujourd’hui')).toHaveValue('0')

  await dateInput.fill(historicalDate)
  await expect(page.getByLabel('Calories consommées aujourd’hui')).toHaveValue('2450')

  const activityLink = isMobile
    ? page.locator('.mobile-nav').getByRole('link', { name: 'Activités' })
    : page.locator('.desktop-nav').getByRole('link', { name: 'Activités' })
  await activityLink.click()
  await expect(page).toHaveURL(new RegExp(`/activites\\?date=${historicalDate}`))
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
  await page.getByRole('button', { name: 'Aide : Impact sur la semaine' }).click()
  await expect(page.getByRole('tooltip').filter({ hasText: 'modifie le cumul calorique' })).toBeVisible()

  await page.goto('/semaine')
  await page.getByRole('button', { name: 'Aide : Que faire de la marge ?' }).click()
  await expect(page.getByRole('tooltip').filter({ hasText: 'conserver l’écart' })).toBeVisible()
})

test('les formulaires restent utilisables sur mobile', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Scénario réservé à la vue téléphone')
  await page.goto('/nutrition')
  await page.getByLabel('Calories consommées aujourd’hui').fill('3000')
  await expect(page.getByRole('button', { name: /Enregistrer 3.?000 kcal/ })).toBeVisible()
  await page.goto('/activites')
  await expect(page.getByRole('spinbutton', { name: 'Pas hors course', exact: true })).toBeVisible()
  await expect(page.locator('.mobile-nav')).toBeVisible()
})
