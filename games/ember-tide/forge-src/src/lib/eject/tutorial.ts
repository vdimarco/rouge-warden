





/** what is flying the jet: a pointer and keys, fingers, a PlayStation controller, or another controller */
 



const STEPS = [
  { id: 'turn', group: 'Fly', drill: 'calm' },
  { id: 'climb', group: 'Fly', drill: 'calm' },
  { id: 'dive', group: 'Fly', drill: 'calm' },
  { id: 'thrust', group: 'Fly', drill: 'calm' },
  { id: 'view', group: 'Fly', drill: 'calm' },
  { id: 'roll', group: 'Tricks', drill: 'calm' },
  { id: 'backflip', group: 'Tricks', drill: 'calm' },
  { id: 'frontflip', group: 'Tricks', drill: 'calm' },
  { id: 'lock', group: 'Fight', drill: 'target' },
  { id: 'cannon', group: 'Fight', drill: 'target' },
  { id: 'missile', group: 'Fight', drill: 'target' },
  { id: 'dodge', group: 'Fight', drill: 'attack' },
  { id: 'counter', group: 'Fight', drill: 'attack' },
  { id: 'eject', group: 'Bail out', drill: 'calm' },
]

/** where the tutorial has got to, for the card on screen (null while it is not running) */
 













/** the words of a step, for whatever is flying the jet (stick: down climbs and up dives, like a flight stick) */
export function lessonWords(id, flyer, stick, view) {
  const pad = flyer === 'ps' || flyer === 'pad'
  const ps = flyer === 'ps'
  const touch = flyer === 'touch'
  const overhead = view === 'top'
  const climbKey = stick ? 'S' : 'W'
  const diveKey = stick ? 'W' : 'S'
  const rollWith = pad ? (ps ? 'press ✕' : 'press A') : touch ? 'tap' : 'click'
  const missileWith = pad ? (ps ? 'press ○' : 'press B') : touch ? 'tap Missile' : 'press M'
  switch (id) {
    case 'turn':
      return {
        title: 'Turn',
        how: pad ? 'Left stick, left and right.' : touch ? 'Drag left and right.' : overhead ? 'Move the pointer to where you want to go, or hold A or D.' : 'Point left or right of the jet, or hold A or D.',
      }
    case 'climb':
      return {
        title: 'Climb',
        how: pad
          ? stick ? 'Pull the stick back.' : 'Push the stick forward.'
          : touch
            ? stick ? 'Drag down.' : 'Drag up.'
            : overhead ? `Hold ${climbKey}. (From overhead the pointer only turns.)` : `Point ${stick ? 'below' : 'above'} the jet, or hold ${climbKey}.`,
      }
    case 'dive':
      return {
        title: 'Dive',
        how:
          (pad
            ? stick ? 'Push the stick forward.' : 'Pull the stick back.'
            : touch
              ? stick ? 'Drag up.' : 'Drag down.'
              : overhead ? `Hold ${diveKey}.` : `Point ${stick ? 'above' : 'below'} the jet, or hold ${diveKey}.`) + ' Level out before the ground.',
      }
    case 'thrust':
      return { title: 'Thrusters', how: pad ? `Squeeze ${ps ? 'R2' : 'RT'} and hold it.` : touch ? 'Hold Boost.' : 'Hold the left mouse button, or Shift.' }
    case 'view':
      return {
        title: 'Change view',
        how: `${pad ? `Press ${ps ? '△' : 'Y'}.` : touch ? 'Tap View.' : 'Press Space.'} Overhead, chase, cockpit: each press is the next.`,
      }
    case 'roll':
      return { title: 'Roll', how: pad ? `Press ${ps ? '✕' : 'A'}.` : touch ? 'Tap the sky.' : 'Click once.' }
    case 'backflip':
      return {
        title: 'Back flip',
        how: `Thrusters on, climb as hard as it goes, and hold both until it has come right round. ${pad ? (ps ? 'L1' : 'LB') : touch ? 'Loop' : 'F'} flies one for you.`,
      }
    case 'frontflip':
      return {
        title: 'Front flip',
        how: `Thrusters on, dive as hard as it goes, and hold both right round. It needs height.${touch ? '' : ` ${pad ? (ps ? 'R1' : 'RB') : 'G'} flies one for you.`}`,
      }
    case 'cannon':
      return { title: 'Cannon', how: `${pad ? `Hold ${ps ? '□' : 'X'}` : touch ? 'Hold Gun' : 'Hold the right mouse button'} to fire. Five hits bring a jet down.` }
    case 'lock':
      return { title: 'Lock on', how: 'A practice drone has come in ahead, off to one side. Turn to it and hold it in front of you until its box turns red.' }
    case 'missile':
      return { title: 'Missile', how: `With the box red, ${missileWith}. The missile finds the drone by itself.` }
    case 'dodge':
      return { title: 'Dodge a missile', how: `An enemy is going to fire at you. Roll (${rollWith}) just as the two rings meet. In training it cannot hurt you.` }
    case 'counter':
      return { title: 'Counter-attack', how: `Dodge another, and ${missileWith} the moment you have: three missiles go at once.` }
    case 'eject':
      return { title: 'Bail out', how: 'Last one. Thrusters off, dive into the ground, and hold it.' }
  }
}

 

/**
 * `change` is told whenever what the card should show changes (null: the tutorial is over);
 * `chime` when a step has been done (2) or all of them (3).
 */
export function createTutorial(scene, tell) {
  let steps = []
  let at = -1 // the step it is on (-1: not running)
  let phase = 'do'
  let wait = 0 // seconds until it moves on
  let flyer = 'pointer'
  // how things stood when the step began, and what has been done in it since
  const base = { rolls: 0, back: 0, fwd: 0, rounds: 0, launched: 0, downed: 0, struck: 0, evades: 0, counters: 0 }
  let turned = 0
  let rose = 0
  let fell = 0
  let held = 0
  let lastYaw = 0
  let lastZ = 0
  let view0 = 'top'
  let bailed = false
  let hitT = 0 // seconds since a missile last got through
  let shown = ''

  const mark = () => {
    const d = scene.did
    base.rolls = d.rolls
    base.back = d.back
    base.fwd = d.fwd
    base.rounds = d.rounds
    base.launched = d.launched
    base.downed = d.downed
    base.struck = d.struck
    base.evades = d.evades
    base.counters = d.counters
  }
  const enter = (n) => {
    at = n
    phase = 'do'
    turned = 0
    rose = 0
    fell = 0
    held = 0
    bailed = false
    hitT = 99
    const d = scene.did
    lastYaw = d.yaw
    lastZ = d.z
    view0 = scene.view
    scene.drill(steps[n].drill)
  }
  const next = () => {
    if (at + 1 < steps.length) enter(at + 1)
    else {
      // that was the last: the sky fills up again
      phase = 'end'
      wait = 4
      scene.drill('')
      tell.chime(3)
    }
  }
  const send = (progress, hint) => {
    const s = steps[at]
    const view = scene.view
    const p = Math.round(Math.min(1, Math.max(0, progress)) * 40) / 40
    const sig = `${at}|${phase}|${p}|${hint}|${view}`
    if (sig === shown) return
    shown = sig
    tell.change({ index: at, count: steps.length, id: s.id, group: s.group, phase, progress: p, hint, view })
  }
  const over = () => phase === 'end' // (asked through a function: the compiler loses track of it across next())
  const stop = () => {
    if (at < 0) return
    at = -1
    shown = ''
    scene.drill('')
    tell.change(null)
  }

  return {
    get on() { return at >= 0 },
    /** who is flying (it changes which things can be asked for, and a hint or two) */
    setFlyer(f) { flyer = f },
    /** begin, with the steps that can be done as things are set up: `armed` with weapons, `crash` with crashes on */
    start(o) {
      steps = STEPS.filter((s) => {
        if (s.group === 'Fight') return o.armed
        if (s.id === 'eject') return o.crash
        return true
      })
      shown = ''
      mark()
      enter(0)
      send(0, '')
    },
    stop,
    /** on to the next step without doing this one */
    skip() {
      if (at < 0 || phase === 'end') return
      mark()
      next()
      send(over() ? 1 : 0, '')
    },
    /** once a frame, with the time that has really passed */
    tick(dt) {
      if (at < 0) return
      const d = scene.did
      if (phase === 'end') {
        wait -= dt
        if (wait <= 0) stop()
        else send(1, '')
        return
      }
      if (phase === 'done') {
        wait -= dt
        if (wait <= 0) next()
        send(over() || phase === 'done' ? 1 : 0, '')
        return
      }
      const id = steps[at].id
      let progress = 0
      let hint = ''
      const turn = Math.atan2(Math.sin(d.yaw - lastYaw), Math.cos(d.yaw - lastYaw))
      const dz = d.z - lastZ
      lastYaw = d.yaw
      lastZ = d.z
      if (d.struck > base.struck) { base.struck = d.struck; hitT = 0 }
      hitT += dt
      const flat = scene.view === 'top' && flyer === 'touch' ? 'Tap View first: from overhead a drag only turns.' : ''
      if (d.out && id !== 'eject') hint = 'A new jet is coming for you. Sit tight.'
      else {
        switch (id) {
          case 'turn':
            if (d.hands && Math.abs(turn) < 0.5) turned += Math.abs(turn)
            progress = turned / 1.3
            break
          case 'climb':
            if (d.hands && dz > 0 && dz < 30) rose += dz
            progress = rose / 45
            hint = flat
            break
          case 'dive':
            if (d.hands && dz < 0 && dz > -30) fell -= dz
            progress = fell / 45
            hint = flat || (d.height < 50 ? 'Too low to dive: climb a little first.' : '')
            break
          case 'thrust':
            if (d.boost > 0.6) held += dt
            progress = held / 1.5
            break
          case 'view':
            progress = scene.view !== view0 ? 1 : 0
            break
          case 'roll':
            progress = d.rolls > base.rolls ? 1 : 0
            break
          case 'backflip':
            progress = d.back > base.back ? 1 : 0
            hint = flat
            break
          case 'frontflip':
            progress = d.fwd > base.fwd ? 1 : 0
            hint = flat || (d.height < 170 ? 'Climb higher first: it needs room underneath.' : '')
            break
          case 'cannon':
            progress = (d.rounds - base.rounds) / 24
            hint = d.gunDry ? 'Out of rounds: it is reloading.' : ''
            break
          case 'lock':
            progress = d.lock
            hint = d.foe ? '' : 'A new drone is on its way.'
            break
          case 'missile':
            progress = d.downed > base.downed ? 1 : 0
            hint = !d.foe ? 'A new drone is on its way.' : d.missilesDry ? 'Out of missiles: they are reloading.' : d.lock < 1 && d.launched === base.launched ? 'Lock on first: hold it ahead until the box turns red.' : ''
            break
          case 'dodge':
            progress = d.evades > base.evades ? 1 : 0
            hint = d.threat < 90 ? 'Missile inbound. Roll as the rings meet.' : hitT < 3.5 ? 'It got you. Here comes another.' : 'An enemy is coming round behind you.'
            break
          case 'counter':
            progress = d.counters > base.counters ? 1 : 0
            hint = d.counterOpen ? 'Now! Fire!' : d.threat < 90 ? 'Missile inbound. Dodge it first.' : 'Wait for the next missile.'
            break
          case 'eject':
            if (d.out) bailed = true
            progress = bailed ? (d.out ? 0.5 : 1) : 0
            hint = bailed ? 'Good. A new jet is coming for you.' : d.boost > 0.3 ? 'Thrusters off: with them on it flips instead.' : ''
            break
        }
      }
      if (progress >= 1) {
        phase = 'done'
        wait = id === 'dodge' ? 0.3 : 1
        hint = ''
        mark() // (what is done from here on counts towards the next step: a counter fired at once, say)
        tell.chime(2)
      }
      send(progress, hint)
    },
  }
}
