"""Copies the Forge fragment's modules into <out>/src as plain .js and adds the campaign hooks."""
import re, sys, pathlib

src = pathlib.Path(sys.argv[1])
out = pathlib.Path(sys.argv[2])

FILES = [
    'src/components/fighter-jet-eject.tsx', 'src/lib/eject/scene.ts', 'src/lib/eject/tutorial.ts',
    'src/lib/flame-layer.ts', 'src/lib/sound.ts', 'src/lib/jet-model.ts', 'src/lib/pilot-model.ts',
    'src/lib/voxel-sprite.ts', 'src/lib/post.ts', 'src/lib/cockpit.ts',
]


def sub1(text, old, new, count=1):
    n = text.count(old)
    if n < 1 or (count and n != count):
        raise SystemExit(f'patch failed ({n} matches, wanted {count}): {old[:70]!r}')
    return text.replace(old, new)


for f in FILES:
    t = (src / f).read_text()
    # sounds: a URL beside the module instead of the host's ?module import
    t = re.sub(r"import (\w+) from '([^']+\.mp3)\?v=[0-9a-f]+&module'",
               r"const \1 = new URL('\2', import.meta.url).href", t)
    # other modules: plain .js, no version tag
    t = re.sub(r"from '([^']+)\.tsx?\?v=[0-9a-f]+'", r"from '\1.js'", t)
    if '?v=' in t:
        raise SystemExit('unrewritten import in ' + f)

    if f.endswith('scene.ts'):
        t = sub1(t, 'const FOE_HP = 5 ', 'let FOE_HP = 5 ')
        t = sub1(t, 'const HULL = 6 ', 'let HULL = 6 ')
        t = sub1(t, "  canopyColor: '#1e8ca0',\n}",
                 "  canopyColor: '#1e8ca0',\n  hullMax: 6,\n  foeHp: 5,\n  aceHp: 0,\n  aceMissile: 8,\n}")
        t = sub1(t, 'export function createScene(initial) {\n  let p = { ...initial }\n',
                 'export function createScene(initial) {\n  let p = { ...initial }\n'
                 '  HULL = p.hullMax > 0 ? p.hullMax : 6\n  FOE_HP = p.foeHp > 0 ? p.foeHp : 5\n'
                 '  // campaign: the first enemy may be an ace that takes far more; a beacon may be set to fly to\n'
                 '  const hpFor = (i) => (i === 0 && p.aceHp > 0 ? p.aceHp : FOE_HP)\n'
                 '  let beacon = null\n')
        t = sub1(t, '    p = { ...next }\n',
                 '    p = { ...next }\n    HULL = p.hullMax > 0 ? p.hullMax : 6\n    FOE_HP = p.foeHp > 0 ? p.foeHp : 5\n')
        t = sub1(t, '    f.state = 0\n    f.hp = FOE_HP\n', '    f.state = 0\n    f.hp = hpFor(i)\n')
        t = sub1(t, 'foes.push({ j, state: 0, hp: FOE_HP,', 'foes.push({ j, state: 0, hp: hpFor(foes.length),')
        t = sub1(t, '            } else hitFoe(m.target, 99)',
                 '            } else hitFoe(m.target, m.target === 0 && p.aceHp > 0 ? (m.sure ? p.aceMissile * 4 : p.aceMissile) : 99)')
        # the ace's armour: a cannon round counts for less against it
        t = sub1(t, '          hitFoe(n, 1)\n', '          hitFoe(n, n === 0 && p.aceHp > 0 ? 0.4 : 1)\n')
        t = sub1(t, '    hullMax: HULL,', '    get hullMax() { return HULL },')
        # the beacon is drawn with the sights
        t = sub1(t, '  function drawSights(framed) {\n    if (!p.weapons || foes.length === 0) return\n',
                 '''  function drawBeacon(framed) {
    const b = beacon
    if (!b) return
    const far = -1e9
    const seen = project(b.x, b.y, b.z)
    const x = Math.round(prX)
    const y = Math.round(prY)
    const col = ((time * 5) | 0) % 2 === 0 ? BEACON_A : BEACON_B
    const on = seen && x > 8 && y > 8 && x < W - 8 && y < H - 8
    if (!on) {
      if (!framed) return
      const dx = b.x - cam.x
      const dy = b.y - cam.y
      let vx = seen ? prX - (W >> 1) : dx * vCos - dy * vSin
      let vy = seen ? prY - (H >> 1) : dx * vSin + dy * vCos
      const k = Math.min((W / 2 - 9) / Math.max(1, Math.abs(vx)), (H / 2 - 9) / Math.max(1, Math.abs(vy)))
      vx = Math.round((W >> 1) + vx * k)
      vy = Math.round((H >> 1) + vy * k)
      box(vx - 4, vy - 4, vx + 5, vy + 5, outlineCol, far)
      box(vx - 3, vy - 3, vx + 4, vy + 4, col, far)
      box(vx - 1, vy - 1, vx + 2, vy + 2, outlineCol, far)
      return
    }
    // a ring the size of the gate, and a diamond in the middle of it
    const r = Math.max(6, Math.round((b.r || 40) * prM))
    const n = Math.max(12, Math.min(48, Math.round(r * 0.9)))
    for (let i = 0; i < n; i++) {
      if ((i & 1) === (((time * 6) | 0) & 1)) continue
      const a0 = (i / n) * Math.PI * 2
      const a1 = ((i + 1) / n) * Math.PI * 2
      thread(x + Math.cos(a0) * r, y + Math.sin(a0) * r * 0.9, x + Math.cos(a1) * r, y + Math.sin(a1) * r * 0.9, col, far, 256)
    }
    const d = 3
    thread(x - d, y, x, y - d, col, far, 256)
    thread(x, y - d, x + d, y, col, far, 256)
    thread(x + d, y, x, y + d, col, far, 256)
    thread(x, y + d, x - d, y, col, far, 256)
  }

  function drawSights(framed) {
    drawBeacon(framed)
    if (!p.weapons || foes.length === 0) return
''')
        t = sub1(t, 'const HUD_LOCK = pack(255, 40, 48)\n',
                 'const HUD_LOCK = pack(255, 40, 48)\nconst BEACON_A = pack(110, 255, 190)\nconst BEACON_B = pack(255, 255, 255)\n')
        t = sub1(t, '    setKeys,\n    step,\n    render,\n',
                 '''    /** campaign: a place to fly to ({x, y, z, r} in the world, or null for none) */
    setBeacon(b) { beacon = b },
    /** campaign: the height of the ground (or sea, 0) at a place */
    groundAt(x, y) { return groundAt(x, y) },
    /** campaign: every enemy is sent out afresh (after the number or kind of them has changed) */
    respawnFoes() { syncFoes(); for (let i = 0; i < foes.length; i++) placeFoe(i, true) },
    /** campaign: true while the opening is still playing */
    get ready() { return introT > 2.2 },
    setKeys,
    step,
    render,
''')

    if f.endswith('fighter-jet-eject.tsx'):
        t = sub1(t, 'volume = 0.6, radio = true, ...rest })', 'volume = 0.6, radio = true, onScene, paused = false, ...rest })')
        t = sub1(t, '  const radioRef = useRef(radio)\n',
                 '  const radioRef = useRef(radio)\n  const pausedRef = useRef(paused)\n  pausedRef.current = paused\n'
                 '  const onSceneRef = useRef(onScene)\n  onSceneRef.current = onScene\n')
        t = sub1(t, '    sceneRef.current = scene\n', '    sceneRef.current = scene\n    onSceneRef.current?.(scene)\n')
        t = sub1(t, '      if (!intelRef.current) {\n        scene.step(dt)',
                 '      if (!intelRef.current && !pausedRef.current) {\n        scene.step(dt)\n        onSceneRef.current?.(scene, dt)')
        t = sub1(t, '      sceneRef.current = null\n    }\n  }, [])',
                 '      sceneRef.current = null\n      onSceneRef.current?.(null)\n    }\n  }, [])')

    dest = out / re.sub(r'\.tsx?$', '.js', f)
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(t)
    print('wrote', dest)
