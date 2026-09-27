// js/story/world/map.js : the paper map (1024 x 1024 canvas). The worker paints the ground (watercolour
// hill shading, contours, red rock); here the creek, the roads and the ink labels go on top. Places ink in
// once revealed (MISSIONS persists the set in the save); until then the Hart Ranch is a blank smudge.
// toMap(x, z) -> [u, v] in 0..1 (u east, v south, like the canvas).
import { PLACES, REGIONS, REGION_NAMES } from './places.js';
import { MAP } from './gen.worker.js';

// the labels a revealed place gets (the rest of the ids stay unlabelled: they are spawns or details)
const LABELS = {
  canyon_fleet: 'Canyon Fleet', gas: 'Red Dirt Gas', sunline_plaza: 'Sunline', motel: 'Motor Lodge', airport_mesa: 'Airport Mesa', airport_overlook: 'Overlook',
  coffee_pot: 'Coffee Pot', airstream: "Gabe's Airstream", y_roundabout: 'The Y', uptown: 'Uptown', rattlesnake_room: 'Rattlesnake Room', mask_mayhem: 'Mask & Mayhem',
  blush_depot: 'Sunburst Jeeps', aframe: 'The A-frame', midgley_lot: 'Midgley Bridge', perch: 'The Perch', slide_rock: 'Slide Rock', fr9_turnoff: 'FR 9',
  hart_ranch: 'Hart Ranch', hart_ridge: 'Hart Ridge', schnebly_vista: 'Schnebly Vista', arts_village: 'Arts Village', red_rock_crossing: 'Red Rock Crossing',
  cathedral: 'Cathedral Rock', bell_rock: 'Bell Rock', courthouse: 'Courthouse', diner: 'Moonrise Diner', boynton: 'Boynton Canyon', capitol_butte: 'Capitol Butte',
  snoopy_rock: 'Snoopy Rock', chapel: 'The Chapel',
};
// always inked: the landmarks anyone can see
const ALWAYS = ['y_roundabout', 'uptown', 'cathedral', 'bell_rock', 'courthouse', 'capitol_butte', 'coffee_pot', 'airport_mesa', 'snoopy_rock', 'midgley_lot'];

export function* createMap(S, { mapBytes, net, creek, revealed, canvas: target }) {
  const canvas = target || document.createElement('canvas'); canvas.width = canvas.height = MAP;
  const base = document.createElement('canvas'); base.width = base.height = MAP;
  const toMap = (x, z) => [(x + 1000) / 2000, (z + 1000) / 2000];
  const P = (x, z) => [(x + 1000) / 2000 * MAP, (z + 1000) / 2000 * MAP];
  // the base: ground, creek, roads
  {
    const g = base.getContext('2d');
    g.putImageData(new ImageData(new Uint8ClampedArray(mapBytes.buffer, mapBytes.byteOffset, mapBytes.byteLength), MAP, MAP), 0, 0);
    g.lineCap = 'round'; g.lineJoin = 'round';
    yield;
    // the creek: a soft blue wash with a darker line
    g.strokeStyle = 'rgba(70,120,150,0.55)'; g.lineWidth = 5; line(g, creek.map((c) => [c[0], c[1]]));
    g.strokeStyle = 'rgba(40,80,110,0.9)'; g.lineWidth = 1.6; line(g, creek.map((c) => [c[0], c[1]]));
    yield;
    // roads: a pale casing and an ink line; dirt roads dashed
    for (const pass of [0, 1]) for (const r of net.roads) {
      const pts = r.line.map((p) => [p.x, p.z]); if (r.closed) pts.push(pts[0]);
      const w = r.width / 2000 * MAP;
      if (!pass) { g.setLineDash([]); g.strokeStyle = 'rgba(250,244,230,0.9)'; g.lineWidth = w + 3.5; line(g, pts); }
      else { g.setLineDash(r.surface === 'dirt' ? [5, 4] : []); g.strokeStyle = r.surface === 'dirt' ? 'rgba(120,70,40,0.95)' : 'rgba(50,34,26,0.95)'; g.lineWidth = r.surface === 'dirt' ? 1.6 : Math.max(1.8, w * 0.7); line(g, pts); }
    }
    g.setLineDash([]);
    yield;
    // region names in a spaced serif
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const [id, r] of Object.entries(REGIONS)) {
      const [x, y] = P(r.x, r.z); g.font = 'italic 17px Georgia, serif'; g.fillStyle = 'rgba(90,50,30,0.55)';
      g.fillText(spaced(REGION_NAMES[id] || id), x, y - 28);
    }
    // a paper edge
    const pg = g.createRadialGradient(MAP / 2, MAP / 2, MAP * 0.36, MAP / 2, MAP / 2, MAP * 0.76); pg.addColorStop(0, 'rgba(120,90,50,0)'); pg.addColorStop(1, 'rgba(120,90,50,0.3)');
    g.fillStyle = pg; g.fillRect(0, 0, MAP, MAP);
  }
  function line(g, pts) { g.beginPath(); pts.forEach(([x, z], i) => { const [a, b] = P(x, z); if (i) g.lineTo(a, b); else g.moveTo(a, b); }); g.stroke(); }
  function spaced(s) { return s.split('').join(' '); }
  // revealed.add() redraws too, so a caller may use the Set directly
  const add = revealed.add.bind(revealed);
  revealed.add = (id) => { const had = revealed.has(id); add(id); if (!had && ready) draw(); return revealed; };
  let version = 0, ready = false;
  function draw() {
    const g = canvas.getContext('2d');
    g.drawImage(base, 0, 0);
    // the ranch is a smudge until someone has seen it
    if (!revealed.has('hart_ranch')) {
      const [x, y] = P(PLACES.hart_ranch.x, PLACES.hart_ranch.z), gr = g.createRadialGradient(x, y, 4, x, y, 46);
      gr.addColorStop(0, 'rgba(120,104,86,0.85)'); gr.addColorStop(0.7, 'rgba(150,130,110,0.6)'); gr.addColorStop(1, 'rgba(150,130,110,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, 46, 0, 7); g.fill();
    }
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const [id, label] of Object.entries(LABELS)) {
      if (!revealed.has(id) && !ALWAYS.includes(id)) continue;
      const p = PLACES[id], [x, y] = P(p.x, p.z);
      g.fillStyle = 'rgba(40,24,16,0.9)'; g.beginPath(); g.arc(x, y, 2.6, 0, 7); g.fill();
      g.font = 'bold 13px Georgia, serif'; g.lineWidth = 3; g.strokeStyle = 'rgba(248,240,222,0.85)';
      g.strokeText(label, x, y - 11); g.fillText(label, x, y - 11);
    }
    version++;
  }
  yield;
  ready = true; draw();
  return {
    canvas, toMap, revealed,
    get version() { return version; },
    reveal(id) { if (id) revealed.add(id); },
    redraw: draw,
  };
}
