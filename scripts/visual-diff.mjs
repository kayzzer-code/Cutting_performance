import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import pixelmatch from 'pixelmatch'
import { PNG } from 'pngjs'

const pass = process.env.VISUAL_PASS ?? 'visual-pass-3'
const actualDirectory = join(process.cwd(), 'test-results', pass)
const referenceDirectory = join(process.cwd(), '..', 'outputs', '01a03b0c-185b-7e13-8179-2d7308789943', 'mockups_app_v1')
const comparisonDirectory = join(actualDirectory, 'comparisons')
mkdirSync(comparisonDirectory, { recursive: true })

const filenames = [
  '01_onboarding_objectif.png',
  '02_tableau_de_bord.png',
  '03_ajout_activites.png',
  '04_saisie_nutrition.png',
  '05_bilan_hebdomadaire.png',
  '06_progression_ajustements.png',
  '07_journal_musculation.png',
  '08_parametres_calculs.png',
]

const report = filenames.map((filename) => {
  const reference = PNG.sync.read(readFileSync(join(referenceDirectory, filename)))
  const actual = PNG.sync.read(readFileSync(join(actualDirectory, filename)))
  if (reference.width !== actual.width || reference.height !== actual.height) {
    throw new Error(`${filename}: ${actual.width}×${actual.height} au lieu de ${reference.width}×${reference.height}`)
  }

  const diff = new PNG({ width: reference.width, height: reference.height })
  const overlay = new PNG({ width: reference.width, height: reference.height })
  const differentPixels = pixelmatch(reference.data, actual.data, diff.data, reference.width, reference.height, {
    threshold: 0.12,
    includeAA: true,
    diffColor: [230, 38, 45],
    aaColor: [255, 165, 0],
  })

  for (let index = 0; index < overlay.data.length; index += 4) {
    overlay.data[index] = Math.round((reference.data[index] + actual.data[index]) / 2)
    overlay.data[index + 1] = Math.round((reference.data[index + 1] + actual.data[index + 1]) / 2)
    overlay.data[index + 2] = Math.round((reference.data[index + 2] + actual.data[index + 2]) / 2)
    overlay.data[index + 3] = 255
  }

  writeFileSync(join(comparisonDirectory, filename.replace('.png', '_diff.png')), PNG.sync.write(diff))
  writeFileSync(join(comparisonDirectory, filename.replace('.png', '_overlay.png')), PNG.sync.write(overlay))
  return {
    filename,
    dimensions: `${reference.width}x${reference.height}`,
    differentPixels,
    differencePercent: Number((differentPixels / (reference.width * reference.height) * 100).toFixed(2)),
  }
})

writeFileSync(join(comparisonDirectory, 'report.json'), `${JSON.stringify(report, null, 2)}\n`)
console.table(report)
