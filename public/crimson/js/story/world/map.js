// js/story/world/map.js : the paper map (1024 x 1024 canvas). The worker paints the ground (watercolour
// hill shading, contours, red rock); here the creek, the roads and the ink labels go on top. Places ink in
// once revealed (MISSIONS persists the set in the save); until then the Hart Ranch is a blank smudge.
// toMap(x, z) -> [u, v] in 0..1 (u east, v south, like the canvas).
import { CAIRNS, PLACES, REGIONS, REGION_NAMES } from './places.js';
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
  // the label layout: the cairns (drawn over the map by the map screen, about 14 px round here) and every
  // place label's spot are kept clear; region names and place labels take the first free spot of a few
  const cairnBoxes = Object.values(CAIRNS).map((c) => { const [x, y] = P(c.x, c.z); return { x0: x - 15, x1: x + 15, y0: y - 15, y1: y + 15 }; });
  const hit = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
  const taken = [];
  const pointBoxes = Object.keys(LABELS).filter((id) => PLACES[id]).map((id) => { const [x, y] = P(PLACES[id].x, PLACES[id].z); return { x0: x - 40, x1: x + 40, y0: y - 19, y1: y + 4 }; });
  const blocked = (b) => cairnBoxes.some((c) => hit(b, c)) || pointBoxes.some((c) => hit(b, c)) || taken.some((c) => hit(b, c));
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
    // region names in a spaced serif, on a soft paper halo (the roads and the creek stop short of the
    // letters), each moved to the first spot clear of the cairns and of every place label
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = 'italic 17px Georgia, serif';
    for (const [id, r] of Object.entries(REGIONS)) {
      const t = spaced(REGION_NAMES[id] || id), w = g.measureText(t).width, [x0, y0] = P(r.x, r.z);
      const spots = [[0, -28], [0, 30], [0, -58], [0, 58], [0, -86], [0, 86]];
      let at = spots[0];
      for (const [dx, dy] of spots) { const b = { x0: x0 + dx - w / 2 - 4, x1: x0 + dx + w / 2 + 4, y0: y0 + dy - 11, y1: y0 + dy + 11 }; if (!blocked(b)) { at = [dx, dy]; break; } }
      const x = x0 + at[0], y = y0 + at[1];
      taken.push({ x0: x - w / 2 - 4, x1: x + w / 2 + 4, y0: y - 11, y1: y + 11 });
      g.lineWidth = 5; g.strokeStyle = 'rgba(240,228,204,0.55)'; g.strokeText(t, x, y);
      g.fillStyle = 'rgba(90,50,30,0.6)'; g.fillText(t, x, y);
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
    g.font = 'bold 13px Georgia, serif';
    const placed = [];
    for (const [id, label] of Object.entries(LABELS)) {
      if (!revealed.has(id) && !ALWAYS.includes(id)) continue;
      const p = PLACES[id], [x, y] = P(p.x, p.z), w = g.measureText(label).width;
      g.fillStyle = 'rgba(40,24,16,0.9)'; g.beginPath(); g.arc(x, y, 2.6, 0, 7); g.fill();
      // above the dot, else below, right or left: clear of the cairns and of the labels already inked
      const spots = [[0, -11], [0, 12], [w / 2 + 7, 0], [-w / 2 - 7, 0], [0, -26]];
      let at = spots[0];
      for (const [dx, dy] of spots) { const b = { x0: x + dx - w / 2 - 2, x1: x + dx + w / 2 + 2, y0: y + dy - 8, y1: y + dy + 8 }; if (!cairnBoxes.some((c) => hit(b, c)) && !placed.some((c) => hit(b, c))) { at = [dx, dy]; break; } }
      const lx = x + at[0], ly = y + at[1];
      placed.push({ x0: lx - w / 2 - 2, x1: lx + w / 2 + 2, y0: ly - 8, y1: ly + 8 });
      g.lineWidth = 4; g.strokeStyle = 'rgba(248,240,222,0.9)'; g.lineJoin = 'round';
      g.strokeText(label, lx, ly); g.fillStyle = 'rgba(40,24,16,0.9)'; g.fillText(label, lx, ly);
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
