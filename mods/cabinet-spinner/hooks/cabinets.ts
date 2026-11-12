// Every cabinet of the Cottage Arcade (public/arcade/switch.js), with the folders its game lives in,
// the verbs the spinner says while Claude works on it, and the phrase that closes a turn. Pure:
// mods/check.mjs checks that every game in switch.js has a cabinet here.

export type Cabinet = {
  id: string
  name: string
  /** Folders from the repository root; the longest one that holds a file wins. */
  folders: readonly string[]
  verbs: readonly string[]
  /** What the line that closes a turn says before the time: "Landed it in 3s". */
  end: string
}

export const ARCADE: Cabinet = {
  id: 'arcade', name: 'Cottage Arcade', folders: ['public/arcade/', 'public/index.html'],
  verbs: ['Inserting a token', 'Pressing Start', 'Blowing on the cartridge', 'Feeding the change machine'],
  end: 'Stage clear in',
}

export const CABINETS: readonly Cabinet[] = [
  ARCADE,
  { id: 'tidebreak', name: 'Shore of the Ancients', folders: ['public/tidebreak/', 'qa/tidebreak/'],
    verbs: ['Pushing the lane', 'Banishing', 'Guarding the ward', 'Waking the Wild Hunt'], end: 'Ward held in' },
  { id: 'brawl', name: 'Cottage Brawl', folders: ['public/brawl/'],
    verbs: ['Brawling', 'Grabbing a power-up', 'Guarding the ledge'], end: 'Knocked out in' },
  { id: 'worlds', name: 'Small Worlds', folders: ['public/lab/worlds/'],
    verbs: ['Swinging the thread', 'Bending the seasons', 'Leading the river home'], end: 'World saved in' },
  { id: 'plungerd', name: "Get Plunger'd", folders: ['public/plungerd/'],
    verbs: ['Plunging', 'Rolling', 'Reloading', 'Blowing the air horn'], end: 'Room cleared in' },
  { id: 'drain', name: 'Down the Drain', folders: ['public/fall/'],
    verbs: ['Digging', 'Pouring sand', 'Dodging lava', 'Falling'], end: 'Down the drain in' },
  { id: 'crimson', name: 'Crimson Rogue', folders: ['public/crimson/', 'qa/crimson/'],
    verbs: ['Laying low', 'Picking the lock', 'Raising the heat'], end: 'Got away in' },
  { id: 'wild', name: 'Breath of the Lake', folders: ['public/wild/', 'qa/wild/'],
    verbs: ['Gliding', 'Climbing', 'Exploring the lake'], end: 'Shrine cleared in' },
  { id: 'fish', name: 'Reel It In', folders: ['public/fish/', 'apps/fish/', 'qa/fish/'],
    verbs: ['Casting', 'Reeling', 'Setting the hook', 'Waiting for a bite'], end: 'Landed it in' },
  { id: 'vr', name: 'In Full Swing', folders: ['public/vr/', 'qa/vr/'],
    verbs: ['Swinging', 'Climbing', 'Catching a ring'], end: 'Swung home in' },
  { id: 'olympus', name: 'Olympus', folders: ['public/olympus/', 'games/olympus/'],
    verbs: ['Carrying the flame', 'Climbing Olympus', 'Tending the fire'], end: 'Flame lit in' },
  { id: 'moonwell', name: 'Moonwell', folders: ['public/moonwell/', 'qa/moonwell/'],
    verbs: ['Flipping the pearl', 'Clearing the ridge', 'Lighting lanterns', 'Crossing the islands'], end: 'Ridge cleared in' },
  { id: 'primordia', name: 'Primordia', folders: ['public/primordia/', 'qa/primordia/'],
    verbs: ['Growing', 'Convolving', 'Evolving', 'Gliding'], end: 'Evolved in' },
  { id: 'breakthrough', name: 'Breakthrough', folders: ['public/breakthrough2/', 'public/breakthrough/', 'qa/breakthrough/', 'qa/breakthrough2/'],
    verbs: ['Cutting emissions', 'Researching', 'Planting forests'], end: 'Breakthrough in' },
  { id: 'follow-suit', name: 'Follow Suit', folders: ['public/follow-suit/', 'follow-suit/'],
    verbs: ['Shuffling', 'Following suit', 'Trumping', 'Leading a trick'], end: 'Trick taken in' },
  { id: 'river-rush', name: 'River Rush', folders: ['public/river-rush/', 'games/river-rush/', 'qa/river-rush/'],
    verbs: ['Running the rapids', 'Reaching for the key', 'Unlocking the chest', 'Racing the rival'], end: 'Escaped the falls in' },
  { id: 'lab', name: 'The Lab', folders: ['public/lab/', 'qa/lab/'],
    verbs: ['Prototyping', 'Building a toy', 'Testing the bar'], end: 'Prototype ran in' },
  { id: 'neon', name: 'Neon Ronin', folders: ['public/neon/', 'qa/neon/'],
    verbs: ['Parrying', 'Drawing steel', 'Reading the windup'], end: 'Duel won in' },
  { id: 'echo', name: 'Loon Echo', folders: ['public/echo/', 'qa/echo/'],
    verbs: ['Herding chicks', 'Dodging the eel', 'Calling the flock'], end: 'Chicks home in' },
  { id: 'tellme', name: 'Tell Me', folders: ['public/tellme/', 'qa/tellme/'],
    verbs: ['Dealing critters', 'Reading the table', 'Telling'], end: 'Hand won in' },
  { id: 'plunge', name: 'Take the Plunge', folders: ['public/lab/plunge/'],
    verbs: ['Diving', 'Tucking', 'Gliding south'], end: 'Flew south in' },
  { id: 'creek', name: 'Up the Creek', folders: ['public/lab/creek/'],
    verbs: ['Paddling', 'Bracing', 'Boofing', 'Catching an eddy'], end: 'Through the rapids in' },
  { id: 'tilt', name: 'Full Tilt', folders: ['public/lab/tilt/'],
    verbs: ['Flipping', 'Nudging', 'Lighting beacons'], end: 'Jump gate in' },
  { id: 'rules', name: 'House Rules', folders: ['public/lab/rules/'],
    verbs: ['Pouring lava', 'Placing drains', 'Settling the layer'], end: 'Layer settled in' },
  { id: 'gta', name: 'GTA Montréal', folders: ['public/gta/', 'games/nord-unreal/'],
    verbs: ['Circling the park', 'Picking up a friend', 'Crossing the Plateau'], end: 'Made it across town in' },
  { id: 'ascii-front', name: 'ASCII Front', folders: ['public/ascii-front/', 'games/ascii-front/', 'qa/ascii-front/'],
    verbs: ['Holding the base', 'Rolling out', 'Drawing the front line'], end: 'Front held in' },
  { id: 'battle-tanks', name: 'Battle Tanks', folders: ['public/battle-tanks/', 'qa/battle-tanks/'],
    verbs: ['Flanking', 'Bombarding', 'Extracting'], end: 'Extracted in' },
  { id: 'pingpong', name: 'Table Tennis', folders: ['public/pingpong/', 'qa/pingpong/'],
    verbs: ['Serving', 'Returning a spin', 'Smashing'], end: 'Match point in' },
  { id: 'silent-depth', name: 'Silent Depth', folders: ['public/silent-depth/', 'qa/silent-depth/'],
    verbs: ['Running silent', 'Tracking the convoy', 'Firing torpedoes'], end: 'Surfaced in' },
  { id: 'light-years-home', name: 'Light Years Home', folders: ['public/light-years-home/', 'qa/light-years-home/'],
    verbs: ['Drifting round a galaxy', 'Chasing thieves', 'Punching to light speed'], end: 'Home in' },
  { id: 'ahead-of-the-light', name: 'Ahead of the Light', folders: ['public/ahead-of-the-light/', 'qa/ahead-of-the-light/'],
    verbs: ['Threading the stars', 'Outrunning the burst', 'Running home'], end: 'Ahead of the light in' },
  { id: 'first-breath', name: 'First Breath', folders: ['public/first-breath/', 'qa/first-breath/'],
    verbs: ['Racing to the egg', 'Growing a heart', 'Turning'], end: 'First breath in' },
  { id: 'frostwing', name: 'Frostwing', folders: ['public/frostwing/', 'qa/frostwing/'],
    verbs: ['Dogfighting', 'Shooting meteorites', 'Bringing the squadron home'], end: 'Squadron home in' },
  { id: 'ember-drift', name: 'Ember Drift', folders: ['public/ember-drift/'],
    verbs: ['Drifting', 'Lighting a star', 'Staying lit'], end: 'Still lit in' },
  { id: 'lake-brawl', name: 'Lake Brawl', folders: ['public/lake-brawl/', 'games/lake-brawl/', 'qa/lake-brawl/'],
    verbs: ['Brawling at the summit', 'Claiming the lake', 'Landing a combo'], end: 'Lake claimed in' },
  { id: 'afterlight', name: 'Afterlight', folders: ['public/afterlight/', 'qa/afterlight/'],
    verbs: ['Bringing them home', 'Crossing a world', 'Changing worlds'], end: 'Brought them home in' },
  { id: 'lighthouse-keeper', name: 'Lighthouse Keeper', folders: ['public/lighthouse-keeper/'],
    verbs: ['Turning the lamp', 'Guiding a boat', 'Reading the fog'], end: 'Boats home in' },
  { id: 'echoes-under-ice', name: 'Echoes Under Ice', folders: ['public/echoes-under-ice/'],
    verbs: ['Diving under the ice', 'Listening for bells', 'Raising a bell'], end: 'Bells recovered in' },
  { id: 'last-train-home', name: 'Last Train Home', folders: ['public/last-train-home/'],
    verbs: ['Following reflections', 'Checking the platform', 'Catching the train'], end: 'Caught the train in' },
  { id: 'firefly-courier', name: 'Firefly Courier', folders: ['public/firefly-courier/'],
    verbs: ['Carrying the light', 'Crossing the forest', 'Making a delivery'], end: 'Delivered in' },
  { id: 'mirage-runner', name: 'Mirage Runner', folders: ['public/mirage-runner/'],
    verbs: ['Sailing the dunes', 'Trusting the lights', 'Steering by the stars'], end: 'Crossed the dunes in' },
  { id: 'orbital-gardener', name: 'Orbital Gardener', folders: ['public/orbital-gardener/'],
    verbs: ['Planting under Earthrise', 'Watering the garden', 'Catching starlight'], end: 'Garden grown in' },
  { id: 'eleven-wells', name: 'Eleven Wells', folders: ['public/eleven-wells/'],
    verbs: ['Dropping blocks', 'Clearing a line', 'Switching wells'], end: 'Wells cleared in' },
  { id: 'ledger', name: "Warden's Ledger", folders: ['public/ledger/', 'qa/ledger/', 'pop/'],
    verbs: ['Posting a task', 'Hiring an agent', 'Checking the work', 'Paying on proof'], end: 'Paid out in' },
  { id: 'last-light', name: 'Last Light', folders: ['public/last-light/', 'qa/last-light/'],
    verbs: ['Setting sail', 'Carrying the sparks', 'Crossing open water'], end: 'Sparks home in' },
]

/** The cabinet whose folder holds a path (absolute or from the root), or null. */
export function cabinetOf(file: string): Cabinet | null {
  const path = `/${file.replace(/\\/g, '/').replace(/^\/+/, '')}`
  let best: Cabinet | null = null, bestLength = 0
  for (const cabinet of CABINETS) {
    for (const folder of cabinet.folders) {
      if (folder.length > bestLength && path.includes(`/${folder}`)) {
        best = cabinet
        bestLength = folder.length
      }
    }
  }
  return best
}

export const byId = (id: string | null | undefined): Cabinet => CABINETS.find(c => c.id === id) ?? ARCADE

/** Formats a duration as the engine's turn line does: 3s, 1m 4s, 2h 5m. */
export function durationText(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${s % 60}s`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

export const MAX_TOKENS = 9
export const START_TOKENS = 3

/** The status line: the cabinet and the tokens, or FREE PLAY. */
export const statusOf = (cabinet: Cabinet, tokens: number): string =>
  `${cabinet.name} · ${tokens > 0 ? `${tokens} token${tokens === 1 ? '' : 's'}` : 'FREE PLAY'}`
