import {jsxs as _jsxs, jsx as _jsx, Fragment as _Fragment} from "react/jsx-runtime";import { useEffect, useRef, useState } from 'react'
// The fighter jet scene with crashes: hold a dive into the ground and the pilot ejects, comes
// down under a parachute and is picked up by a new jet. It has its own copy of the scene
// (src/lib/eject/scene.ts), so the original component is untouched by anything done here.
import { createScene, DEFAULT_PARAMS } from '../lib/eject/scene.ts?v=db15afbc5e9e1488534cc203cbf4aec1b37c7f8a927b916099c1594cc5a27f55'

import { createFlameLayer } from '../lib/flame-layer.ts?v=fed7971be4bec7b2677fac9c8362659f1c71e5b8c1db92782292551234bb28bc'

import { createSound } from '../lib/sound.ts?v=4ef701ea980eb64f05361d1b0451d03bac32e96ee688a352672094dc4857d3c2'

import { createTutorial, lessonWords } from '../lib/eject/tutorial.ts?v=94e82a57a2cdfe68d97c7599b1b78eb0b163e69722b41a863f77a9cf11b5a3ee'

















const KEYS = Object.keys(DEFAULT_PARAMS) 




const padKind = (id) => (/054c|dualsense|dualshock|playstation/i.test(id) ? 'ps' : 'pad')

// Intel: what does what, for whatever is flying the jet, in three short lists.

const lessonsFor = (input, o) => {
  const pad = input === 'ps' || input === 'pad'
  const ps = input !== 'pad'
  const touch = input === 'touch'
  const fly = pad
    ? [
        ['Turn', 'Left stick'],
        ['Climb / dive', o.stick ? 'Stick back climbs, forward dives' : 'Stick forward climbs, back dives'],
        ['Thrusters', `Hold ${ps ? 'R2' : 'RT'}`],
        ['Change view', ps ? '△' : 'Y'],
      ]
    : touch
      ? [
          ['Turn', 'Drag left or right'],
          ['Climb / dive', o.stick ? 'Drag down to climb, up to dive' : 'Drag up to climb, down to dive'],
          ['Thrusters', 'Hold Boost'],
          ['Change view', 'View'],
        ]
      : [
          ['Turn', 'Pointer, or A D / ← →'],
          ['Climb / dive', o.stick ? 'Pointer below the jet climbs, above dives (S / W)' : 'Pointer above the jet climbs, below dives (W / S)'],
          ['Thrusters', 'Hold left mouse, or Shift'],
          ['Change view', 'Space'],
        ]
  const tricks = [
    ['Roll', pad ? (ps ? '✕' : 'A') : touch ? 'Tap' : 'Click'],
    ['Back flip', 'Full climb with thrusters, held'],
    ['Front flip', 'Full dive with thrusters, held. Needs height.'],
    ['Loop, flown for you', pad ? (ps ? 'L1 back · R1 forward' : 'LB back · RB forward') : touch ? 'Loop' : 'F back · G forward'],
  ]
  if (o.crash) tricks.push(['Eject', 'Hold a dive into the ground, thrusters off'])
  const fight = [
    ['Cannon', pad ? (ps ? 'Hold □' : 'Hold X') : touch ? 'Hold Gun' : 'Hold right mouse'],
    ['Lock on', 'Keep an enemy ahead until the box turns red'],
    ['Missile', pad ? (ps ? '○' : 'B') : touch ? 'Missile' : 'M'],
  ]
  if (o.hunted) {
    fight.push(['Dodge a missile', 'Roll as the two rings meet'])
    fight.push(['Counter', `Missile straight after a dodge fires three${o.missiles > 0 ? ', and costs none' : ''}`])
  }
  if (o.ammo > 0 || o.missiles > 0) {
    const load = [o.ammo > 0 ? `${Math.round(o.ammo)} rounds` : '', o.missiles > 0 ? `${Math.round(o.missiles)} missiles` : ''].filter(Boolean).join(', ')
    fight.push(['Ammo', `${load}. Run out and it takes ${+o.reload.toFixed(1)} s to reload`])
  }
  const out = [{ title: 'Fly', rows: fly }, { title: 'Tricks', rows: tricks }]
  if (o.armed) out.push({ title: 'Fight', rows: fight })
  return out
}

// keys that fly the jet: turn, climb / dive and the thrusters
const FLY = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ShiftLeft: 'boost', ShiftRight: 'boost',
  TouchBoost: 'boost', // the on-screen Boost button counts as a key held down
}

export default function FighterJetEject({ pixelSize = 0, showHint = true, touchControls = 'auto', sound = true, volume = 0.6, radio = true, ...rest }) {
  // the sound waits for a click, a touch or a key before it may start
  const soundRef = useRef(null)
  const wake = () => {
    const s = soundRef.current
    if (!s) return
    s.unlock()
  }
  const wakeRef = useRef(wake)
  wakeRef.current = wake
  // true where the graphics card cannot draw the smooth flames: they are drawn in pixels instead
  const [noFire, setNoFire] = useState(false)
  // true on a phone or tablet: its main pointer is a finger, or a finger has touched the scene
  const [fingerScreen, setFingerScreen] = useState(false)
  useEffect(() => {
    if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) setFingerScreen(true)
  }, [])
  const buttons = touchControls === 'on' || (touchControls === 'auto' && fingerScreen)
  const buttonsRef = useRef(buttons)
  buttonsRef.current = buttons
  const [boosting, setBoosting] = useState(false)
  const [shooting, setShooting] = useState(false) // the on-screen Gun button is held
  const [kills, setKills] = useState(0) // enemies shot down
  const killsRef = useRef(0)
  const [hull, setHull] = useState([1, 1]) // hits the jet will still take, of how many
  const hullRef = useRef(-1)
  // what is left to fire: rounds and missiles (max 0: no limit), and how far through reloading each is (0: it is not)
  const [ammo, setAmmo] = useState({ rounds: 0, roundsMax: 0, gunLoad: 0, missiles: 0, missilesMax: 0, missileLoad: 0 })
  const ammoRef = useRef('')
  // a word in the middle of the frame for a moment: a missile thrown off, a counter-attack made
  const [note, setNote] = useState(null)
  const evadesRef = useRef(0)
  const countersRef = useRef(0)
  const noteN = useRef(0)
  // which kind of game controller is flying the jet right now ('' while it is the pointer, keys or fingers)
  const padInputRef = useRef('')
  const [padInput, setPadInput] = useState('')
  const padBusyRef = useRef(false) // true while its stick or trigger is being held
  // the pointer, a finger or a key takes over from the controller: the tutorial's words go back to theirs
  const padLetGo = () => {
    if (!padInputRef.current || padBusyRef.current) return
    padInputRef.current = ''
    setPadInput('')
  }
  const padLetGoRef = useRef(padLetGo)
  padLetGoRef.current = padLetGo
  const heldRef = useRef(new Set()) // the flying keys held down (and the Boost button)
  const sendKeysRef = useRef(() => {})
  // the finger that is steering: which one, when and where it came down, and whether it has moved since
  const steerRef = useRef(null)
  // props → scene settings (anything left out falls back to its default)
  const params = { ...DEFAULT_PARAMS } 
  for (const k of KEYS) {
    const v = (rest )[k]
    if (v !== undefined && v !== null) (params )[k] = v
  }
  if (noFire) params.flameStyle = 'pixel'
  const signature = JSON.stringify(params)

  const wrapRef = useRef(null)
  const canvasRef = useRef(null)
  const fireRef = useRef(null)
  const sceneRef = useRef(null)
  const paramsRef = useRef(params)
  const pixelRef = useRef(pixelSize)
  const triggersRef = useRef({ pad: false, mouse: false, touch: false })
  const soundPropRef = useRef(sound)
  const volumeRef = useRef(volume)
  soundPropRef.current = sound
  volumeRef.current = volume
  const radioRef = useRef(radio)
  radioRef.current = radio
  const scaleRef = useRef(4)
  const layoutRef = useRef(() => {})
  // Intel: a list of the controls, opened from its button. The game stands still while it is open.
  const [intel, setIntel] = useState(false)
  const intelRef = useRef(false)
  const [lessonFor, setLessonFor] = useState('pointer') // whose controls it is showing
  const openIntel = (open) => {
    if (open === intelRef.current) return
    intelRef.current = open
    setIntel(open)
    if (open) {
      setLessonFor(padInputRef.current || (buttonsRef.current ? 'touch' : 'pointer'))
      // (nothing is left held down behind it)
      triggersRef.current.mouse = false
      triggersRef.current.touch = false
      setShooting(false)
      sceneRef.current?.setFire(false)
      sceneRef.current?.pointerLeave()
    }
    wrapRef.current?.focus({ preventScroll: true })
  }
  const openIntelRef = useRef(openIntel)
  openIntelRef.current = openIntel
  // The tutorial: a training flight through everything the jet does, a step at a time (see tutorial.ts).
  const tutorialRef = useRef(null)
  const [step, setStep] = useState(null) // the step it is on (null: not running)
  const flyerNow = () => padInputRef.current || (buttonsRef.current ? 'touch' : 'pointer')
  const runTutorial = (run) => {
    const t = tutorialRef.current
    if (!t || run === t.on) return
    if (run) {
      openIntelRef.current(false)
      t.setFlyer(flyerNow())
      t.start({ armed: paramsRef.current.weapons, crash: paramsRef.current.crash })
    } else t.stop()
    wrapRef.current?.focus({ preventScroll: true }) // (so that Space is the view again, not this button)
  }
  const runTutorialRef = useRef(runTutorial)
  runTutorialRef.current = runTutorial
  const skipStep = () => {
    tutorialRef.current?.skip()
    wrapRef.current?.focus({ preventScroll: true })
  }
  paramsRef.current = params
  pixelRef.current = pixelSize

  useEffect(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    if (!wrap || !canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const scene = createScene(paramsRef.current)
    sceneRef.current = scene
    const noise = createSound()
    noise.setOn(soundPropRef.current)
    noise.setVolume(volumeRef.current)
    noise.setRadio(radioRef.current)
    soundRef.current = noise
    const tutor = createTutorial(scene, { change: setStep, chime: (n) => noise.chime(n) })
    tutorialRef.current = tutor
    const onHide = () => noise.pause(document.hidden)
    document.addEventListener('visibilitychange', onHide)
    let image = null
    // the smooth flames have a canvas of their own over the picture, at the screen's full sharpness
    const fire = fireRef.current
    let layer = null
    let fireDead = false
    const onFireLost = (e) => {
      e.preventDefault()
      layer = null
      fireDead = true
      setNoFire(true)
    }
    fire?.addEventListener('webglcontextlost', onFireLost)

    const layout = () => {
      const cw = wrap.clientWidth
      const ch = wrap.clientHeight
      if (!cw || !ch) return
      const auto = Math.min(12, Math.max(2, Math.round(Math.sqrt((cw * ch) / 100000))))
      const px = pixelRef.current > 0 ? Math.round(pixelRef.current) : auto
      const lw = Math.ceil(cw / px)
      const lh = Math.ceil(ch / px)
      if (canvas.width !== lw || canvas.height !== lh) {
        canvas.width = lw
        canvas.height = lh
        scene.resize(lw, lh)
        image = null
      }
      canvas.style.width = lw * px + 'px'
      canvas.style.height = lh * px + 'px'
      canvas.style.left = Math.round((cw - lw * px) / 2) + 'px'
      canvas.style.top = Math.round((ch - lh * px) / 2) + 'px'
      if (fire) {
        const dpr = Math.min(2, window.devicePixelRatio || 1)
        const fw = Math.round(lw * px * dpr)
        const fh = Math.round(lh * px * dpr)
        if (fire.width !== fw || fire.height !== fh) {
          fire.width = fw
          fire.height = fh
        }
        fire.style.width = canvas.style.width
        fire.style.height = canvas.style.height
        fire.style.left = canvas.style.left
        fire.style.top = canvas.style.top
      }
      scaleRef.current = px
    }
    layoutRef.current = layout
    layout()
    const ro = new ResizeObserver(layout)
    ro.observe(wrap)

    let raf = 0
    let last = performance.now()
    const triggers = triggersRef.current // who is holding the cannon's trigger
    triggers.pad = false
    triggers.mouse = false
    triggers.touch = false
    // A game controller (a PS5 pad, say): the left stick or the D-pad flies, Cross rolls, R2 fires
    // the thrusters as hard as it is squeezed, Triangle changes the view. A controller sends no
    // events when it moves: it is read every frame.
    const pad = { turn: 0, climb: 0, thrust: 0, roll: false, gun: false, missile: false, view: false, back: false, fwd: false, menu: false, train: false, skip: false, off: false }
    const padTakes = (kind) => {
      if (padInputRef.current === kind) return
      padInputRef.current = kind
      setPadInput(kind)
    }
    const readPad = () => {
      if (pad.off || !navigator.getGamepads) return
      let gp = null
      try {
        const all = navigator.getGamepads()
        for (let i = 0; i < all.length; i++) {
          const g = all[i]
          if (g && g.connected && (!gp || (g.mapping === 'standard' && gp.mapping !== 'standard'))) gp = g
        }
      } catch {
        pad.off = true // controllers are not allowed here (a page embedded without leave to use them)
        return
      }
      let turn = 0
      let climb = 0
      let thrust = 0
      let roll = false
      let gun = false
      let missile = false
      let view = false
      let back = false
      let fwd = false
      let menu = false
      let train = false
      let skip = false
      if (gp) {
        const g = gp
        const dead = (v) => (Math.abs(v) < 0.16 ? 0 : (Math.sign(v) * (Math.abs(v) - 0.16)) / 0.84)
        const button = (i) => {
          const b = g.buttons[i]
          return b ? b.value || (b.pressed ? 1 : 0) : 0
        }
        // left stick, plus the D-pad; stick up counts as the Up key (the scene decides what Up does)
        turn = dead(g.axes[0] || 0) + (button(15) > 0.5 ? 1 : 0) - (button(14) > 0.5 ? 1 : 0)
        climb = -dead(g.axes[1] || 0) + (button(12) > 0.5 ? 1 : 0) - (button(13) > 0.5 ? 1 : 0)
        thrust = button(7) < 0.06 ? 0 : button(7) // R2
        roll = button(0) > 0.5 // Cross
        missile = button(1) > 0.5 // Circle: a missile
        gun = button(2) > 0.5 // Square: the cannon, for as long as it is held
        view = button(3) > 0.5 // Triangle
        back = button(4) > 0.5 // L1: a loop back over the top
        fwd = button(5) > 0.5 // R1: a loop forward and under
        menu = button(9) > 0.5 // Options: intel
        train = button(8) > 0.5 // Create: the tutorial, begun or ended
        skip = button(11) > 0.5 // the right stick, pressed in: on to its next step
        if (turn || climb || thrust || roll || gun || missile || view || back || fwd || menu || train || skip) padTakes(padKind(g.id))
        if (roll || gun || missile || view || back || fwd || menu || train || skip) wakeRef.current()
      }
      if (menu && !pad.menu) openIntelRef.current(!intelRef.current)
      if (train && !pad.train && !intelRef.current) runTutorialRef.current(!tutor.on)
      if (skip && !pad.skip && !intelRef.current) tutor.skip()
      pad.menu = menu
      pad.train = train
      pad.skip = skip
      if (intelRef.current) {
        // (the game is standing still: the buttons do nothing until it is shut again)
        pad.roll = roll
        pad.missile = missile
        pad.view = view
        pad.back = back
        pad.fwd = fwd
        return
      }
      if (roll && !pad.roll) scene.roll()
      if (missile && !pad.missile) scene.missile()
      if (back && !pad.back) scene.loop(1)
      if (fwd && !pad.fwd) scene.loop(-1)
      if (gun !== pad.gun) { triggers.pad = gun; scene.setFire(triggers.pad || triggers.mouse || triggers.touch) }
      if (view && !pad.view) scene.toggleView()
      const changed = turn !== pad.turn || climb !== pad.climb || thrust !== pad.thrust
      pad.turn = turn
      pad.climb = climb
      pad.thrust = thrust
      pad.roll = roll
      pad.gun = gun
      pad.missile = missile
      pad.back = back
      pad.fwd = fwd
      pad.view = view
      padBusyRef.current = turn !== 0 || climb !== 0 || thrust !== 0
      // (sent every frame while the stick is held, so a nudge of the mouse cannot take the jet away)
      if (changed || turn !== 0 || climb !== 0) sendKeys()
    }
    const onPadOn = (e) => padTakes(padKind(e.gamepad.id))
    const onPadOff = () => {
      padBusyRef.current = false
      padLetGoRef.current()
    }
    window.addEventListener('gamepadconnected', onPadOn)
    window.addEventListener('gamepaddisconnected', onPadOff)

    const frame = (now) => {
      raf = requestAnimationFrame(frame)
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000))
      last = now
      if (!scene.width) return
      readPad()
      if (!intelRef.current) {
        scene.step(dt)
        if (tutor.on) {
          tutor.setFlyer(padInputRef.current || (buttonsRef.current ? 'touch' : 'pointer'))
          tutor.tick(dt)
        }
      }
      // what has just happened, and how things stand, for the sound
      const happened = scene.takeSounds()
      for (let i = 0; i < happened.length; i++) noise.play(happened[i])
      noise.update(scene.audio)
      if (scene.kills !== killsRef.current) { killsRef.current = scene.kills; setKills(scene.kills) }
      if (scene.hull !== hullRef.current) { hullRef.current = scene.hull; setHull([scene.hull, scene.hullMax]) }
      {
        // (the bars of a reload move in twentieths: no more often than that is the readout redrawn)
        const a = scene.ammo
        const gl = Math.ceil(a.gunLoad * 20) / 20
        const ml = Math.ceil(a.missileLoad * 20) / 20
        const sig = `${a.rounds}|${a.roundsMax}|${gl}|${a.missiles}|${a.missilesMax}|${ml}`
        if (sig !== ammoRef.current) {
          ammoRef.current = sig
          setAmmo({ rounds: a.rounds, roundsMax: a.roundsMax, gunLoad: gl, missiles: a.missiles, missilesMax: a.missilesMax, missileLoad: ml })
        }
      }
      if (scene.evades !== evadesRef.current) {
        evadesRef.current = scene.evades
        setNote({ n: ++noteN.current, text: 'Evaded', sub: scene.counterOpen ? 'Missile now for a triple counter' : '' })
      }
      if (scene.counters !== countersRef.current) {
        countersRef.current = scene.counters
        setNote({ n: ++noteN.current, text: 'Counter ×3', sub: '' })
      }
      const bytes = scene.render()
      if (!image) image = new ImageData(bytes , scene.width, scene.height)
      ctx.putImageData(image, 0, 0)
      // smooth flames, if the scene asked for any this frame
      const flames = scene.flames
      if (fire && flames.count > 0 && !layer && !fireDead) {
        layer = createFlameLayer(fire)
        if (!layer) {
          fireDead = true
          setNoFire(true)
        }
      }
      if (fire && layer) layer.draw(flames.count, flames.data, fire.width / scene.width, now / 1000)
    }
    raf = requestAnimationFrame(frame)

    // Space moves the camera on: overhead → behind the jet → cockpit → overhead;
    // arrows or WASD fly it, Shift fires the thrusters
    const held = heldRef.current
    held.clear()
    const sendKeys = () => {
      let turn = 0
      let climb = 0
      let boost = false
      held.forEach((code) => {
        const k = FLY[code]
        if (k === 'left') turn -= 1
        else if (k === 'right') turn += 1
        else if (k === 'up') climb += 1
        else if (k === 'down') climb -= 1
        else if (k === 'boost') boost = true
      })
      scene.setKeys(turn + pad.turn, climb + pad.climb, boost, pad.thrust)
    }
    sendKeysRef.current = sendKeys
    const typing = (e) => {
      const el = e.target 
      return !!el && el !== wrap && (/^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(el.tagName) || el.isContentEditable)
    }
    const onKey = (e) => {
      // I opens intel; I or Escape shuts it (wherever the focus is); while it is open the keys that
      // fly the jet do nothing
      if (intelRef.current) {
        if (e.code === 'Escape' || e.code === 'KeyI') openIntelRef.current(false)
        else if (e.code.startsWith('Arrow')) e.preventDefault()
        return
      }
      if (typing(e)) return
      wakeRef.current()
      padLetGoRef.current()
      const plain = !e.repeat && !e.metaKey && !e.ctrlKey && !e.altKey
      if (e.code === 'KeyI' && plain) {
        openIntelRef.current(true)
        return
      }
      // T begins the tutorial, or ends it (so does Escape); Enter skips the step it is on
      if ((e.code === 'KeyT' && plain) || (e.code === 'Escape' && tutor.on)) {
        runTutorialRef.current(!tutor.on)
        return
      }
      if (e.code === 'Enter' && plain && tutor.on) {
        tutor.skip()
        return
      }
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault()
        if (e.repeat) return
        scene.toggleView()
        return
      }
      // F: a loop back over the top; G: forward and under (which wants height under the jet)
      if ((e.code === 'KeyF' || e.code === 'KeyG') && !e.repeat && !e.metaKey && !e.ctrlKey && !e.altKey) {
        scene.loop(e.code === 'KeyG' ? -1 : 1)
        return
      }
      if (e.code === 'KeyM' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        scene.missile() // (held, they go one after another)
        return
      }
      if (FLY[e.code] && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (e.code.startsWith('Arrow')) e.preventDefault()
        held.add(e.code)
        sendKeys()
      }
    }
    const onKeyUp = (e) => {
      if (held.delete(e.code)) sendKeys()
    }
    const onBlur = () => {
      triggers.mouse = false
      triggers.touch = false
      scene.setFire(triggers.pad)
      held.clear()
      sendKeys()
      setBoosting(false)
      setShooting(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('gamepadconnected', onPadOn)
      window.removeEventListener('gamepaddisconnected', onPadOff)
      fire?.removeEventListener('webglcontextlost', onFireLost)
      layer?.dispose()
      document.removeEventListener('visibilitychange', onHide)
      noise.dispose()
      soundRef.current = null
      tutorialRef.current = null
      sceneRef.current = null
    }
  }, [])

  useEffect(() => {
    sceneRef.current?.setParams(paramsRef.current)
  }, [signature])

  useEffect(() => {
    layoutRef.current()
  }, [pixelSize])

  useEffect(() => {
    soundRef.current?.setOn(sound)
    soundRef.current?.setVolume(volume)
    soundRef.current?.setRadio(radio)
  }, [sound, volume, radio])

  const toScene = (e) => {
    const r = canvasRef.current.getBoundingClientRect()
    return [(e.clientX - r.left) / scaleRef.current, (e.clientY - r.top) / scaleRef.current] 
  }

  // Fingers fly differently from a mouse: a finger steers for as long as it is down, a quick
  // tap rolls, and the thrusters have a button of their own (so steering does not fire them).
  const byFinger = (e) => touchControls !== 'off' && e.pointerType === 'touch'
  const endFinger = (e, tap) => {
    const s = steerRef.current
    if (!s || s.id !== e.pointerId) return
    steerRef.current = null
    const scene = sceneRef.current
    if (!scene) return
    if (tap && !s.moved && performance.now() - s.t < 260) {
      scene.press()
      scene.release() // a press and release at once is a click: it rolls
    }
    scene.pointerLeave()
  }
  // the mouse's right button holds the cannon's trigger
  const fire = (on) => {
    const t = triggersRef.current
    t.mouse = on
    sceneRef.current?.setFire(on || t.pad || t.touch)
  }
  // … and on a touch screen, the Gun button does (held, like Boost); Missile sends one a tap
  const gunOn = (e) => {
    wake()
    e.stopPropagation()
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* the touch has already ended */ }
    triggersRef.current.touch = true
    sceneRef.current?.setFire(true)
    setShooting(true)
  }
  const gunOff = (e) => {
    e.stopPropagation()
    const t = triggersRef.current
    t.touch = false
    sceneRef.current?.setFire(t.pad || t.mouse)
    setShooting(false)
  }
  const missileTap = (e) => {
    wake()
    e.stopPropagation()
    sceneRef.current?.missile()
  }
  // the on-screen buttons keep their touches to themselves
  const mine = (e) => e.stopPropagation()
  const nextView = () => {
    wake()
    const scene = sceneRef.current
    if (!scene) return
    scene.toggleView()
    wrapRef.current?.focus({ preventScroll: true }) // so the keys still fly it after a click
  }
  const boostOn = (e) => {
    wake()
    e.stopPropagation()
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* the touch has already ended */ }
    heldRef.current.add('TouchBoost')
    sendKeysRef.current()
    setBoosting(true)
  }
  const boostOff = (e) => {
    e.stopPropagation()
    heldRef.current.delete('TouchBoost')
    sendKeysRef.current()
    setBoosting(false)
    wrapRef.current?.focus({ preventScroll: true })
  }
  // the two buttons in the top right corner (they match the tally of kills, top left)
  const cornerLook =
    'cursor-pointer rounded-[3px] bg-[#0b1a33]/55 px-2.5 py-1.5 font-mono text-[11px] uppercase leading-none tracking-[0.14em] text-white/90 outline-none transition-colors duration-100 hover:bg-[#0b1a33]/80 focus-visible:ring-1 focus-visible:ring-white'
  const buttonLook =
    'absolute flex h-14 w-[4.5rem] cursor-pointer select-none flex-col items-center justify-center gap-1.5 rounded-[4px] border font-mono text-[11px] uppercase leading-none tracking-[0.14em] text-white/90 outline-none transition-colors duration-100 focus-visible:border-white'

  return (
    _jsxs('div', {
      ref: wrapRef,
      tabIndex: 0,
      className: "relative h-screen min-h-[320px] w-full touch-none select-none overflow-hidden bg-[#2468b4] outline-none"        ,
      // (on a phone the screen's height changes as the browser's bars come and go: follow it)
      style: { cursor: 'crosshair', height: '100dvh', WebkitTouchCallout: 'none', WebkitTapHighlightColor: 'transparent' },
      // (the right button is the cannon's trigger, not a menu)
      onContextMenu: (e) => e.preventDefault(),
      onPointerEnter: () => wrapRef.current?.focus({ preventScroll: true }),
      onPointerMove: (e) => {
        if (intel) return
        if (byFinger(e)) {
          const s = steerRef.current
          if (!s || s.id !== e.pointerId) return
          if (Math.hypot(e.clientX - s.x, e.clientY - s.y) > 12) s.moved = true
        }
        padLetGo()
        const [x, y] = toScene(e)
        sceneRef.current?.pointerMove(x, y)
      },
      onPointerDown: (e) => {
        wake()
        if (intel) {
          openIntel(false)
          return
        }
        padLetGo()
        const [x, y] = toScene(e)
        if (byFinger(e)) {
          if (!fingerScreen) setFingerScreen(true)
          if (steerRef.current) return // one finger steers; a second one is for the buttons
          steerRef.current = { id: e.pointerId, t: performance.now(), x: e.clientX, y: e.clientY, moved: false }
          sceneRef.current?.pointerMove(x, y)
        } else {
          sceneRef.current?.pointerMove(x, y)
          if (e.button === 0) sceneRef.current?.press()
          else if (e.button === 2) fire(true)
        }
        wrapRef.current?.focus({ preventScroll: true })
      },
      onPointerUp: (e) => {
        if (byFinger(e)) endFinger(e, true)
        else if (e.button === 0) sceneRef.current?.release()
        else if (e.button === 2) fire(false)
      },
      onPointerLeave: (e) => {
        if (byFinger(e)) endFinger(e, false)
        else { fire(false); sceneRef.current?.pointerLeave() }
      },
      onPointerCancel: (e) => {
        if (byFinger(e)) endFinger(e, false)
        else { fire(false); sceneRef.current?.pointerLeave() }
      },
 children: [
      _jsx('canvas', {
        ref: canvasRef,
        'aria-label': "A pixel-art fighter jet, built from stacked slices, flying over islands. Space moves between the overhead view, the view from behind the jet and the cockpit; arrow keys fly it, Shift fires the thrusters, F and G fly a loop back or forward, the right mouse button fires the cannon and M a missile. A game controller works too. Diving into the ground crashes the jet: the pilot ejects and a new jet picks him up."                                                                           ,
        role: "img",
        className: "absolute block" ,
        style: { imageRendering: 'pixelated' },}
      )
      /* smooth flames are drawn here, over the picture */
      , _jsx('canvas', { ref: fireRef, 'aria-hidden': "true", className: "pointer-events-none absolute block"  ,} )
      /* top right: the tutorial (a training flight) and intel (the list of controls) */
      , showHint && (
        _jsxs(_Fragment, { children: [
          _jsxs('div', {
            className: "absolute flex gap-1.5"  ,
            style: { right: 'max(16px, env(safe-area-inset-right))', top: 'max(16px, env(safe-area-inset-top))' },
            onPointerDown: mine,
            onPointerMove: mine,
            onPointerUp: mine,
 children: [
            _jsx('button', {
              type: "button",
              'aria-expanded': intel,
              'aria-controls': "fj-intel",
              className: cornerLook,
              style: { textShadow: '0 1px 0 rgba(0,0,0,.45)', touchAction: 'manipulation' },
              onClick: () => { wake(); openIntel(!intel) },
 children: 
              intel ? 'Close' : 'Intel'
            })
            , _jsx('button', {
              type: "button",
              'aria-pressed': !!step,
              className: cornerLook,
              style: { textShadow: '0 1px 0 rgba(0,0,0,.45)', touchAction: 'manipulation' },
              onClick: () => { wake(); runTutorial(!step) },
 children: 
              step ? 'End tutorial' : 'Tutorial'
            })
          ]})
          , intel && (
            _jsxs('div', {
              id: "fj-intel",
              role: "dialog",
              'aria-label': "Intel: the controls"  ,
              className: "absolute z-10 w-[min(23rem,calc(100%-2rem))] cursor-default overflow-y-auto rounded-[4px] bg-[#0b1a33]/90 p-3 font-mono text-[11px] leading-snug text-white/90"           ,
              style: { right: 'max(16px, env(safe-area-inset-right))', top: 'calc(max(16px, env(safe-area-inset-top)) + 2.25rem)', maxHeight: 'calc(100% - 4.5rem)' },
              onPointerDown: mine,
              onPointerMove: mine,
              onPointerUp: mine,
              onContextMenu: mine,
 children: [
              _jsxs('div', { className: "flex items-center justify-between gap-3"   , children: [
                _jsx('div', { className: "flex gap-1" , role: "tablist", 'aria-label': "Controls for" , children: 
                  ([['pointer', 'Mouse + keys'], [lessonFor === 'pad' ? 'pad' : 'ps', 'Controller'], ['touch', 'Touch']] ).map(([k, label]) => {
                    const on = k === lessonFor || (k === 'ps' && lessonFor === 'pad')
                    return (
                      _jsx('button', {

                        type: "button",
                        role: "tab",
                        'aria-selected': on,
                        className: `cursor-pointer rounded-[3px] px-2 py-1 uppercase leading-none tracking-[0.12em] outline-none focus-visible:ring-1 focus-visible:ring-white ${on ? 'bg-white text-[#0b1a33]' : 'bg-white/10 text-white/80 hover:bg-white/20'}`,
                        onClick: () => setLessonFor(k),
 children: 
                        label
                      }, label)
                    )
                  })
                })
                , _jsx('span', { className: "uppercase tracking-[0.14em] text-white/50"  , children: "Paused"})
              ]})
              , lessonsFor(lessonFor, { stick: params.invertY, crash: params.crash, armed: params.weapons, hunted: params.weapons && params.foeFire && params.enemies > 0, ammo: params.ammo, missiles: params.missiles, reload: params.reload }).map((l) => (
                _jsxs('div', { className: "mt-3", children: [
                  _jsx('p', { className: "uppercase tracking-[0.18em] text-white/50"  , children: l.title})
                  , _jsx('dl', { className: "mt-1.5 grid grid-cols-[7.5rem_1fr] gap-x-3 gap-y-1.5"    , children: 
                    l.rows.map(([what, how]) => (
                      _jsxs('div', { className: "contents", children: [
                        _jsx('dt', { className: "uppercase tracking-[0.1em] text-white/70"  , children: what})
                        , _jsx('dd', { className: "text-white", children: how})
                      ]}, what)
                    ))
                  })
                ]}, l.title)
              ))
              , _jsx('p', { className: "mt-3 text-white/50" , children: 
                lessonFor === 'ps' || lessonFor === 'pad'
                  ? `Options opens and shuts this. ${lessonFor === 'ps' ? 'Create' : 'View'} begins the tutorial.`
                  : lessonFor === 'touch'
                    ? 'Tap outside to shut this. Tutorial flies you through it all.'
                    : 'I opens and shuts this. T begins the tutorial.'
              })
            ]})
          )
        ]})
      )
      /* the tutorial's step: what to do now, and how far through it things are */
      , step && (() => {
        const flyer = padInput || (buttons ? 'touch' : 'pointer')
        const ended = step.phase === 'end'
        const ticked = step.phase === 'done'
        const words = ended
          ? { title: 'Tutorial complete', how: 'That is all of it. Intel has the list if anything slips. Good hunting.' }
          : lessonWords(step.id, flyer, params.invertY, step.view)
        return (
          _jsxs('div', {
            role: "status",
            'aria-live': "polite",
            className: "pointer-events-none absolute left-1/2 top-[calc(max(16px,env(safe-area-inset-top))_+_2.5rem)] w-[min(25rem,calc(100%-2rem))] -translate-x-1/2 rounded-[4px] bg-[#0b1a33]/80 px-3 pb-3 pt-2.5 font-mono text-[11px] leading-snug text-white/90 min-[940px]:top-[max(16px,env(safe-area-inset-top))]"               ,
 children: [
            _jsxs('div', { className: "flex items-center justify-between gap-3 uppercase leading-none tracking-[0.16em] text-white/55"       , children: [
              _jsx('span', { children: 
                ended ? 'Tutorial' : `Tutorial · ${step.group}`
              })
              , _jsxs('span', { className: "flex items-center gap-2.5"  , children: [
                !ended && _jsxs('span', { children: [String(step.index + 1).padStart(2, '0'), " / "  , String(step.count).padStart(2, '0')]})
                , !ended && (
                  _jsxs('button', {
                    type: "button",
                    className: "pointer-events-auto cursor-pointer rounded-[3px] bg-white/10 px-1.5 py-1 uppercase leading-none tracking-[0.14em] text-white/85 outline-none hover:bg-white/20 focus-visible:ring-1 focus-visible:ring-white"             ,
                    style: { touchAction: 'manipulation' },
                    'aria-label': "Skip this step"  ,
                    onClick: skipStep,
                    onPointerDown: mine,
                    onPointerMove: mine,
                    onPointerUp: mine,
 children: ["Skip"
                    , flyer === 'pointer' ? ' ↵' : flyer === 'touch' ? '' : ' R3'
                  ]})
                )
              ]})
            ]})
            , _jsxs('p', { className: "mt-2.5 text-[14px] uppercase leading-none tracking-[0.2em]"    , style: { color: ticked || ended ? '#8dffb0' : '#ffffff' }, children: [
              ticked ? '✓ ' : '', words.title
            ]})
            /* (room for two lines, and for the hint, so the card keeps its size from step to step) */
            , _jsx('p', { className: "mt-2 min-h-[2.75em] text-white/90"  , children: words.how})
            , _jsx('p', { className: "mt-1 min-h-[1.4em]" , style: { color: '#ffd27a' }, children: step.hint})
            , _jsx('div', { className: "mt-1.5 flex gap-[3px]"  , 'aria-hidden': "true", children: 
              Array.from({ length: step.count }, (_, i) => (
                _jsx('span', { className: "relative block h-[4px] flex-1 overflow-hidden bg-white/20"     , children: 
                  _jsx('span', {
                    className: "absolute inset-y-0 left-0 block"   ,
                    style: {
                      width: `${(i < step.index || ended ? 1 : i === step.index ? step.progress : 0) * 100}%`,
                      backgroundColor: i < step.index || ended || ticked ? '#8dffb0' : '#ffffff',
                      transition: 'width 120ms linear',
                    },}
                  )
                }, i)
              ))
            })
          ]})
        )
      })()
      /* a missile thrown off, a counter-attack made: the word, for a moment */
      , note && (
        _jsxs('div', {

          className: "pointer-events-none absolute inset-x-0 text-center font-mono uppercase leading-none text-white"       ,
          style: { top: step ? 'max(30%, 11.5rem)' : '20%', textShadow: '0 1px 0 rgba(0,0,0,.6), 0 0 12px rgba(255,255,255,.5)', animation: 'fj-note 1.7s ease-out forwards' },
          'aria-live': "polite",
 children: [
          _jsx('p', { className: "text-[14px] tracking-[0.32em]" , children: note.text})
          , note.sub && _jsx('p', { className: "mt-2 text-[10px] tracking-[0.2em] text-white/80"   , children: note.sub})
          , _jsx('style', { children: '@keyframes fj-note{0%{opacity:0;transform:scale(1.5)}8%{opacity:1;transform:scale(1)}80%{opacity:1}100%{opacity:0}}@media (prefers-reduced-motion: reduce){@keyframes fj-note{0%,80%{opacity:1}100%{opacity:0}}}'})
        ]}, note.n)
      )
      /* the tally of enemies shot down, and how much more the jet will take once it has been hit */
      , (kills > 0 || hull[0] < hull[1]) && params.weapons && (
        _jsxs('p', {
          className: "pointer-events-none absolute flex items-center gap-2.5 rounded-[3px] bg-[#0b1a33]/55 px-2.5 py-1.5 font-mono text-[11px] uppercase leading-none tracking-[0.14em] text-white/90"              ,
          style: { left: 'max(16px, env(safe-area-inset-left))', top: 'max(16px, env(safe-area-inset-top))', textShadow: '0 1px 0 rgba(0,0,0,.45)' },
          'aria-live': "polite",
 children: [
          _jsxs('span', { children: ["Kills " , String(kills).padStart(2, '0')]})
          , hull[0] < hull[1] && (
            _jsxs('span', { className: "flex items-center gap-[3px]"  , 'aria-label': `Hull ${hull[0]} of ${hull[1]}`, children: [
              _jsx('span', { 'aria-hidden': "true", children: "Hull"})
              , Array.from({ length: hull[1] }, (_, i) => (
                _jsx('span', {

                  'aria-hidden': "true",
                  className: "block h-[9px] w-[4px]"  ,
                  style: { backgroundColor: i < hull[0] ? (hull[0] <= 2 ? '#ff4a3d' : '#ffffff') : 'rgba(255,255,255,.22)' },}, i
                )
              ))
            ]})
          )
        ]})
      )
      /* what is left to fire, bottom left: rounds in the cannon, missiles on the rails, or a bar filling while either reloads */
      , params.weapons && !buttons && (
        _jsxs('p', {
          className: "pointer-events-none absolute flex items-center gap-3.5 rounded-[3px] bg-[#0b1a33]/55 px-2.5 py-1.5 font-mono text-[11px] uppercase leading-none tracking-[0.14em] text-white/90"              ,
          style: { left: 'max(16px, env(safe-area-inset-left))', bottom: 'max(16px, env(safe-area-inset-bottom))', textShadow: '0 1px 0 rgba(0,0,0,.45)' },
 children: [
          _jsxs('span', { className: "flex items-center gap-2"  , 'aria-label': ammo.gunLoad > 0 ? 'Cannon reloading' : `Cannon: ${ammo.roundsMax > 0 ? ammo.rounds : 'unlimited'} rounds`, children: [
            _jsx('span', { 'aria-hidden': "true", children: "Ammo"})
            , ammo.gunLoad > 0 ? (
              _jsx('span', { 'aria-hidden': "true", className: "block h-[9px] w-[2.6rem] bg-white/20"   , children: 
                _jsx('span', { className: "block h-full bg-[#ffd27a]"  , style: { width: `${ammo.gunLoad * 100}%` },} )
              })
            ) : (
              _jsx('span', { 'aria-hidden': "true", className: "inline-block w-[2.6rem]" , style: { color: ammo.roundsMax > 0 && ammo.rounds <= ammo.roundsMax * 0.15 ? '#ff6a5e' : undefined }, children: 
                ammo.roundsMax > 0 ? String(ammo.rounds).padStart(3, '0') : '∞'
              })
            )
          ]})
          , _jsxs('span', { className: "flex items-center gap-2"  , 'aria-label': ammo.missileLoad > 0 ? 'Missiles reloading' : `Missiles: ${ammo.missilesMax > 0 ? ammo.missiles : 'unlimited'}`, children: [
            _jsx('span', { 'aria-hidden': "true", children: "Msl"})
            , ammo.missilesMax <= 0 ? (
              _jsx('span', { 'aria-hidden': "true", children: "∞"})
            ) : ammo.missilesMax > 12 ? (
              _jsx('span', { 'aria-hidden': "true", className: "relative inline-block w-[2rem]"  , children: 
                ammo.missileLoad > 0 ? _jsx('span', { className: "block h-[9px] bg-white/20"  , children: _jsx('span', { className: "block h-full bg-[#ffd27a]"  , style: { width: `${ammo.missileLoad * 100}%` },} )}) : String(ammo.missiles).padStart(2, '0')
              })
            ) : (
              // (a pip a missile; reloading, they fill up again one after another)
              _jsx('span', { 'aria-hidden': "true", className: "flex items-center gap-[3px]"  , children: 
                Array.from({ length: ammo.missilesMax }, (_, i) => {
                  const loading = ammo.missileLoad > 0
                  const full = loading ? i < Math.floor(ammo.missileLoad * ammo.missilesMax) : i < ammo.missiles
                  return _jsx('span', { className: "block h-[9px] w-[4px]"  , style: { backgroundColor: full ? (loading ? '#ffd27a' : '#ffffff') : 'rgba(255,255,255,.22)' },}, i )
                })
              })
            )
          ]})
        ]})
      )
      /* phones and tablets have no Space bar or Shift key: a button for the view, one for the thrusters */
      , buttons && (
        _jsxs(_Fragment, { children: [
          _jsx('button', {
            type: "button",
            'aria-label': "Change view" ,
            className: `${buttonLook} border-white/30 bg-[#0b1a33]/60 active:bg-[#0b1a33]/90`,
            style: { left: 'max(14px, env(safe-area-inset-left))', bottom: 'max(14px, env(safe-area-inset-bottom))', touchAction: 'none' },
            onClick: nextView,
            onPointerDown: mine,
            onPointerMove: mine,
            onPointerUp: mine,
 children: "View"

          })
          , _jsx('button', {
            type: "button",
            'aria-label': "Loop",
            className: `${buttonLook} border-white/30 bg-[#0b1a33]/60 active:bg-[#0b1a33]/90`,
            style: { left: 'max(14px, env(safe-area-inset-left))', bottom: 'calc(max(14px, env(safe-area-inset-bottom)) + 4.25rem)', touchAction: 'none' },
            onClick: () => { wake(); sceneRef.current?.loop(); wrapRef.current?.focus({ preventScroll: true }) },
            onPointerDown: mine,
            onPointerMove: mine,
            onPointerUp: mine,
 children: "Loop"

          })
          , _jsx('button', {
            type: "button",
            'aria-label': "Thrusters: hold to fire"   ,
            'aria-pressed': boosting,
            className: `${buttonLook} ${boosting ? 'border-white/70' : 'border-white/30 bg-[#0b1a33]/60'}`,
            style: {
              right: 'max(14px, env(safe-area-inset-right))',
              bottom: 'max(14px, env(safe-area-inset-bottom))',
              touchAction: 'none',
              backgroundColor: boosting ? params.accentColor : undefined,
            },
            onPointerDown: boostOn,
            onPointerMove: mine,
            onPointerUp: boostOff,
            onPointerCancel: boostOff,
            onLostPointerCapture: boostOff,
            onContextMenu: (e) => e.preventDefault(),
 children: "Boost"

          })
          /* the weapons: Gun beside Boost (held to fire), Missile above it (one a tap). Each shows what it has left. */
          , params.weapons && (
            _jsxs(_Fragment, { children: [
              _jsxs('button', {
                type: "button",
                'aria-label': ammo.gunLoad > 0 ? 'Cannon: reloading' : `Cannon: hold to fire${ammo.roundsMax > 0 ? `, ${ammo.rounds} rounds left` : ''}`,
                'aria-pressed': shooting,
                className: `${buttonLook} ${shooting ? 'border-white/70' : 'border-white/30 bg-[#0b1a33]/60'}`,
                style: {
                  right: 'calc(max(14px, env(safe-area-inset-right)) + 5.25rem)',
                  bottom: 'max(14px, env(safe-area-inset-bottom))',
                  touchAction: 'none',
                  backgroundColor: shooting ? params.accentColor : undefined,
                },
                onPointerDown: gunOn,
                onPointerMove: mine,
                onPointerUp: gunOff,
                onPointerCancel: gunOff,
                onLostPointerCapture: gunOff,
                onContextMenu: (e) => e.preventDefault(),
 children: [
                _jsx('span', { children: "Gun"})
                , ammo.gunLoad > 0 ? (
                  _jsx('span', { 'aria-hidden': "true", className: "block h-[7px] w-9 bg-white/20"   , children: 
                    _jsx('span', { className: "block h-full bg-[#ffd27a]"  , style: { width: `${ammo.gunLoad * 100}%` },} )
                  })
                ) : (
                  _jsx('span', { 'aria-hidden': "true", className: "text-[10px] tracking-[0.1em]" , style: { color: ammo.roundsMax > 0 && ammo.rounds <= ammo.roundsMax * 0.15 ? '#ff6a5e' : 'rgba(255,255,255,.75)' }, children: 
                    ammo.roundsMax > 0 ? String(ammo.rounds).padStart(3, '0') : '∞'
                  })
                )
              ]})
              , _jsxs('button', {
                type: "button",
                'aria-label': ammo.missileLoad > 0 ? 'Missiles: reloading' : `Fire a missile${ammo.missilesMax > 0 ? `, ${ammo.missiles} left` : ''}`,
                className: `${buttonLook} border-white/30 bg-[#0b1a33]/60 active:bg-[#0b1a33]/90`,
                style: { right: 'max(14px, env(safe-area-inset-right))', bottom: 'calc(max(14px, env(safe-area-inset-bottom)) + 4.25rem)', touchAction: 'none' },
                onPointerDown: missileTap,
                onPointerMove: mine,
                onPointerUp: mine,
                onContextMenu: (e) => e.preventDefault(),
 children: [
                _jsx('span', { children: "Missile"})
                , ammo.missileLoad > 0 ? (
                  _jsx('span', { 'aria-hidden': "true", className: "block h-[7px] w-9 bg-white/20"   , children: 
                    _jsx('span', { className: "block h-full bg-[#ffd27a]"  , style: { width: `${ammo.missileLoad * 100}%` },} )
                  })
                ) : ammo.missilesMax <= 0 ? (
                  _jsx('span', { 'aria-hidden': "true", className: "text-[10px] text-white/75" , children: "∞"})
                ) : ammo.missilesMax > 8 ? (
                  _jsx('span', { 'aria-hidden': "true", className: "text-[10px] tracking-[0.1em] text-white/75"  , children: String(ammo.missiles).padStart(2, '0')})
                ) : (
                  _jsx('span', { 'aria-hidden': "true", className: "flex gap-[2px]" , children: 
                    Array.from({ length: ammo.missilesMax }, (_, i) => (
                      _jsx('span', { className: "block h-[7px] w-[3px]"  , style: { backgroundColor: i < ammo.missiles ? '#ffffff' : 'rgba(255,255,255,.22)' },}, i )
                    ))
                  })
                )
              ]})
            ]})
          )
        ]})
      )
    ]})
  )
}
