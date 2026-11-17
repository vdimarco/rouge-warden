// The scene's sound. Four beds that never stop (the engine, its afterburner, open air, the
// dive warning) are mixed from how things stand each frame; everything that happens once (the
// seat firing, the crash, the parachute, the canopy shutting …) is a sound played on top.
// The recordings were made with tools/gen-sounds.mjs.
//
// A browser lets a page make sound only once it has been clicked or a key pressed, so nothing
// is loaded or played until unlock() is called from such a moment.
const engineUrl = new URL('../../assets/sounds/engine.mp3', import.meta.url).href
const afterburnerUrl = new URL('../../assets/sounds/afterburner.mp3', import.meta.url).href
const windUrl = new URL('../../assets/sounds/wind.mp3', import.meta.url).href
const alarmUrl = new URL('../../assets/sounds/alarm.mp3', import.meta.url).href
const rollUrl = new URL('../../assets/sounds/roll.mp3', import.meta.url).href
const ejectUrl = new URL('../../assets/sounds/eject.mp3', import.meta.url).href
const explosionUrl = new URL('../../assets/sounds/explosion.mp3', import.meta.url).href
const splashUrl = new URL('../../assets/sounds/splash.mp3', import.meta.url).href
const chuteUrl = new URL('../../assets/sounds/chute.mp3', import.meta.url).href
const flybyUrl = new URL('../../assets/sounds/flyby.mp3', import.meta.url).href
const seatUrl = new URL('../../assets/sounds/seat.mp3', import.meta.url).href
const canopyUrl = new URL('../../assets/sounds/canopy.mp3', import.meta.url).href
const kickUrl = new URL('../../assets/sounds/kick.mp3', import.meta.url).href
const swishUrl = new URL('../../assets/sounds/swish.mp3', import.meta.url).href
const wakeUrl = new URL('../../assets/sounds/wake.mp3', import.meta.url).href
const gunUrl = new URL('../../assets/sounds/gun.mp3', import.meta.url).href
const missileUrl = new URL('../../assets/sounds/missile.mp3', import.meta.url).href
const blastUrl = new URL('../../assets/sounds/blast.mp3', import.meta.url).href
const guntailUrl = new URL('../../assets/sounds/guntail.mp3', import.meta.url).href
const hitUrl = new URL('../../assets/sounds/hit.mp3', import.meta.url).href
const cloudUrl = new URL('../../assets/sounds/cloud.mp3', import.meta.url).href
const slowmoUrl = new URL('../../assets/sounds/slowmo.mp3', import.meta.url).href
const emptyUrl = new URL('../../assets/sounds/empty.mp3', import.meta.url).href
const reloadUrl = new URL('../../assets/sounds/reload.mp3', import.meta.url).href
const radioIn1 = new URL('../../assets/sounds/radio-in1.mp3', import.meta.url).href
const radioIn2 = new URL('../../assets/sounds/radio-in2.mp3', import.meta.url).href
const radioIn3 = new URL('../../assets/sounds/radio-in3.mp3', import.meta.url).href
const radioOut1 = new URL('../../assets/sounds/radio-out1.mp3', import.meta.url).href
const radioOut2 = new URL('../../assets/sounds/radio-out2.mp3', import.meta.url).href
const radioOut3 = new URL('../../assets/sounds/radio-out3.mp3', import.meta.url).href

/** how things stand, as the scene reports it (see its `audio`) */
 

const BEDS = { engine: engineUrl, afterburner: afterburnerUrl, wind: windUrl, alarm: alarmUrl, wake: wakeUrl, gun: gunUrl }
// each one-off sound: its recordings (one is picked each time), and how loud it is played
const SHOTS = {
  roll: [[rollUrl], 0.4],
  eject: [[ejectUrl], 0.9],
  explosion: [[explosionUrl], 1],
  splash: [[splashUrl], 1],
  chute: [[chuteUrl], 0.75],
  flyby: [[flybyUrl], 0.6],
  seat: [[seatUrl], 0.9],
  canopy: [[canopyUrl], 0.65],
  kick: [[kickUrl], 0.6],
  swish: [[swishUrl], 0.22],
  missile: [[missileUrl], 0.6],
  blast: [[blastUrl], 0.55],
  kill: [[explosionUrl], 0.7], // an enemy shot down
  guntail: [[guntailUrl], 0.8], // the cannon's last rounds and their echo, as the trigger is let go
  hit: [[hitUrl], 0.9], // the enemy's rounds striking the jet
  cloud: [[cloudUrl], 0.5], // into a cloud
  empty: [[emptyUrl], 0.75], // the cannon run dry, or a trigger pulled with nothing left to fire
  reload: [[reloadUrl], 0.7], // … and loaded again
  foeMissile: [[missileUrl], 0.28], // the enemy fires one
  evade: [[rollUrl], 0.7], // … and it is thrown off
  slowmo: [[slowmoUrl], 0.9], // … and time slows as it goes by
  // the radio, kept low: the pilot of the jet coming in, then a word once he is aboard
  radioIn: [[radioIn1, radioIn2, radioIn3], 0.42],
  radioOut: [[radioOut1, radioOut2, radioOut3], 0.42],
}

 

export function createSound() {
  let ctx = null
  let master = null
  let muffle = null // the jet heard from inside its cockpit
  let deep = null // everything, heard as if from under water, while time is slowed
  let over = null // what is heard over that: the sound of time slowing itself
  let level = 0.6
  let on = true
  let dead = false // there is no sound here (no Web Audio, or the files would not load)
  let tone = null // the sights' tone: pips while locking on to an enemy, a steady warble once locked
  let toneGain = null
  let gunOn = 0 // when the player's cannon began firing (0 while it is not)
  let chatter = true // the radio calls
  const said = {} // which recording of each was played last, so the next is another
  const shots = new Map()
  const beds = new Map()

  const load = async (c, url) => {
    const res = await fetch(url)
    if (!res.ok) throw new Error('sound ' + res.status)
    return await c.decodeAudioData(await res.arrayBuffer())
  }

  /**
   * A bed: the recording played twice over, half its length apart, each voice faded to nothing
   * where it wraps round and full where the other does. The seam of the loop is never heard,
   * whatever the file's ends are like, and the two together are as loud all the way through.
   */
  function bed(c, buffer, to) {
    const out = c.createGain()
    out.gain.value = 0
    out.connect(to)
    const t0 = c.currentTime + 0.05
    const fold = c.createWaveShaper()
    const curve = new Float32Array(1025)
    for (let i = 0; i < 1025; i++) curve[i] = Math.abs(i / 512 - 1)
    fold.curve = curve
    for (let v = 0; v < 2; v++) {
      const src = c.createBufferSource()
      src.buffer = buffer
      src.loop = true
      const g = c.createGain()
      g.gain.value = 0
      // |sin| for the first voice, |cos| for the second, once round per play of the recording
      const lfo = c.createOscillator()
      lfo.frequency.value = 1 / (2 * buffer.duration)
      if (v === 1) lfo.setPeriodicWave(c.createPeriodicWave(new Float32Array([0, 1]), new Float32Array([0, 0])))
      const shape = v === 0 ? fold : c.createWaveShaper()
      if (v === 1) shape.curve = curve
      lfo.connect(shape)
      shape.connect(g.gain)
      src.connect(g)
      g.connect(out)
      lfo.start(t0)
      src.start(t0, v === 0 ? 0 : buffer.duration / 2)
    }
    return out
  }

  function start() {
    const AC = window.AudioContext || (window ).webkitAudioContext
    if (!AC) { dead = true; return }
    const c = new AC()
    ctx = c
    master = c.createGain()
    master.gain.value = on ? level : 0
    // (a limit for the loudest moments only, a crash over a roaring engine: set high and slow, so
    // that a steady roar is left alone and never seems to breathe)
    const limit = c.createDynamicsCompressor()
    limit.threshold.value = -4
    limit.knee.value = 6
    limit.ratio.value = 4
    limit.attack.value = 0.01
    limit.release.value = 0.5
    deep = c.createBiquadFilter()
    deep.type = 'lowpass'
    deep.frequency.value = 20000
    deep.Q.value = 0.7
    master.connect(deep)
    deep.connect(limit)
    over = c.createGain()
    over.gain.value = on ? level : 0
    over.connect(limit)
    limit.connect(c.destination)
    muffle = c.createBiquadFilter()
    muffle.type = 'lowpass'
    muffle.frequency.value = 18000
    muffle.Q.value = 0.4
    muffle.connect(master)
    tone = c.createOscillator()
    tone.type = 'square'
    tone.frequency.value = 880
    toneGain = c.createGain()
    toneGain.gain.value = 0
    const soft = c.createBiquadFilter() // (a square wave with its edge taken off)
    soft.type = 'lowpass'
    soft.frequency.value = 2400
    tone.connect(soft)
    soft.connect(toneGain)
    toneGain.connect(master)
    tone.start()
    for (const name of Object.keys(BEDS)) {
      load(c, BEDS[name])
        .then((buffer) => { if (ctx === c && master && muffle) beds.set(name, bed(c, buffer, name === 'alarm' || name === 'gun' ? master : muffle)) })
        .catch(() => { /* that bed stays silent */ })
    }
    for (const name of Object.keys(SHOTS)) {
      const takes = []
      shots.set(name, takes)
      for (const url of SHOTS[name][0]) {
        load(c, url)
          .then((buffer) => { if (ctx === c) takes.push(buffer) })
          .catch(() => { /* that recording is left out */ })
      }
    }
  }

  const glide = (g, to, c, seconds = 0.12) => {
    if (g) g.gain.setTargetAtTime(to, c.currentTime, seconds)
  }

  return {
    /** call from a click, a touch or a key: starts the sound if it has not started (or wakes it) */
    unlock() {
      if (dead || !on) return
      if (!ctx) start()
      else if (ctx.state === 'suspended') ctx.resume().catch(() => {})
    },
    /** true once the sound has been started */
    get started() { return !!ctx },
    /** one of the things that happen once */
    play(name) {
      const c = ctx
      const takes = shots.get(name)
      if (!c || !master || !takes || !takes.length || !on || c.state !== 'running') return
      if (!chatter && name.startsWith('radio')) return
      const pick = takes.length > 1 ? ((said[name] ?? -1) + 1 + Math.floor(Math.random() * (takes.length - 1))) % takes.length : 0
      said[name] = pick
      const src = c.createBufferSource()
      src.buffer = takes[pick]
      const g = c.createGain()
      g.gain.value = SHOTS[name][1]
      src.connect(g)
      g.connect(name === 'slowmo' && over ? over : master)
      src.start()
    },
    /** mix the beds for how things stand */
    update(s) {
      const c = ctx
      if (!c || !muffle) return
      const inside = Math.min(1, Math.max(0, s.cockpit))
      const speed = Math.min(1.8, Math.max(0, s.speed))
      // while time is slowed, everything sinks to a murmur, and comes back up with it
      if (deep) deep.frequency.setTargetAtTime(20000 * Math.pow(420 / 20000, Math.min(1, Math.max(0, s.slow))), c.currentTime, 0.04)
      // the player's own cannon is the loudest thing there is: everything else gives way to it
      const mine = s.gun >= 1
      const duck = mine ? 0.5 : 1
      if (mine && !gunOn) gunOn = c.currentTime
      else if (!mine && gunOn) {
        // the trigger let go after a real burst: its last rounds, and the echo rolling away
        if (c.currentTime - gunOn > 0.2) this.play('guntail')
        gunOn = 0
      }
      glide(beds.get('engine'), s.jet * (0.2 + 0.1 * speed) * (1 + 0.25 * inside) * duck, c)
      glide(beds.get('afterburner'), s.jet * Math.pow(Math.min(1, Math.max(0, s.boost)), 1.3) * 0.5 * duck, c, 0.08)
      // open air past the pilot's ears; a breath of it over the canopy at speed; more of it in cloud
      glide(beds.get('wind'), Math.max(s.air * 0.9, s.jet * (0.12 * speed + 0.3 * s.cloud)) * duck, c, 0.25)
      glide(beds.get('alarm'), s.alarm > 0.5 ? 0.3 : 0, c, 0.04)
      // the sights: pips that quicken as the lock comes, then a higher, steady warble
      // (a missile on its way comes before all that: low pips that quicken as it closes, and a
      // high urgent one for the moment in which a roll will throw it off)
      if (tone && toneGain) {
        if (s.threat > 0) {
          const now = s.threat >= 1
          const rate = now ? 22 : 3 + 13 * s.threat
          const pip = Math.floor(c.currentTime * rate) % 2 === 0
          tone.frequency.setTargetAtTime(now ? 1980 : 640, c.currentTime, 0.004)
          toneGain.gain.setTargetAtTime(pip ? (now ? 0.07 : 0.05) : 0, c.currentTime, 0.004)
        } else {
          const locked = s.lock >= 1
          const rate = locked ? 11 : 4 + 6 * s.lock
          const pip = s.lock > 0 && (locked ? Math.floor(c.currentTime * rate) % 3 !== 2 : Math.floor(c.currentTime * rate) % 2 === 0)
          tone.frequency.setTargetAtTime(locked ? 1480 : 990, c.currentTime, 0.005)
          toneGain.gain.setTargetAtTime(pip ? 0.028 : 0, c.currentTime, 0.004)
        }
      }
      // the cannon: on with the trigger and off with it, at once
      // (an enemy's is the same gun, heard from as far off as he is)
      glide(beds.get('gun'), mine ? 1.15 : s.gun * 0.8, c, 0.01)
      // the sea torn up under a jet flying low over it
      glide(beds.get('wake'), s.jet * Math.min(1, Math.max(0, s.spray)) * 0.5, c, 0.1)
      muffle.frequency.setTargetAtTime(18000 * Math.pow(900 / 18000, inside), c.currentTime, 0.15)
    },
    setVolume(v) {
      level = Math.min(1, Math.max(0, v))
      if (ctx && master) {
        master.gain.setTargetAtTime(on ? level : 0, ctx.currentTime, 0.05)
        over?.gain.setTargetAtTime(on ? level : 0, ctx.currentTime, 0.05)
      }
    },
    setOn(v) {
      on = v
      if (ctx && master) {
        master.gain.setTargetAtTime(on ? level : 0, ctx.currentTime, 0.05)
        over?.gain.setTargetAtTime(on ? level : 0, ctx.currentTime, 0.05)
      }
    },
    /** a short rising chime: a step of the tutorial done (three notes when the whole of it is) */
    chime(notes = 2) {
      const c = ctx
      const out = master
      if (!c || !out || !on || c.state !== 'running') return
      const pitches = notes > 2 ? [660, 880, 1320] : [880, 1320]
      pitches.forEach((hz, i) => {
        const osc = c.createOscillator()
        osc.type = 'triangle'
        osc.frequency.value = hz
        const g = c.createGain()
        const t0 = c.currentTime + i * 0.09
        g.gain.setValueAtTime(0, t0)
        g.gain.linearRampToValueAtTime(0.2, t0 + 0.012)
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.3)
        osc.connect(g)
        g.connect(out)
        osc.start(t0)
        osc.stop(t0 + 0.32)
      })
    },
    /** the radio calls during a rescue, on or off */
    setRadio(v) {
      chatter = v
    },
    /** the page has gone out of sight, or come back */
    pause(hidden) {
      if (!ctx) return
      if (hidden) ctx.suspend().catch(() => {})
      else if (on) ctx.resume().catch(() => {})
    },
    dispose() {
      const c = ctx
      ctx = null
      master = null
      muffle = null
      beds.clear()
      shots.clear()
      tone = null
      toneGain = null
      deep = null
      over = null
      if (c) c.close().catch(() => {})
    },
  }
}
