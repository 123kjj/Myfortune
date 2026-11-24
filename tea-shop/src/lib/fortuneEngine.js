import { CATEGORIES, FORTUNES, RARITY } from '../data/fortunes.js'
import { BANKS, IMAGES, WHEN } from '../data/fortuneGrammar.js'

export const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]))
const HANDWRITTEN = Object.fromEntries(FORTUNES.map((f) => [f.id, f]))

// ------------------------------------------------------------ generated fortunes
// id format: "<category>~<template>~<i>.<j>[.<k>]"  e.g. "luck~A~3.11.7"

function hash(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619)
  return h >>> 0
}

const TEMPLATES = {
  A: { dims: (b) => [b.subjects.length, b.predicates.length, WHEN.length], text: (b, [i, j, k]) => `${b.subjects[i]} ${b.predicates[j]} ${WHEN[k]}.` },
  B: { dims: (b) => [b.actions.length, b.results.length], text: (b, [i, j]) => `${b.actions[i]}, and ${b.results[j]}.` },
  C: { dims: () => [IMAGES.length, 16], text: (b, [i, j]) => `${IMAGES[i]} ${b.meanings[j]}` },
}

function templateSize(category, t) {
  return TEMPLATES[t].dims(BANKS[category]).reduce((a, n) => a * n, 1)
}

/** How many fortunes each category holds (handwritten + generated). */
export const FORTUNE_COUNTS = Object.fromEntries(
  CATEGORIES.map((c) => [
    c.id,
    FORTUNES.filter((f) => f.category === c.id).length + Object.keys(TEMPLATES).reduce((s, t) => s + templateSize(c.id, t), 0),
  ]),
)
export const TOTAL_FORTUNES = Object.values(FORTUNE_COUNTS).reduce((a, b) => a + b, 0)

function generatedRarity(id) {
  return hash(id) % 100 < 72 ? 'common' : 'uncommon'
}

function buildGenerated(id) {
  const [category, t, idx] = id.split('~')
  const bank = BANKS[category]
  const tpl = TEMPLATES[t]
  if (!bank || !tpl || !idx) return null
  const parts = idx.split('.').map(Number)
  const dims = tpl.dims(bank)
  if (parts.length !== dims.length || parts.some((n, i) => !(n >= 0 && n < dims[i]))) return null
  return { id, category, text: tpl.text(bank, parts), rarity: generatedRarity(id), generated: true }
}

const cache = new Map()
/** Look up any fortune (handwritten or generated) by id. Returns null if unknown. */
export function getFortune(id) {
  if (!id) return null
  if (HANDWRITTEN[id]) return HANDWRITTEN[id]
  if (!cache.has(id)) cache.set(id, buildGenerated(id))
  return cache.get(id)
}

function randomGenerated(category) {
  // mix the three sentence shapes so fortunes do not all sound alike
  const t = pickWeighted([['A', 58], ['B', 22], ['C', 20]])
  const dims = TEMPLATES[t].dims(BANKS[category])
  return `${category}~${t}~${dims.map((n) => Math.floor(Math.random() * n)).join('.')}`
}

function pickWeighted(entries) {
  const total = entries.reduce((s, [, w]) => s + w, 0)
  let roll = Math.random() * total
  for (const [value, w] of entries) {
    roll -= w
    if (roll <= 0) return value
  }
  return entries[entries.length - 1][0]
}

/**
 * Draw one fortune at random.
 * Rarity is rolled first. Rare and Very Rare fortunes are always one of the
 * shopkeeper's hand-written ones; Common and Uncommon come mostly from the
 * large generated collection. Fortunes already received are avoided.
 */
export function drawFortune(categoryId, seenIds = []) {
  const seen = new Set(seenIds)
  const category = categoryId || CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)].id
  const rarity = pickWeighted(Object.values(RARITY).map((r) => [r.id, r.weight]))
  const handPool = FORTUNES.filter((f) => f.category === category && f.rarity === rarity && !seen.has(f.id))

  const useHandwritten = rarity === 'rare' || rarity === 'very-rare' ? handPool.length > 0 : handPool.length > 0 && Math.random() < 0.12
  if (useHandwritten) return handPool[Math.floor(Math.random() * handPool.length)]

  for (let tries = 0; tries < 400; tries++) {
    const id = randomGenerated(category)
    if (seen.has(id)) continue
    const f = getFortune(id)
    if (rarity === 'rare' || rarity === 'very-rare' || f.rarity === rarity || tries > 60) return f
  }
  return getFortune(randomGenerated(category))
}

/** Paper style per rarity; stable per fortune id so a fortune always looks the same. */
export function paperFor(fortune) {
  const h = [...fortune.id].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7)
  switch (fortune.rarity) {
    case 'very-rare':
      return { src: 'paper/banner-knot.webp', ratio: 972 / 346, pad: [24, 15, 22, 15], flower: true }
    case 'rare':
      return { src: 'paper/slip-sakura.webp', ratio: 378 / 164, pad: [22, 13, 22, 13], flower: h % 2 === 0 }
    case 'uncommon':
      return h % 2
        ? { src: 'paper/slip-branch.webp', ratio: 512 / 170, pad: [22, 12, 24, 12], flower: h % 7 === 0 }
        : { src: 'paper/slip-waves.webp', ratio: 488 / 178, pad: [22, 12, 24, 12], flower: h % 7 === 0 }
    default:
      return { src: 'paper/slip-plain.webp', ratio: 390 / 160, pad: [22, 12, 22, 12], flower: h % 9 === 0 }
  }
}

export const SHOPKEEPER_NOTES = [
  'Stay as long as the tea is warm. — the shopkeeper',
  'I fold every fortune by hand. Yours took two tries; it wanted to be right.',
  'The cat chose the cushion by the window. You may choose any seat.',
  'If the rain gets loud, that only means the garden is happy.',
  'Come back anytime. The jar likes familiar faces.',
  'This one was near the top. It was waiting, I think.',
  'Fortunes are only suggestions. You are the one who writes the day.',
]

export const LITTLE_MESSAGES = {
  teacup: ['Your tea is ready.', 'Sencha, steeped for exactly as long as it needed.', 'Careful, still warm.'],
  teapot: ['The iron kettle hums an old song.', 'There is always more tea.', 'The pot was here before the shop was.'],
  cat: [
    'The cat blinks slowly at you. That is a compliment.',
    'Maneki-neko waves good fortune in through the door.',
    'Mrrp.',
    'The cat has been here longer than the counter.',
  ],
  lantern: ['The lantern flickers, as if nodding.', 'Paper lanterns remember every evening.', 'A little warmth for the walk home.'],
  window: ['The rain has no plans to stop. Neither do you need to.', 'Somewhere out there, a puddle reflects a lantern.', 'Listen. The rain keeps its own time.'],
  banner: ['福 — fuku, good fortune. Some shops hang it upside down so fortune “arrives”.', 'The banner was a gift from the first customer.'],
  vase: ['A petal lets go. It was ready.', 'The blossoms were picked this morning, in the rain.'],
  slips: ['Old fortunes, left behind by earlier guests.', 'Someone wrote “thank you” on the back of this one.'],
  cookie: ['This cookie is only for admiring. The jar decides.', 'Still warm from the oven.'],
}

export function pick(list) {
  return list[Math.floor(Math.random() * list.length)]
}
