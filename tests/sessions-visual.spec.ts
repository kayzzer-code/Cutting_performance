import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'

test('vues clés du module séances — données de test isolées', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Les captures mobiles sont réalisées dans ce même scénario.')
  test.setTimeout(60000)
  const directory = join(process.cwd(), 'test-results', 'sessions-visual')
  await mkdir(directory, { recursive: true })
  await page.setViewportSize({ width: 1590, height: 989 })
  await page.goto('/seances')
  await page.evaluate(() => localStorage.clear()); await page.reload()
  const capture = async (name: string, fullPage = false) => {
    await expect(page.locator('.sessions-page')).toBeVisible()
    await page.evaluate(() => document.fonts.ready)
    await page.screenshot({ path: join(directory, name), fullPage, animations: 'disabled' })
  }
  await capture('01-bibliotheque.png')
  await page.goto('/seances/exercices')
  await capture('02-catalogue-exercices.png')
  await page.goto('/seances/lower-a/modifier')
  await capture('03-editeur.png', true)
  await page.goto('/seances/planning')
  await capture('04-planning.png')
  // Explicitly synthetic fixture, only in Playwright's isolated browser context.
  const date = await page.getByLabel('Choisir la date du journal').inputValue()
  await page.evaluate(({ date }) => {
    const key = 'cutting-performance-app:v1'
    const state = JSON.parse(localStorage.getItem(key)!)
    const template = state.templates.find((t: any) => t.id === 'lower-a')
    state.schedule[date] = template.id
    state.plannedSessions[date].templateId = template.id
    state.plannedSessions[date].template = structuredClone(template)
    state.plannedSessions[date].dayType = 'lower'
    for (const line of template.exercises) {
      line.equipmentId = 'Machine test A'; line.convention = 'machine'; line.restSeconds = 90; line.targetRir = 2
      const def = state.catalogue.find((d: any) => d.id === line.exerciseId)
      def.equipmentId = 'Machine test A'; def.convention = 'machine'
    }
    for (let week = 3; week >= 0; week--) {
      const d = new Date(date + 'T12:00:00'); d.setDate(d.getDate() - week * 7); const local = d.toISOString().slice(0, 10)
      state.logs[local] ??= { date: local, meals: [], activities: [] }
      state.logs[local].training = { id: 'test-session-' + week, date: local, templateId: template.id, name: template.name, status: week ? 'completed' : 'in-progress', startedAt: Date.now() - 2304000, runningSince: week ? undefined : Date.now(), elapsedMs: 2304000, restUntil: week ? undefined : Date.now() + 70000, exercises: template.exercises.map((e: any, i: number) => ({ ...structuredClone(e), id: 'test-line-' + week + '-' + i, templateLineId: e.id, sets: Array.from({ length: e.setCount }, (_, j) => ({ id: 'test-set-' + week + '-' + i + '-' + j, loadKg: week || i === 0 || j < 2 ? i === 0 ? 120 : 80 : undefined, reps: week || i === 0 || j < 2 ? 12 - week : undefined, rir: 2, kind: 'work', completed: !!week || i === 0 || i === 1 && j < 2 })) })) }
    }
    localStorage.setItem(key, JSON.stringify(state))
  }, { date })
  await page.goto('/seances/journal')
  await capture('05-journal-desktop.png')
  await page.getByRole('button', { name: 'Remplacer Presse à cuisses', exact: true }).click()
  await capture('06-journal-remplacement.png')
  await page.getByRole('button', { name: 'Fermer le panneau' }).click()
  await page.goto('/seances/statistiques?exerciseId=hack-squat&equipmentId=Machine+test+A')
  await capture('07-statistiques-exercice.png')
  await page.goto('/seances/statistiques?view=muscles')
  await capture('08-statistiques-muscles.png')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/seances/journal')
  await capture('09-mobile-journal-viewport.png')
  await capture('10-mobile-journal-complet.png', true)
  await page.goto('/seances/planning')
  await page.locator('.planning-day.mobile-active').getByRole('button', { name: 'Lower A', exact: true }).click()
  await capture('11-mobile-planning.png')
})
