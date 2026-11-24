import { useEffect, useRef, useState } from 'react'
import { sound } from '../lib/audio.js'
import { asset } from '../lib/assets.js'
import { PaperButton, RolledScroll } from './common.jsx'
import FortunePaper from './FortunePaper.jsx'

// draw:   shake → rise → fly → cookie
// cookie: cookie (waits for a touch) → crack → split → emerge → unfold → text → done
const DRAW_STEPS = [
  ['shake', 0],
  ['rise', 650],
  ['fly', 1600],
  ['cookie', 2850],
]
const OPEN_STEPS = [
  ['crack', 0],
  ['split', 330],
  ['emerge', 800],
  ['unfold', 1350],
  ['text', 2050],
  ['done', 2750],
]

export default function FortuneRitual({ mode, fortune, origin, rollWidth, kept, note, footnote, onOpened, onKeep, onClose, onAnother }) {
  const [step, setStep] = useState(mode === 'paper' ? 'done' : mode === 'cookie' ? 'cookie' : 'shake')
  const timers = useRef([])
  const run = (steps) => {
    timers.current.forEach(clearTimeout)
    timers.current = steps.map(([name, at]) => setTimeout(() => setStep(name), at))
  }

  useEffect(() => {
    if (mode === 'draw') run(DRAW_STEPS)
    const t = timers
    return () => t.current.forEach(clearTimeout)
  }, [mode])

  // sounds tied to the steps
  useEffect(() => {
    if (step === 'rise') sound.play('rustle')
    if (step === 'crack') sound.play('crack')
    if (step === 'emerge') sound.play('rustle')
    if (step === 'unfold') sound.play('unfold')
    if (step === 'text') {
      onOpened()
      if (fortune.rarity === 'rare' || fortune.rarity === 'very-rare') sound.play('sparkle')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && step === 'done' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [step, onClose])

  const openCookie = () => {
    if (step !== 'cookie') return
    run(OPEN_STEPS)
  }

  const order = ['shake', 'rise', 'fly', 'cookie', 'crack', 'split', 'emerge', 'unfold', 'text', 'done']
  const at = (name) => order.indexOf(step) >= order.indexOf(name)
  const rollVisible = mode === 'draw' && !at('crack')

  return (
    <div className={`ritual mode-${mode} step-${step}`} style={{ '--ox': `${origin.x}px`, '--oy': `${origin.y}px`, '--roll-w': `${rollWidth}px` }}>
      <div className="ritual-dim" aria-hidden="true" />
      <div className="ritual-glow" aria-hidden="true" />

      {rollVisible && (
        <div className={`roll-clip ${at('fly') ? 'unclipped' : ''}`} aria-hidden="true">
          <div className="roll-flight">
            <RolledScroll />
          </div>
        </div>
      )}

      {at('cookie') && (
        <div className="cookie-stage">
          <button type="button" className="cookie-button" onClick={openCookie} disabled={step !== 'cookie'} aria-label="Open the fortune cookie">
            <img className="cookie-whole" src={asset('cookies/cookie-whole.webp')} alt="" draggable="false" />
            <img className="cookie-half left" src={asset('cookies/cookie-half-left.webp')} alt="" draggable="false" />
            <img className="cookie-half right" src={asset('cookies/cookie-half-right.webp')} alt="" draggable="false" />
            <span className="crumbs" aria-hidden="true">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <img key={i} src={asset('cookies/crumbs.webp')} alt="" style={{ '--i': i }} />
              ))}
            </span>
          </button>
          <p className="ritual-hint">Touch the cookie to open it.</p>
        </div>
      )}

      {at('emerge') && (
        <div className="paper-stage">
          <div className="paper-unfold">
            <FortunePaper fortune={fortune} showText={at('text')} />
          </div>
          <div className="ritual-actions" aria-hidden={!at('done')}>
            <PaperButton onClick={onKeep} disabled={kept} className={kept ? 'is-kept' : ''}>
              {kept ? 'Kept in your journal' : 'Keep this fortune'}
            </PaperButton>
            <PaperButton variant={2} onClick={onAnother}>
              Another fortune
            </PaperButton>
            <p className="ritual-footnote">
              {footnote}{' '}
              <button type="button" className="ink-link light" onClick={onClose}>
                back to the shop
              </button>
            </p>
          </div>
        </div>
      )}
      {note && at('done') && (
        <aside className="shopkeeper-note">
          <span>{note}</span>
        </aside>
      )}
    </div>
  )
}
