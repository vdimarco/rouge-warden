function streetFrame(dt, inPlay) {
  street.limit = isXR() ? STREET.maxXR : STREET.max;
  HERO_SEEN.x = P.pos.x; HERO_SEEN.y = P.pos.y; HERO_SEEN.z = P.pos.z;
  HERO_SEEN.vx = P.vel.x; HERO_SEEN.vy = P.vel.y; HERO_SEEN.vz = P.vel.z; HERO_SEEN.onGround = !!P.onGround;
  const act = actionOn();
  street.update(dt, G.time, P.pos, inPlay ? HERO_SEEN : null, act ? cars.hazards(STREET_HAZARDS) : null);
  figures.begin(camera.getWorldPosition(CAMW), G.time);
  streetView.update(dt, G.time, CAMW);
  if (act) {
    for (const g of combat.goons) if (g.on) figures.add(goonOnThrees(g), "goons");
    for (const q of jobs.people) if (q.on) figures.add(q, "jobs");
  }
  figures.end();
  actionView.setVisible(act && worldVisible);
  if (act) actionView.update(dt, G.time, { markers: G.state !== "cutscene", cam: CAMW });
  audio.setCrowd(inPlay ? street.crowd : 0);
}
function goonOnThrees(g) {
  if (verseMode() === "off" || !flatOn) return g;
  let v = GOON_VIEW.get(g);
  if (!v) { v = { k: -1, pose: -1 }; GOON_VIEW.set(g, v); if (GOON_VIEW.size > 64) for (const q of GOON_VIEW.keys()) if (!q.on) GOON_VIEW.delete(q); }
  const k = Math.floor(G.time * VERSE.goons);
  if (k !== v.k || g.pose !== v.pose || g.state !== v.state) {
    v.k = k; v.pose = g.pose; v.state = g.state;
    v.phase = g.phase; v.poseT = g.poseT; v.stride = g.stride; v.yaw = g.yaw; v.bp = g.bp; v.br = g.br; v.lift = g.lift; v.delay = g.delay;
  }
  v.x = g.x; v.y = g.y; v.z = g.z;
  v.shirt = g.shirt; v.pants = g.pants; v.skin = g.skin; v.height = g.height;
  return v;
}
