import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'

const captures = [
  { route: '/onboarding/objectif', name: '01_onboarding_objectif', width: 1536, height: 1024, ready: '.objective-form-card' },
  { route: '/aujourdhui', name: '02_tableau_de_bord', width: 1487, height: 1058, ready: '.equation-card' },
  { route: '/activites', name: '03_ajout_activites', width: 1486, height: 1058, ready: '.activity-live-summary' },
  { route: '/nutrition', name: '04_saisie_nutrition', width: 1487, height: 1058, ready: '.nutrition-main-grid' },
  { route: '/semaine', name: '05_bilan_hebdomadaire', width: 1487, height: 1058, ready: '.week-matrix-card' },
  { route: '/progression', name: '06_progression_ajustements', width: 1486, height: 1059, ready: '.weight-trajectory-card' },
  { route: '/musculation', name: '07_journal_musculation', width: 1624, height: 969, ready: '.training-main-grid' },
  { route: '/parametres', name: '08_parametres_calculs', width: 1487, height: 1058, ready: '.settings-reference-grid' },
]

test('captures de validation visuelle aux dimensions des mockups', async ({ page }) => {
  const destination = join(process.cwd(), 'test-results', process.env.VISUAL_PASS ?? 'visual-pass-1')
  await mkdir(destination, { recursive: true })

  for (const capture of captures) {
    await page.setViewportSize({ width: capture.width, height: capture.height })
    await page.goto(capture.route)
    await expect(page.locator(capture.ready)).toBeVisible()
    await page.screenshot({ path: join(destination, `${capture.name}.png`), fullPage: false })
  }
})
