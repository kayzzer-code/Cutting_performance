import type { ExerciseDefinition, LoadConvention, MuscleContribution, MuscleGroup } from './types'

export const muscleGroups: { id: MuscleGroup; label: string; shortLabel: string; color: string }[] = [
  { id: 'chest', label: 'Pectoraux', shortLabel: 'Pecs', color: '#176bdc' },
  { id: 'lats', label: 'Grand dorsal', shortLabel: 'Dorsaux', color: '#0a9089' },
  { id: 'upper-back', label: 'Haut du dos', shortLabel: 'Haut dos', color: '#08727b' },
  { id: 'traps', label: 'Trapèzes', shortLabel: 'Trapèzes', color: '#334c70' },
  { id: 'front-delts', label: 'Deltoïde antérieur', shortLabel: 'Avant épaule', color: '#ef8b20' },
  { id: 'side-delts', label: 'Deltoïde latéral', shortLabel: 'Épaules', color: '#f17816' },
  { id: 'rear-delts', label: 'Deltoïde postérieur', shortLabel: 'Arrière épaule', color: '#d96516' },
  { id: 'biceps', label: 'Biceps', shortLabel: 'Biceps', color: '#31a7e8' },
  { id: 'brachialis', label: 'Brachial', shortLabel: 'Brachial', color: '#168bc5' },
  { id: 'forearms', label: 'Avant-bras', shortLabel: 'Avant-bras', color: '#55708e' },
  { id: 'triceps', label: 'Triceps', shortLabel: 'Triceps', color: '#092a54' },
  { id: 'quads', label: 'Quadriceps', shortLabel: 'Quadriceps', color: '#176bdc' },
  { id: 'hamstrings', label: 'Ischio-jambiers', shortLabel: 'Ischios', color: '#0a9089' },
  { id: 'glutes', label: 'Fessiers', shortLabel: 'Fessiers', color: '#e56f19' },
  { id: 'adductors', label: 'Adducteurs', shortLabel: 'Adducteurs', color: '#7658b8' },
  { id: 'abductors', label: 'Abducteurs', shortLabel: 'Abducteurs', color: '#a2559d' },
  { id: 'calves', label: 'Mollets', shortLabel: 'Mollets', color: '#16797a' },
  { id: 'abs', label: 'Abdominaux', shortLabel: 'Abdos', color: '#1d4f91' },
  { id: 'lower-back', label: 'Lombaires', shortLabel: 'Lombaires', color: '#4b627d' },
]

export const muscleMeta = (id: MuscleGroup) => muscleGroups.find(muscle => muscle.id === id) ?? { id, label: id, shortLabel: id, color: '#405574' }

const contribution = (muscleId: MuscleGroup, role: MuscleContribution['role'], coefficient: number): MuscleContribution => ({ muscleId, role, coefficient })
const primary = (muscleId: MuscleGroup) => contribution(muscleId, 'primary', 1)
const secondary = (muscleId: MuscleGroup, coefficient = 0.5) => contribution(muscleId, 'secondary', coefficient)

function exercise(
  id: string,
  name: string,
  equipmentId: string,
  convention: LoadConvention,
  movementFamily: string,
  main: MuscleGroup,
  secondaryMuscles: MuscleGroup[] = [],
  aliases: string[] = [],
  laterality: ExerciseDefinition['laterality'] = 'bilateral',
  defaultRestSeconds = 90,
): ExerciseDefinition {
  return {
    id, name, equipmentId, convention, movementFamily, aliases, laterality, defaultRestSeconds,
    muscleGroup: main,
    muscleContributions: [primary(main), ...secondaryMuscles.map(muscle => secondary(muscle))],
  }
}

export const baseExerciseCatalogue: ExerciseDefinition[] = [
  exercise('bench-press', 'Développé couché barre', 'Barre', 'total', 'Poussée horizontale', 'chest', ['triceps', 'front-delts'], ['bench press', 'développé couché']),
  exercise('incline-bench-press', 'Développé incliné barre', 'Barre', 'total', 'Poussée inclinée', 'chest', ['front-delts', 'triceps'], ['incline bench']),
  exercise('dumbbell-bench', 'Développé couché haltères', 'Haltères', 'per-dumbbell', 'Poussée horizontale', 'chest', ['triceps', 'front-delts']),
  exercise('incline-dumbbell-bench', 'Développé incliné haltères', 'Haltères', 'per-dumbbell', 'Poussée inclinée', 'chest', ['front-delts', 'triceps']),
  exercise('machine-chest-press', 'Chest press convergente', 'Machine guidée', 'machine', 'Poussée horizontale', 'chest', ['triceps', 'front-delts'], ['presse pectoraux']),
  exercise('smith-incline-press', 'Développé incliné Smith', 'Smith machine', 'total', 'Poussée inclinée', 'chest', ['front-delts', 'triceps']),
  exercise('push-up', 'Pompes', 'Poids du corps', 'bodyweight', 'Poussée horizontale', 'chest', ['triceps', 'front-delts']),
  exercise('weighted-dip', 'Dips lestés', 'Charge additionnelle', 'bodyweight', 'Poussée verticale', 'chest', ['triceps', 'front-delts']),
  exercise('pec-deck', 'Pec deck', 'Machine guidée', 'machine', 'Écarté', 'chest', ['front-delts'], ['butterfly']),
  exercise('cable-fly', 'Écarté poulie vis-à-vis', 'Poulie', 'machine', 'Écarté', 'chest', ['front-delts'], ['cable fly', 'vis à vis']),
  exercise('low-cable-fly', 'Écarté poulie basse', 'Poulie', 'machine', 'Écarté', 'chest', ['front-delts']),
  exercise('high-cable-fly', 'Écarté poulie haute', 'Poulie', 'machine', 'Écarté', 'chest', ['front-delts']),
  exercise('dumbbell-fly', 'Écarté haltères', 'Haltères', 'per-dumbbell', 'Écarté', 'chest', ['front-delts']),

  exercise('pull-up', 'Tractions pronation', 'Poids du corps', 'bodyweight', 'Tirage vertical', 'lats', ['upper-back', 'biceps', 'forearms'], ['pull up']),
  exercise('neutral-pull-up', 'Tractions prise neutre', 'Poids du corps', 'bodyweight', 'Tirage vertical', 'lats', ['biceps', 'upper-back']),
  exercise('assisted-pull-up', 'Tractions assistées', 'Machine assistée', 'assisted', 'Tirage vertical', 'lats', ['biceps', 'upper-back']),
  exercise('pulldown-neutral', 'Tirage vertical prise neutre', 'Poulie', 'machine', 'Tirage vertical', 'lats', ['biceps', 'upper-back'], ['lat pulldown']),
  exercise('wide-pulldown', 'Tirage vertical prise large', 'Poulie', 'machine', 'Tirage vertical', 'lats', ['upper-back', 'biceps']),
  exercise('supinated-pulldown', 'Tirage vertical supination', 'Poulie', 'machine', 'Tirage vertical', 'lats', ['biceps']),
  exercise('single-lat', 'Tirage vertical unilatéral', 'Poulie', 'machine', 'Tirage vertical', 'lats', ['biceps'], [], 'unilateral'),
  exercise('barbell-row', 'Rowing barre buste penché', 'Barre', 'total', 'Tirage horizontal', 'upper-back', ['lats', 'biceps', 'lower-back']),
  exercise('incline-bench-dumbbell-row', 'Rowing haltères buste penché sur banc', 'Haltères + banc', 'per-dumbbell', 'Tirage horizontal', 'upper-back', ['lats', 'biceps', 'rear-delts'], ['rowing haltères sur banc', 'chest supported dumbbell row']),
  exercise('pendlay-row', 'Rowing Pendlay', 'Barre', 'total', 'Tirage horizontal', 'upper-back', ['lats', 'biceps', 'lower-back']),
  exercise('chest-row', 'Rowing poitrine appuyée', 'Machine guidée', 'machine', 'Tirage horizontal', 'upper-back', ['lats', 'biceps', 'rear-delts']),
  exercise('seated-row', 'Rowing assis prise neutre', 'Poulie', 'machine', 'Tirage horizontal', 'upper-back', ['lats', 'biceps', 'rear-delts']),
  exercise('wide-seated-row', 'Rowing assis prise large', 'Poulie', 'machine', 'Tirage horizontal', 'upper-back', ['rear-delts', 'biceps']),
  exercise('one-arm-dumbbell-row', 'Rowing haltère unilatéral', 'Haltère', 'per-dumbbell', 'Tirage horizontal', 'lats', ['upper-back', 'biceps'], [], 'unilateral'),
  exercise('t-bar-row', 'Rowing T-bar', 'Machine guidée', 'machine', 'Tirage horizontal', 'upper-back', ['lats', 'biceps']),
  exercise('straight-arm', 'Pull-over poulie bras tendus', 'Poulie', 'machine', 'Extension d’épaule', 'lats', ['triceps'], ['straight arm pulldown']),
  exercise('dumbbell-pullover', 'Pull-over haltère', 'Haltère', 'per-dumbbell', 'Extension d’épaule', 'lats', ['chest', 'triceps']),

  exercise('overhead-press', 'Développé militaire barre', 'Barre', 'total', 'Poussée verticale', 'front-delts', ['triceps', 'side-delts']),
  exercise('dumbbell-shoulder-press', 'Développé épaules haltères', 'Haltères', 'per-dumbbell', 'Poussée verticale', 'front-delts', ['triceps', 'side-delts']),
  exercise('machine-shoulder-press', 'Développé épaules machine', 'Machine guidée', 'machine', 'Poussée verticale', 'front-delts', ['triceps', 'side-delts']),
  exercise('lateral-raise', 'Élévations latérales poulie', 'Poulie', 'machine', 'Élévation latérale', 'side-delts', ['front-delts'], [], 'unilateral', 60),
  exercise('lateral-machine', 'Élévations latérales machine', 'Machine guidée', 'machine', 'Élévation latérale', 'side-delts', ['front-delts'], [], 'bilateral', 60),
  exercise('dumbbell-lateral-raise', 'Élévations latérales haltères', 'Haltères', 'per-dumbbell', 'Élévation latérale', 'side-delts', ['front-delts'], [], 'bilateral', 60),
  exercise('leaning-lateral-raise', 'Élévation latérale inclinée poulie', 'Poulie', 'machine', 'Élévation latérale', 'side-delts', [], [], 'unilateral', 60),
  exercise('rear-delt', 'Oiseau machine', 'Machine guidée', 'machine', 'Écarté inversé', 'rear-delts', ['upper-back']),
  exercise('reverse-fly', 'Reverse pec deck', 'Machine guidée', 'machine', 'Écarté inversé', 'rear-delts', ['upper-back']),
  exercise('face-pull', 'Face pull', 'Poulie', 'machine', 'Tirage visage', 'rear-delts', ['upper-back', 'traps']),
  exercise('dumbbell-rear-raise', 'Oiseau haltères', 'Haltères', 'per-dumbbell', 'Écarté inversé', 'rear-delts', ['upper-back']),
  exercise('barbell-shrug', 'Shrug barre', 'Barre', 'total', 'Haussement', 'traps', ['forearms']),
  exercise('dumbbell-shrug', 'Shrug haltères', 'Haltères', 'per-dumbbell', 'Haussement', 'traps', ['forearms']),

  exercise('barbell-curl', 'Curl barre droite', 'Barre', 'total', 'Flexion de coude', 'biceps', ['brachialis', 'forearms'], [], 'bilateral', 75),
  exercise('ez-curl', 'Curl barre EZ', 'Barre EZ', 'total', 'Flexion de coude', 'biceps', ['brachialis', 'forearms'], [], 'bilateral', 75),
  exercise('cable-curl', 'Curl poulie', 'Poulie', 'machine', 'Flexion de coude', 'biceps', ['brachialis'], [], 'bilateral', 75),
  exercise('incline-curl', 'Curl incliné haltères', 'Haltères', 'per-dumbbell', 'Flexion de coude', 'biceps', ['brachialis'], [], 'bilateral', 75),
  exercise('preacher-curl', 'Curl pupitre', 'Machine guidée', 'machine', 'Flexion de coude', 'biceps', ['brachialis'], [], 'bilateral', 75),
  exercise('bayesian-curl', 'Curl bayésien', 'Poulie', 'machine', 'Flexion de coude', 'biceps', ['brachialis'], [], 'unilateral', 75),
  exercise('hammer-curl', 'Curl marteau', 'Haltères', 'per-dumbbell', 'Flexion de coude', 'brachialis', ['biceps', 'forearms'], [], 'bilateral', 75),
  exercise('reverse-curl', 'Curl inversé barre EZ', 'Barre EZ', 'total', 'Flexion de coude', 'brachialis', ['forearms', 'biceps'], [], 'bilateral', 75),
  exercise('pushdown', 'Extension triceps corde', 'Poulie', 'machine', 'Extension de coude', 'triceps', [], ['pushdown'], 'bilateral', 75),
  exercise('bar-pushdown', 'Extension triceps barre', 'Poulie', 'machine', 'Extension de coude', 'triceps', [], [], 'bilateral', 75),
  exercise('cross-extension', 'Extension triceps croisée', 'Poulie', 'machine', 'Extension de coude', 'triceps', [], [], 'unilateral', 75),
  exercise('overhead-triceps', 'Extension triceps au-dessus de la tête', 'Poulie', 'machine', 'Extension de coude', 'triceps', [], [], 'bilateral', 75),
  exercise('skull-crusher', 'Barre au front EZ', 'Barre EZ', 'total', 'Extension de coude', 'triceps', [], ['skull crusher'], 'bilateral', 90),
  exercise('close-grip-bench', 'Développé couché prise serrée', 'Barre', 'total', 'Poussée horizontale', 'triceps', ['chest', 'front-delts']),

  exercise('back-squat', 'Squat barre', 'Barre', 'total', 'Squat', 'quads', ['glutes', 'adductors', 'lower-back'], ['back squat'], 'bilateral', 150),
  exercise('front-squat', 'Front squat', 'Barre', 'total', 'Squat', 'quads', ['glutes', 'adductors'], [], 'bilateral', 150),
  exercise('hack-squat', 'Hack squat', 'Machine guidée', 'machine', 'Squat', 'quads', ['glutes', 'adductors'], [], 'bilateral', 150),
  exercise('leg-press', 'Presse à cuisses', 'Machine guidée', 'machine', 'Presse jambes', 'quads', ['glutes', 'adductors'], [], 'bilateral', 150),
  exercise('leg-extension', 'Leg extension', 'Machine guidée', 'machine', 'Extension de genou', 'quads', [], [], 'bilateral', 75),
  exercise('split-squat', 'Fente bulgare', 'Haltères', 'per-dumbbell', 'Fente', 'quads', ['glutes', 'adductors'], [], 'unilateral', 120),
  exercise('walking-lunge', 'Fentes marchées', 'Haltères', 'per-dumbbell', 'Fente', 'quads', ['glutes', 'adductors'], [], 'unilateral', 120),
  exercise('smith-squat', 'Squat Smith', 'Smith machine', 'total', 'Squat', 'quads', ['glutes', 'adductors'], [], 'bilateral', 150),
  exercise('rdl', 'Soulevé de terre roumain', 'Barre', 'total', 'Charnière de hanche', 'hamstrings', ['glutes', 'lower-back', 'forearms'], ['romanian deadlift'], 'bilateral', 150),
  exercise('dumbbell-rdl', 'Soulevé de terre roumain haltères', 'Haltères', 'per-dumbbell', 'Charnière de hanche', 'hamstrings', ['glutes', 'lower-back'], [], 'bilateral', 150),
  exercise('seated-curl', 'Leg curl assis', 'Machine guidée', 'machine', 'Flexion de genou', 'hamstrings', [], [], 'bilateral', 90),
  exercise('lying-curl', 'Leg curl allongé', 'Machine guidée', 'machine', 'Flexion de genou', 'hamstrings', [], [], 'bilateral', 90),
  exercise('standing-leg-curl', 'Leg curl debout unilatéral', 'Machine guidée', 'machine', 'Flexion de genou', 'hamstrings', [], [], 'unilateral', 75),
  exercise('nordic-curl', 'Nordic curl', 'Poids du corps', 'bodyweight', 'Flexion de genou', 'hamstrings', ['glutes'], [], 'bilateral', 120),
  exercise('hip-thrust', 'Hip thrust machine', 'Machine guidée', 'machine', 'Extension de hanche', 'glutes', ['hamstrings']),
  exercise('barbell-hip-thrust', 'Hip thrust barre', 'Barre', 'total', 'Extension de hanche', 'glutes', ['hamstrings']),
  exercise('glute-bridge', 'Glute bridge', 'Poids du corps', 'bodyweight', 'Extension de hanche', 'glutes', ['hamstrings']),
  exercise('cable-kickback', 'Extension de hanche poulie', 'Poulie', 'machine', 'Extension de hanche', 'glutes', ['hamstrings'], ['kickback'], 'unilateral', 60),
  exercise('back-extension', 'Extension lombaire', 'Poids du corps', 'bodyweight', 'Extension du tronc', 'lower-back', ['glutes', 'hamstrings']),
  exercise('adductor-machine', 'Adducteurs machine', 'Machine guidée', 'machine', 'Adduction de hanche', 'adductors', [], [], 'bilateral', 75),
  exercise('abductor-machine', 'Abducteurs machine', 'Machine guidée', 'machine', 'Abduction de hanche', 'abductors', ['glutes'], [], 'bilateral', 75),
  exercise('cable-adduction', 'Adduction de hanche poulie', 'Poulie', 'machine', 'Adduction de hanche', 'adductors', [], [], 'unilateral', 60),
  exercise('cable-abduction', 'Abduction de hanche poulie', 'Poulie', 'machine', 'Abduction de hanche', 'abductors', ['glutes'], [], 'unilateral', 60),
  exercise('calves-a', 'Mollets debout', 'Machine guidée', 'machine', 'Extension de cheville', 'calves', [], ['standing calf raise'], 'bilateral', 75),
  exercise('calves-b', 'Mollets assis', 'Machine guidée', 'machine', 'Extension de cheville', 'calves', [], ['seated calf raise'], 'bilateral', 75),
  exercise('leg-press-calves', 'Mollets à la presse', 'Machine guidée', 'machine', 'Extension de cheville', 'calves', [], [], 'bilateral', 75),
  exercise('single-calf', 'Mollets unilatéraux', 'Poids du corps', 'bodyweight', 'Extension de cheville', 'calves', [], [], 'unilateral', 60),
  exercise('cable-crunch', 'Crunch à la poulie', 'Poulie', 'machine', 'Flexion du tronc', 'abs', [], [], 'bilateral', 60),
  exercise('machine-crunch', 'Crunch machine', 'Machine guidée', 'machine', 'Flexion du tronc', 'abs', [], [], 'bilateral', 60),
  exercise('hanging-leg-raise', 'Relevé de jambes suspendu', 'Poids du corps', 'bodyweight', 'Flexion de hanche', 'abs', ['forearms']),
  exercise('reverse-crunch', 'Crunch inversé', 'Poids du corps', 'bodyweight', 'Flexion du tronc', 'abs'),
  exercise('plank', 'Gainage ventral', 'Poids du corps', 'bodyweight', 'Gainage', 'abs', ['glutes', 'lower-back']),
  exercise('pallof-press', 'Pallof press', 'Poulie', 'machine', 'Anti-rotation', 'abs'),
]

export function mergeExerciseCatalogue(existing: ExerciseDefinition[] = []): ExerciseDefinition[] {
  const byId = new Map(existing.map(item => [item.id, item]))
  const merged = baseExerciseCatalogue.map(base => {
    const current = byId.get(base.id)
    if (!current) return base
    byId.delete(base.id)
    return {
      ...base,
      ...current,
      equipmentId: current.equipmentId === 'legacy-unspecified' ? base.equipmentId : current.equipmentId,
      convention: current.convention === 'unknown' ? base.convention : current.convention,
      aliases: current.aliases?.length ? current.aliases : base.aliases,
      muscleGroup: current.muscleGroup ?? base.muscleGroup,
      muscleContributions: current.muscleContributions?.length ? current.muscleContributions : base.muscleContributions,
      movementFamily: current.movementFamily ?? base.movementFamily,
      laterality: current.laterality ?? base.laterality,
      defaultRestSeconds: current.defaultRestSeconds ?? base.defaultRestSeconds,
    }
  })
  return [...merged, ...byId.values()]
}
