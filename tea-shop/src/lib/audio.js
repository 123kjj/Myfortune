// Procedural sound for the shop, made with the Web Audio API.
// Nothing is created or played until the visitor interacts with the page.

let ctx = null
let master, sfxBus, ambBus
let noiseBuf = null
let pinkBuf = null
let ambient = null
const settings = { sfx: true, ambient: true, sfxVolume: 0.7, ambientVolume: 0.5, muted: false }

function ensure() {
  if (ctx) return ctx
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return null
  ctx = new AC()
  master = ctx.createGain()
  master.connect(ctx.destination)
  sfxBus = ctx.createGain()
  ambBus = ctx.createGain()
  sfxBus.connect(master)
  ambBus.connect(master)
  noiseBuf = makeNoise(2, 'white')
  pinkBuf = makeNoise(6, 'pink')
  applyLevels()
  return ctx
}

function makeNoise(seconds, kind) {
  const len = Math.floor(ctx.sampleRate * seconds)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1
    if (kind === 'white') {
      d[i] = w
    } else {
      b0 = 0.99886 * b0 + w * 0.0555179
      b1 = 0.99332 * b1 + w * 0.0750759
      b2 = 0.969 * b2 + w * 0.153852
      b3 = 0.8665 * b3 + w * 0.3104856
      b4 = 0.55 * b4 + w * 0.5329522
      b5 = -0.7616 * b5 - w * 0.016898
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11
      b6 = w * 0.115926
    }
  }
  // fade the loop seam
  const f = Math.floor(ctx.sampleRate * 0.05)
  for (let i = 0; i < f; i++) {
    d[i] *= i / f
    d[len - 1 - i] *= i / f
  }
  return buf
}

function applyLevels() {
  if (!ctx) return
  const t = ctx.currentTime
  master.gain.setTargetAtTime(settings.muted ? 0 : 1, t, 0.08)
  sfxBus.gain.setTargetAtTime(settings.sfx ? settings.sfxVolume * 0.9 : 0, t, 0.08)
  ambBus.gain.setTargetAtTime(settings.ambient ? settings.ambientVolume * 0.8 : 0, t, 0.4)
}

// ---------------------------------------------------------------- helpers
function noiseBurst({ at = 0, dur = 0.08, freq = 3000, q = 1, gain = 0.2, type = 'bandpass', attack = 0.004, rate = 1 }) {
  const t = ctx.currentTime + at
  const src = ctx.createBufferSource()
  src.buffer = noiseBuf
  src.playbackRate.value = rate
  const filt = ctx.createBiquadFilter()
  filt.type = type
  filt.frequency.value = freq
  filt.Q.value = q
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(gain, t + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  src.connect(filt).connect(g).connect(sfxBus)
  src.start(t, Math.random() * 1.5)
  src.stop(t + dur + 0.05)
}

function bell({ at = 0, freq = 1200, partials = [1, 2.76, 5.4], decay = 1.2, gain = 0.08, bus = sfxBus }) {
  const t = ctx.currentTime + at
  partials.forEach((p, i) => {
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.value = freq * p
    const g = ctx.createGain()
    const peak = gain / (i + 1)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(peak, t + 0.004)
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay / (1 + i * 0.6))
    o.connect(g).connect(bus)
    o.start(t)
    o.stop(t + decay + 0.1)
  })
}

const rnd = (a, b) => a + Math.random() * (b - a)

// ---------------------------------------------------------------- effects
const EFFECTS = {
  rustle() {
    for (let i = 0; i < 9; i++) {
      noiseBurst({ at: i * rnd(0.035, 0.07), dur: rnd(0.04, 0.11), freq: rnd(2500, 6000), q: 0.8, gain: rnd(0.05, 0.12) })
    }
  },
  jar() {
    // low wooden thump + glassy ceramic clinks + papers shifting inside
    noiseBurst({ dur: 0.18, freq: 180, q: 0.7, gain: 0.25, type: 'lowpass', attack: 0.01 })
    for (let i = 0; i < 5; i++) bell({ at: 0.06 + i * rnd(0.07, 0.13), freq: rnd(1900, 3200), partials: [1, 2.3], decay: 0.25, gain: 0.025 })
    for (let i = 0; i < 6; i++) noiseBurst({ at: 0.1 + i * 0.07, dur: 0.06, freq: rnd(2000, 4500), q: 1, gain: 0.05 })
  },
  crack() {
    noiseBurst({ dur: 0.03, freq: 2600, q: 0.9, gain: 0.35, type: 'highpass', attack: 0.001 })
    noiseBurst({ at: 0.03, dur: 0.05, freq: 1500, q: 1.2, gain: 0.22, attack: 0.001 })
    for (let i = 0; i < 6; i++) noiseBurst({ at: 0.06 + i * rnd(0.015, 0.04), dur: rnd(0.015, 0.035), freq: rnd(3000, 7000), q: 2, gain: rnd(0.05, 0.12), attack: 0.001 })
  },
  unfold() {
    const t = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = noiseBuf
    const filt = ctx.createBiquadFilter()
    filt.type = 'bandpass'
    filt.Q.value = 0.9
    filt.frequency.setValueAtTime(900, t)
    filt.frequency.exponentialRampToValueAtTime(4200, t + 0.45)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.09, t + 0.12)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6)
    src.connect(filt).connect(g).connect(sfxBus)
    src.start(t)
    src.stop(t + 0.7)
    for (let i = 0; i < 4; i++) noiseBurst({ at: 0.15 + i * 0.09, dur: 0.05, freq: rnd(3000, 5500), gain: 0.04 })
  },
  ceramic() {
    bell({ freq: 1320, partials: [1, 2.02, 3.1, 4.7], decay: 0.7, gain: 0.09 })
    bell({ at: 0.16, freq: 1385, partials: [1, 2.1, 3.3], decay: 0.4, gain: 0.04 })
  },
  chime() {
    const notes = [1568, 1760, 2093, 2349, 2637]
    for (let i = 0; i < 3; i++) bell({ at: i * rnd(0.12, 0.3), freq: notes[Math.floor(Math.random() * notes.length)], partials: [1, 2.76, 5.4], decay: 2.6, gain: 0.03 })
  },
  sparkle() {
    ;[2093, 2637, 3136, 4186].forEach((f, i) => bell({ at: i * 0.09, freq: f, partials: [1, 2.4], decay: 1.4, gain: 0.025 }))
  },
  tick() {
    noiseBurst({ dur: 0.025, freq: 3500, q: 3, gain: 0.05, attack: 0.001 })
  },
  page() {
    noiseBurst({ dur: 0.22, freq: 1800, q: 0.6, gain: 0.07, attack: 0.03 })
    noiseBurst({ at: 0.1, dur: 0.12, freq: 4200, q: 0.8, gain: 0.04 })
  },
}

// ---------------------------------------------------------------- ambience
function startAmbient() {
  if (!ctx || ambient) return
  const rain = ctx.createBufferSource()
  rain.buffer = pinkBuf
  rain.loop = true
  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 350
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 2600
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, ctx.currentTime)
  g.gain.exponentialRampToValueAtTime(0.32, ctx.currentTime + 4)
  rain.connect(hp).connect(lp).connect(g).connect(ambBus)
  rain.start()

  // individual drops on the eaves
  const drip = setInterval(() => {
    if (!settings.ambient || settings.muted || document.hidden) return
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    o.frequency.setValueAtTime(rnd(900, 2200), t)
    o.frequency.exponentialRampToValueAtTime(rnd(300, 600), t + 0.05)
    const gg = ctx.createGain()
    gg.gain.setValueAtTime(0.0001, t)
    gg.gain.exponentialRampToValueAtTime(rnd(0.006, 0.018), t + 0.003)
    gg.gain.exponentialRampToValueAtTime(0.0001, t + 0.07)
    o.connect(gg).connect(ambBus)
    o.start(t)
    o.stop(t + 0.1)
  }, 140)

  // a wind chime now and then
  let chimeTimer
  const chimeLoop = () => {
    chimeTimer = setTimeout(() => {
      if (settings.ambient && !settings.muted && !document.hidden) {
        const notes = [1318, 1568, 1760, 2093, 2349]
        const n = 2 + Math.floor(Math.random() * 3)
        for (let i = 0; i < n; i++) bell({ at: i * rnd(0.2, 0.55), freq: notes[Math.floor(Math.random() * notes.length)], decay: 3.2, gain: 0.022, bus: ambBus })
      }
      chimeLoop()
    }, rnd(14000, 30000))
  }
  chimeLoop()
  ambient = { rain, drip, get chimeTimer() { return chimeTimer } }
}

// ---------------------------------------------------------------- public api
export const sound = {
  /** Call from a user gesture. Creates the audio context and, if enabled, the rain. */
  unlock() {
    if (!ensure()) return
    if (ctx.state === 'suspended') ctx.resume()
    if (settings.ambient) startAmbient()
  },
  play(name) {
    if (!ctx || !settings.sfx || settings.muted) return
    if (ctx.state === 'suspended') ctx.resume()
    EFFECTS[name]?.()
  },
  configure(next) {
    Object.assign(settings, next)
    if (ctx) {
      applyLevels()
      if (settings.ambient && !settings.muted) startAmbient()
    }
  },
  get started() {
    return !!ctx
  },
}
