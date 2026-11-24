import { useCallback, useEffect, useState } from 'react'
import { DEMO_MODE, FREE_FORTUNES } from '../config.js'
import { drawFortune, getFortune } from '../lib/fortuneEngine.js'
import { load, save } from '../lib/storage.js'

const DEFAULT_SOUND = { sfx: true, ambient: true, sfxVolume: 0.7, ambientVolume: 0.5, muted: false }
const MAX_HISTORY = 5000

const nsFor = (userId) => (userId ? `user:${userId}:` : 'guest:')

// Entries from the first version of the shop used a calendar date instead of a timestamp.
const fixEntry = (e) => (e.at ? e : { ...e, at: e.date ? new Date(`${e.date}T12:00:00`).getTime() : Date.now() })

function migrateV1() {
  if (load('migrated-v2', false)) return
  const oldKept = load('kept', null)
  const oldHistory = load('history', null)
  if (oldKept && !load('guest:kept', null)) save('guest:kept', oldKept.map(fixEntry))
  if (oldHistory && !load('guest:history', null)) save('guest:history', oldHistory.map(fixEntry))
  save('migrated-v2', true)
}

function loadBook(ns) {
  migrateV1()
  return {
    ns,
    kept: load(`${ns}kept`, []).map(fixEntry).filter((e) => getFortune(e.fortuneId)),
    history: load(`${ns}history`, []).map(fixEntry).filter((e) => getFortune(e.fortuneId)),
    pending: load(`${ns}pending`, null),
  }
}

/**
 * Everything the shop remembers, per account (or for the guest on this device).
 * Guests may open FREE_FORTUNES fortunes; members may open as many as they like.
 */
export function useFortuneShop(userId) {
  const ns = nsFor(userId)
  const [book, setBook] = useState(() => loadBook(ns))
  const [freeUsed, setFreeUsed] = useState(() => load('guest:free-used', 0))
  const [soundSettings, setSoundSettings] = useState(() => ({ ...DEFAULT_SOUND, ...load('sound', {}) }))

  // switch books when someone signs in or out
  if (book.ns !== ns) setBook(loadBook(ns))

  useEffect(() => {
    save(`${book.ns}kept`, book.kept)
    save(`${book.ns}history`, book.history)
    save(`${book.ns}pending`, book.pending)
  }, [book])
  useEffect(() => save('guest:free-used', freeUsed), [freeUsed])
  useEffect(() => save('sound', soundSettings), [soundSettings])

  const isMember = !!userId
  const freeLeft = Math.max(0, FREE_FORTUNES - freeUsed)
  const pendingFortune = book.pending && !book.pending.opened ? getFortune(book.pending.fortuneId) : null

  /**
   * Draw a fortune. Returns { fortune, entry, resumed } or null when a guest
   * has used their free fortunes. An unopened cookie is always offered first.
   */
  const draw = useCallback(
    (categoryId) => {
      if (book.pending && !book.pending.opened) {
        const f = getFortune(book.pending.fortuneId)
        if (f) return { fortune: f, entry: book.pending, resumed: true }
      }
      if (!DEMO_MODE && !isMember && freeUsed >= FREE_FORTUNES) return null
      const recent = book.history.slice(0, 600).map((h) => h.fortuneId)
      const fortune = drawFortune(categoryId, recent)
      const entry = { fortuneId: fortune.id, at: Date.now(), category: categoryId || null, opened: false }
      setBook((b) => ({ ...b, pending: entry, history: [{ fortuneId: fortune.id, at: entry.at }, ...b.history].slice(0, MAX_HISTORY) }))
      if (!DEMO_MODE && !isMember) setFreeUsed((n) => n + 1)
      return { fortune, entry, resumed: false }
    },
    [book, isMember, freeUsed],
  )

  const markOpened = useCallback((at) => {
    setBook((b) => (b.pending && b.pending.at === at ? { ...b, pending: { ...b.pending, opened: true } } : b))
  }, [])

  const keep = useCallback((fortuneId, at) => {
    setBook((b) => (b.kept.some((x) => x.fortuneId === fortuneId && x.at === at) ? b : { ...b, kept: [{ fortuneId, at, keptAt: Date.now() }, ...b.kept] }))
  }, [])

  const unkeep = useCallback((fortuneId, at) => {
    setBook((b) => ({ ...b, kept: b.kept.filter((x) => !(x.fortuneId === fortuneId && x.at === at)) }))
  }, [])

  const isKept = useCallback((fortuneId, at) => book.kept.some((x) => x.fortuneId === fortuneId && x.at === at), [book.kept])

  /** After signing up, bring the guest's journal along into the new account. */
  const adoptGuestJournal = useCallback((newUserId) => {
    const guest = loadBook('guest:')
    const target = loadBook(nsFor(newUserId))
    const merge = (a, b) => {
      const seen = new Set(a.map((e) => `${e.fortuneId}@${e.at}`))
      return [...a, ...b.filter((e) => !seen.has(`${e.fortuneId}@${e.at}`))].sort((x, y) => y.at - x.at)
    }
    save(`${target.ns}kept`, merge(target.kept, guest.kept))
    save(`${target.ns}history`, merge(target.history, guest.history).slice(0, MAX_HISTORY))
    if (guest.pending && !guest.pending.opened && !target.pending) save(`${target.ns}pending`, guest.pending)
    save('guest:kept', [])
    save('guest:history', [])
    save('guest:pending', null)
  }, [])

  const forgetJournal = useCallback(() => {
    setBook((b) => ({ ...b, kept: [], history: [], pending: null }))
  }, [])

  return {
    kept: book.kept,
    history: book.history,
    pending: book.pending,
    pendingFortune,
    isMember,
    freeLeft,
    canDraw: DEMO_MODE || isMember || freeLeft > 0 || !!pendingFortune,
    demo: DEMO_MODE,
    soundSettings,
    setSoundSettings,
    draw,
    markOpened,
    keep,
    unkeep,
    isKept,
    adoptGuestJournal,
    forgetJournal,
  }
}
