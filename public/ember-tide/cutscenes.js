// EMBER TIDE — the cutscenes: short films played on the scene itself, between sorties.
//
// A cutscene is a list of shots. A shot may carry:
//   scene  settings for the scene; the picture fades through black and starts afresh
//   move   settings changed without a cut (the camera swings over)
//   card   { kicker, title } shown large in the middle before anything is said
//   lines  [who, text] pairs, spoken in order; who '' is the narrator

const M = 'Marrow'
const P = 'Pip'
const L = 'Lantern'
const C = 'Cinder'
const N = ''

// the Ember Fleet's paint, and Cinder's own
const EMBER = { bodyColor: '#1c1a22', accentColor: '#ff6a2b', canopyColor: '#ffb347' }
const ACE = { bodyColor: '#17141a', accentColor: '#ff2f3d', canopyColor: '#ffd27a' }

export const CUTSCENES = {
  intro: {
    title: 'Six days on the roster',
    shots: [
      {
        scene: { timeOfDay: 'day', seed: 7, clouds: 0.35, view: 'top', wingmen: 0 },
        card: { kicker: 'Halcyon Reach · Coast Wing', title: 'Ember Tide' },
        lines: [
          [N, 'The Halcyon Reach. Thirty islands and a lot of weather.'],
          [N, 'Its Coast Wing is three jets, one runway and a radio tower everybody calls Lantern.'],
        ],
      },
      {
        move: { view: 'chase', wingmen: 2 },
        lines: [
          [M, 'Commander Ines Marrow. You are Gull now. You stepped off the mail boat looking seasick, and names stick here.'],
          [P, 'Lieutenant Pip Okafor. I fly the Commander\'s wing and I keep score. Of everything.'],
          [L, 'Lantern tower. If you can hear me, you are not lost yet.'],
          [M, 'Nothing has happened in the Reach for thirty years. That is what this Wing is for. Check ride at first light.'],
        ],
      },
      { card: { kicker: 'Act I', title: 'Fair Weather' } },
    ],
  },

  'red-sky': {
    title: 'Red sky',
    shots: [
      {
        scene: { timeOfDay: 'sunset', seed: 41, clouds: 0.55, view: 'chase', wingmen: 2, chaseDistance: 3.2, ...EMBER },
        lines: [
          [N, 'Past the outer shoals, the black jets with orange tails stop pretending to be lost.'],
          ['Ember Fleet', 'Vanguard to Crown. The Reach has three jets and a lighthouse. Send the raiders.'],
        ],
      },
      {
        scene: { timeOfDay: 'sunset', seed: 41, clouds: 0.5, view: 'top', wingmen: 2 },
        lines: [
          [L, 'Commander, the scope is filling up. They are heading for Tern Harbour.'],
          [M, 'The ferry cannot sail before dusk. Four hundred people.'],
          [M, 'Gull, you are the picket line. Pip and I will hold the north channel.'],
          [P, 'Do not look at me like that. You got the easy side.'],
        ],
      },
      { card: { kicker: 'Act II', title: 'Red Sky' } },
    ],
  },

  cinder: {
    title: 'The voice has a name',
    shots: [
      {
        scene: { timeOfDay: 'sunset', seed: 74, clouds: 0.45, view: 'chase', wingmen: 2, jetScale: 0.85, chaseDistance: 2.0, ...ACE },
        lines: [
          [N, 'Eleven years at the head of the Ember vanguard. Never once shot down.'],
          [C, 'A little bird held a picket line alone, and cleared a depot on ninety rounds.'],
          [C, 'I should like to meet it.'],
        ],
      },
      {
        scene: { timeOfDay: 'sunset', seed: 74, clouds: 0.45, view: 'chase', wingmen: 0 },
        lines: [
          [L, 'Three contacts, coming straight in. The middle one is not trying to hide.'],
          [P, 'That is Cinder. Gull, nobody has ever...'],
          [M, 'Then nobody has tried hard enough. Escorts first. Go.'],
        ],
      },
    ],
  },

  'cinder-falls': {
    title: 'Keep the sky warm',
    shots: [
      {
        scene: { timeOfDay: 'sunset', seed: 74, clouds: 0.6, view: 'top', wingmen: 0 },
        lines: [
          [N, 'Cinder goes into the sea trailing fire. A parachute opens over the water.'],
          [C, 'Well flown, little bird. Keep the sky warm.'],
          [C, 'The tide is coming in behind me.'],
        ],
      },
      {
        move: { view: 'chase' },
        lines: [
          [L, 'Commander... I have a very large return past the shoals. It was not there yesterday.'],
          [M, 'Everybody home. Now.'],
        ],
      },
    ],
  },

  'ember-tide': {
    title: 'They come at night',
    shots: [
      {
        scene: { timeOfDay: 'night', seed: 81, clouds: 0.5, view: 'top', wingmen: 2, ...EMBER },
        lines: [
          [N, 'They come at night now, five at a time.'],
          [N, 'Somewhere past the shoals, one ship is feeding all of it.'],
        ],
      },
      {
        scene: { timeOfDay: 'night', seed: 81, clouds: 0.5, view: 'chase', wingmen: 2 },
        lines: [
          [M, 'We cannot fight what we cannot find. I need pictures.'],
          [P, 'At night. On the deck. Under a patrol.'],
          [M, 'Yes. Gull has the steadiest hands, so Gull has the camera.'],
        ],
      },
      { card: { kicker: 'Act III', title: 'Ember Tide' } },
    ],
  },

  dawn: {
    title: 'All three',
    shots: [
      {
        scene: { timeOfDay: 'sunset', seed: 114, clouds: 0.5, view: 'chase', wingmen: 2, chaseDistance: 3.4 },
        lines: [
          [N, 'Dawn. For the first time, all three jets of the Coast Wing fly together.'],
          [M, 'Thirty years I kept this Wing ready for a day I hoped would never come.'],
          [P, 'Speech later, Commander. Coffee later too. Gull is buying.'],
          [L, 'Lantern to Coast Wing. Every light in the Reach is on for you. Bring them home.'],
        ],
      },
      {
        scene: { timeOfDay: 'sunset', seed: 114, clouds: 0.6, view: 'chase', wingmen: 0, jetScale: 0.9, chaseDistance: 1.9, ...ACE },
        lines: [
          [C, 'Little bird. I have a new jet and the same question.'],
          [C, 'Come and answer it.'],
        ],
      },
    ],
  },

  outro: {
    title: 'Every light still on',
    shots: [
      {
        scene: { timeOfDay: 'day', seed: 7, clouds: 0.3, view: 'chase', wingmen: 2, chaseDistance: 3 },
        lines: [
          [N, 'The Ember Crown turned for the open sea with nothing left to launch.'],
          [N, 'A month later a postcard reached the tower. No stamp, and one line: "Next time, little bird."'],
          [M, 'I am framing that.'],
          [P, 'Five and a half. The half is arguable.'],
        ],
      },
      {
        move: { view: 'top' },
        lines: [
          [N, 'The Coast Wing is four jets now. The newest pilot arrived on the mail boat looking seasick.'],
          [N, 'You told them nothing ever happens here.'],
        ],
      },
      { card: { kicker: 'The end', title: 'Ember Tide' } },
    ],
  },
}

/** the cutscene shown before a sortie's first briefing, and after its first win */
export const BEFORE = { 'picket-line': 'red-sky', cinder: 'cinder', blackout: 'ember-tide', 'ember-crown': 'dawn' }
export const AFTER = { cinder: 'cinder-falls' }
/** the order they are listed in on the flight line */
export const REEL = ['intro', 'red-sky', 'cinder', 'cinder-falls', 'ember-tide', 'dawn', 'outro']

// ───────────────────────────────────────────── faces, drawn on a 16 × 16 grid
const FACES = {
  Marrow: { bg: '#27406b', skin: '#d9a37c', suit: '#1f3a6b', trim: '#ffd27a', top: 'cap' },
  Pip: { bg: '#1f5a4c', skin: '#9c6644', suit: '#3d4a5c', trim: '#8dffb0', top: 'helmet' },
  Lantern: { bg: '#5a4a1f', skin: '#e8b890', suit: '#6b5a3a', trim: '#ffd27a', top: 'headset' },
  Cinder: { bg: '#4a1418', skin: '#17141a', suit: '#17141a', trim: '#ff2f3d', top: 'mask' },
  'Ember Fleet': { bg: '#3a1c12', skin: '#1c1a22', suit: '#1c1a22', trim: '#ff6a2b', top: 'mask' },
}

/** draws who is speaking into a 16 × 16 canvas; false when they have no face (the narrator) */
export function drawFace(canvas, who) {
  const f = FACES[who]
  if (!f) return false
  const g = canvas.getContext('2d')
  const r = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h) }
  const dark = '#14121a'
  r(0, 0, 16, 16, f.bg)
  r(2, 13, 12, 3, f.suit)
  r(7, 13, 2, 3, f.trim)
  r(6, 11, 4, 2, f.skin)
  r(4, 4, 8, 8, f.skin)
  if (f.top === 'mask') {
    r(3, 1, 10, 11, f.skin)
    r(4, 2, 8, 1, '#2c2833')
    r(4, 5, 8, 3, f.trim)
    r(5, 5, 3, 1, '#ffe2b0')
    r(6, 9, 4, 2, '#2c2833')
    r(7, 1, 2, 3, f.trim)
    return true
  }
  r(6, 7, 1, 1, dark)
  r(9, 7, 1, 1, dark)
  if (f.top === 'cap') {
    r(3, 5, 1, 4, '#b9bcc6')
    r(12, 5, 1, 4, '#b9bcc6')
    r(3, 1, 10, 3, f.suit)
    r(3, 4, 10, 1, dark)
    r(7, 2, 2, 1, f.trim)
    r(7, 10, 2, 1, '#8a4a3a')
  } else if (f.top === 'helmet') {
    r(3, 1, 10, 4, '#eef0f4')
    r(3, 5, 1, 5, '#eef0f4')
    r(12, 5, 1, 5, '#eef0f4')
    r(7, 1, 2, 4, f.trim)
    r(4, 4, 8, 1, dark)
    r(6, 10, 4, 1, '#f4f1e6')
  } else {
    r(4, 2, 8, 3, '#5a3a22')
    r(3, 2, 10, 1, dark)
    r(2, 6, 2, 3, dark)
    r(12, 6, 2, 3, dark)
    r(3, 3, 1, 3, dark)
    r(12, 3, 1, 3, dark)
    r(4, 10, 3, 1, dark)
    r(8, 10, 2, 1, '#8a4a3a')
  }
  return true
}
