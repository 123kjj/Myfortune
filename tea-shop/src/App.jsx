import { useCallback, useEffect, useRef, useState } from 'react'
import { Whisper } from './components/common.jsx'
import { GoldDefs } from './components/FortunePaper.jsx'
import FortuneRitual from './components/FortuneRitual.jsx'
import { AboutLantern, AccountTag, CategoryCord, JournalBook, SoundControls, Title } from './components/Hud.jsx'
import { AboutPanel, AccountPanel, JournalPanel, SoundPanel } from './components/Panels.jsx'
import ShopScene from './components/ShopScene.jsx'
import { useAuth } from './hooks/useAuth.js'
import { useFortuneShop } from './hooks/useFortuneShop.js'
import { useStageLayout } from './hooks/useStageLayout.js'
import { sound } from './lib/audio.js'
import { CATEGORY_BY_ID, LITTLE_MESSAGES, pick, SHOPKEEPER_NOTES } from './lib/fortuneEngine.js'
import { timeOfDay } from './lib/mood.js'

export default function App() {
  const auth = useAuth()
  const shop = useFortuneShop(auth.user?.id)
  const layout = useStageLayout()
  const jarRef = useRef(null)
  const [mood, setMood] = useState(timeOfDay)
  const [category, setCategory] = useState(null)
  const [jarState, setJarState] = useState('idle')
  const [ritual, setRitual] = useState(null)
  const [panel, setPanel] = useState(null)
  const [accountReason, setAccountReason] = useState(null)
  const [whisper, setWhisper] = useState(null)
  const firstTea = useRef(true)

  // ---- sound: configured from saved settings, started only by a gesture
  useEffect(() => sound.configure(shop.soundSettings), [shop.soundSettings])
  useEffect(() => {
    const unlock = () => sound.unlock()
    window.addEventListener('pointerdown', unlock, { capture: true })
    window.addEventListener('keydown', unlock, { capture: true })
    return () => {
      window.removeEventListener('pointerdown', unlock, { capture: true })
      window.removeEventListener('keydown', unlock, { capture: true })
    }
  }, [])

  useEffect(() => {
    const id = setInterval(() => setMood(timeOfDay()), 5 * 60_000)
    return () => clearInterval(id)
  }, [])

  const say = useCallback((text) => setWhisper({ text, id: Date.now() + Math.random() }), [])
  useEffect(() => {
    if (!whisper) return
    const t = setTimeout(() => setWhisper(null), 3600)
    return () => clearTimeout(t)
  }, [whisper])

  const center = () => ({ x: window.innerWidth / 2, y: window.innerHeight / 2 })

  const askToJoin = useCallback(() => {
    setAccountReason('limit')
    setPanel('account')
  }, [])

  // ---- the jar
  const onJar = () => {
    if (ritual || jarState === 'shaking' || jarState === 'nudge') return
    const result = shop.draw(category)
    if (!result) {
      setJarState('nudge')
      sound.play('ceramic')
      setTimeout(() => setJarState('idle'), 700)
      say('The jar would like to know your name first.')
      setTimeout(askToJoin, 700)
      return
    }
    const { fortune, entry, resumed } = result
    if (resumed) {
      say('Your cookie is still waiting for you.')
      setRitual({ mode: 'cookie', fortune, entry, origin: center(), note: null })
      return
    }
    const r = jarRef.current.getBoundingClientRect()
    sound.play('jar')
    setJarState('shaking')
    setTimeout(() => setJarState('idle'), 1100)
    setRitual({
      mode: 'draw',
      fortune,
      entry,
      origin: { x: r.left + r.width * 0.5, y: r.top + r.height * 0.155 },
      rollWidth: Math.max(22, 50 * layout.scale),
      note: fortune.rarity === 'very-rare' || Math.random() < 0.18 ? pick(SHOPKEEPER_NOTES) : null,
    })
  }

  const closeRitual = useCallback(() => setRitual(null), [])
  const another = () => {
    setRitual(null)
    if (!shop.canDraw) {
      setTimeout(askToJoin, 350)
      return
    }
    setTimeout(() => jarRef.current?.click(), 500)
  }
  const keepCurrent = () => {
    if (!ritual) return
    shop.keep(ritual.fortune.id, ritual.entry.at)
    sound.play('page')
    say('Written into your journal.')
  }

  // ---- little objects in the shop
  const onProp = (name, sfx) => {
    sound.play(sfx)
    if (name === 'teacup' && firstTea.current) {
      firstTea.current = false
      say('Your tea is ready.')
      return
    }
    say(pick(LITTLE_MESSAGES[name]))
  }

  const onTag = (id) => {
    sound.play('tick')
    if (!shop.canDraw) {
      say('Sign up to keep choosing fortunes.')
      return
    }
    setCategory((c) => (c === id ? null : id))
    if (category !== id) say(`The jar will listen for ${CATEGORY_BY_ID[id].label.toLowerCase()}.`)
  }

  const openPanel = (name) => {
    sound.play(name === 'journal' ? 'page' : 'tick')
    if (name === 'account') setAccountReason(null)
    setPanel(name)
  }

  // ---- accounts
  const onSignUp = async (details) => {
    const u = await auth.signUp(details)
    shop.adoptGuestJournal(u.id)
    setPanel(null)
    sound.play('sparkle')
    say(`Welcome to the shop, ${u.name}. The jar is yours.`)
  }
  const onLogIn = async (details) => {
    const u = await auth.logIn(details)
    setPanel(null)
    sound.play('chime')
    say(`Welcome back, ${u.name}.`)
  }
  const onLogOut = async () => {
    await auth.logOut()
    setPanel(null)
    setCategory(null)
    say('Signed out. Come back soon.')
  }

  // ---- words that change with the visitor
  const guestOut = !shop.demo && !shop.isMember && shop.freeLeft === 0 && !shop.pendingFortune
  const jarHint = shop.pendingFortune ? 'Your cookie is waiting.' : guestOut ? 'Sign up to open more.' : 'Choose a little fortune.'
  const footnote = shop.demo
    ? 'Demo mode: open as many as you like.'
    : shop.isMember
    ? 'Members may open as many as they like.'
    : shop.freeLeft === 0
      ? 'That was your last free fortune. Sign up to keep opening.'
      : `You have ${shop.freeLeft} free ${shop.freeLeft === 1 ? 'fortune' : 'fortunes'} left.`

  return (
    <main className={`app ${ritual ? 'has-ritual' : ''}`}>
      <GoldDefs />
      <ShopScene ref={jarRef} layout={layout} mood={mood} onJar={onJar} onProp={onProp} jarState={jarState} todayDrawn={guestOut} jarHint={jarHint} />

      <div className="hud" aria-hidden={!!ritual}>
        <Title />
        <AboutLantern onClick={() => openPanel('about')} />
        <AccountTag user={auth.user} freeLeft={shop.freeLeft} demo={shop.demo} onClick={() => openPanel('account')} />
        <JournalBook count={shop.kept.length} onClick={() => openPanel('journal')} />
        <SoundControls
          muted={shop.soundSettings.muted}
          onToggle={() => {
            sound.unlock()
            shop.setSoundSettings((s) => ({ ...s, muted: !s.muted }))
          }}
          onSettings={() => openPanel('sound')}
        />
        <CategoryCord selected={category} onSelect={onTag} resting={guestOut} />
      </div>

      <Whisper whisper={whisper} />

      {ritual && (
        <FortuneRitual
          key={`${ritual.mode}-${ritual.fortune.id}-${ritual.entry.at}`}
          mode={ritual.mode}
          fortune={ritual.fortune}
          origin={ritual.origin}
          rollWidth={ritual.rollWidth || 40}
          note={ritual.note}
          footnote={footnote}
          kept={shop.isKept(ritual.fortune.id, ritual.entry.at)}
          onOpened={() => shop.markOpened(ritual.entry.at)}
          onKeep={keepCurrent}
          onClose={closeRitual}
          onAnother={another}
        />
      )}

      <JournalPanel
        open={panel === 'journal'}
        onClose={() => setPanel(null)}
        user={auth.user}
        kept={shop.kept}
        history={shop.history}
        isKept={shop.isKept}
        keep={shop.keep}
        unkeep={shop.unkeep}
        onUnfold={(fortune, entry) => {
          setPanel(null)
          setRitual({ mode: 'paper', fortune, entry, origin: center(), note: null })
        }}
      />
      <AccountPanel
        open={panel === 'account'}
        onClose={() => setPanel(null)}
        user={auth.user}
        reason={accountReason}
        freeLeft={shop.freeLeft}
        stats={{ opened: shop.history.length, kept: shop.kept.length }}
        onSignUp={onSignUp}
        onLogIn={onLogIn}
        onLogOut={onLogOut}
      />
      <AboutPanel
        open={panel === 'about'}
        onClose={() => setPanel(null)}
        isMember={shop.isMember}
        onForget={() => {
          shop.forgetJournal()
          say('The journal is blank again.')
        }}
      />
      <SoundPanel
        open={panel === 'sound'}
        onClose={() => setPanel(null)}
        settings={shop.soundSettings}
        onChange={(patch) => {
          sound.unlock()
          shop.setSoundSettings((s) => ({ ...s, ...patch }))
        }}
      />
    </main>
  )
}
