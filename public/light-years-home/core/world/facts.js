// Light Years Home v3: the fact cards (final.md 10.1, 10.3). Each card has a short title, at most 25 words of text,
// an optional number for the info box (shown 3 s after a scan) and the page it comes from. Scans, zones, missions,
// secrets and sets name cards by id. Card text waits in the log; it never pops up over play.

const W = 'https://en.wikipedia.org/wiki/';

const card = (id, kind, title, text, number, source) => ({ id, kind, title, text, number, source });

const LIST = [
  // ---------------------------------------------------------------- The Wall: scans
  card('any-galaxy', 'scan', 'GALAXIES', 'Each point here is a galaxy, most with billions of stars.',
    'A MILKY WAY HERE: 2 SHIP LENGTHS', W + 'Galaxy'),
  card('filament', 'scan', 'FILAMENTS', 'Galaxies gather in long filaments round huge empty voids. Clusters sit where '
    + 'filaments meet.', null, W + 'Large-scale_structure_of_the_universe'),
  card('void', 'scan', 'A VOID', 'A void is a huge region between filaments with very few galaxies.',
    'ABOUT 15 MILLION LY ACROSS', W + 'Void_(astronomy)'),
  card('node0', 'scan', 'NODE 0', 'A cluster where filaments meet. Thousands like it have only catalogue numbers.',
    '60 GALAXIES ORBIT HERE', W + 'Galaxy_cluster'),
  card('far-coma', 'scan', 'COMA CLUSTER', 'The Coma Cluster: over 1,000 galaxies, with two giant ellipticals at its '
    + 'heart.', '737 MLY FROM HERE', W + 'Coma_Cluster'),
  card('far-leo', 'scan', 'LEO CLUSTER', 'The Leo Cluster, Abell 1367. Its brightest galaxy is NGC 3842.',
    '9.6° FROM COMA', W + 'Leo_Cluster'),
  card('far-hercules', 'scan', 'HERCULES CLUSTER', 'The Hercules Cluster, Abell 2151, is rich in spiral galaxies.',
    '28° FROM COMA', W + 'Hercules_Cluster'),

  // ---------------------------------------------------------------- Coma City: scans
  card('ngc4889', 'scan', 'NGC 4889', 'Probably the largest galaxy within 326 million light-years of us. Its black '
    + 'hole is about 21 billion Suns.', '21 BILLION SUNS', W + 'NGC_4889'),
  card('ngc4874', 'scan', 'NGC 4874', "The other supergiant elliptical at Coma's core.", null, W + 'NGC_4874'),
  card('ngc4911', 'scan', 'NGC 4911', 'A warped spiral deep inside Coma, with a ring of new stars round its core. '
    + 'Spirals rarely live this deep.', null, W + 'NGC_4911'),
  card('ngc4921', 'scan', 'NGC 4921', "Coma's brightest spiral is 'anemic': it makes few new stars. The hot gas here "
    + 'strips its gas away.', 'ANEMIC', W + 'NGC_4921'),
  card('fast-traffic', 'scan', 'TOO FAST', 'In 1933 Zwicky found these galaxies move too fast for the mass we can '
    + 'see. He called the rest dark matter.', '1933', W + 'Coma_Cluster'),
  card('hot-gas', 'scan', 'HOT GAS', 'Gas at about 100 million degrees fills the cluster. It glows in X-rays and '
    + 'holds more mass than all the stars.', null, W + 'Intracluster_medium'),
  card('udg', 'scan', 'GHOST GALAXY', 'Ultra-diffuse galaxies are as wide as the Milky Way, with about 1% of its stars.',
    '1% OF THE STARS', W + 'Ultra_diffuse_galaxy'),
  card('d100', 'scan', 'D100', 'It is losing its gas into a long tail as it falls through the cluster. Its tail is '
    + 'drawn longer here.', null, W + 'Coma_Cluster'),
  card('cfa2-wall', 'scan', 'CFA2 GREAT WALL', 'A wall of galaxies at least 500 million light-years long. It holds '
    + 'Coma, Leo and Hercules.', null, W + 'CfA2_Great_Wall'),
  card('leo-c', 'scan', 'LEO CLUSTER', "The Leo Cluster is Coma's partner in the Coma Supercluster.", null,
    W + 'Coma_Supercluster'),

  // ---------------------------------------------------------------- Virgo and the jet: scans (Round 2)
  card('m87', 'scan', 'M87', 'A giant elliptical, 132,000 light-years across, with about 12,000 globular clusters.',
    '12,000 GLOBULARS', W + 'Messier_87'),
  card('m87bh', 'scan', 'M87*', '6.5 billion Suns. The first black hole ever pictured, published on 10 April 2019.',
    '6.5 BILLION SUNS', W + 'Messier_87'),
  card('jet', 'scan', "M87'S JET", 'Up to 5,000 light-years long. Its blobs seem to move faster than light. They '
    + 'come at us near light speed instead.', 'SEEN AT 6c', W + 'Messier_87'),
  card('hst1', 'scan', 'HST-1', 'A knot about 200 light-years out. Its X-rays rose 50 times in four years, to 2006.',
    '×50 IN X-RAYS', W + 'Messier_87'),
  card('chain', 'scan', "MARKARIAN'S CHAIN", 'A curved line of galaxies. At least seven of them move together.',
    '7 MOVE TOGETHER', W + 'Markarian%27s_Chain'),
  card('eyes', 'scan', 'THE EYES', 'NGC 4435 and NGC 4438, a pair in the chain, are called the Eyes.', null,
    W + 'Eyes_Galaxies'),
  card('m49', 'scan', 'M49', "The cluster's brightest galaxy.", null, W + 'Messier_49'),
  card('intracluster', 'scan', 'STRAYS', "Up to 10% of Virgo's stars drift between the galaxies.", 'UP TO 10%',
    W + 'Virgo_Cluster'),
  card('messier-list', 'scan', "MESSIER'S LIST", 'Charles Messier listed these smudges so comet hunters would not '
    + 'mistake them for comets.', '110 OBJECTS', W + 'Messier_object'),

  // ---------------------------------------------------------------- zone cards (on arrival)
  card('wall', 'zone', 'THE WALL', 'Inside the Sloan Great Wall, 1.000 billion light-years from Earth.', null,
    W + 'Sloan_Great_Wall'),
  card('coma', 'zone', 'COMA CITY', 'Over 1,000 galaxies, 323 million light-years from Earth.', null,
    W + 'Coma_Cluster'),
  card('virgo', 'zone', 'VIRGO', '1,300 to 2,000 galaxies, 54 million light-years away. Its pull slows our escape '
    + 'by about 10%.', null, W + 'Virgo_Cluster'),

  // ---------------------------------------------------------------- missions, secrets and sets
  card('coma-giants', 'mission', 'TWO GIANTS', 'Coma has two giant galaxies at its heart, NGC 4874 and NGC 4889.',
    null, W + 'Coma_Cluster'),
  card('galaxy-flow', 'mission', 'FEEDING LINES', 'Gas flows down the filaments and feeds the galaxies growing where '
    + 'filaments cross.', null, W + 'Large-scale_structure_of_the_universe'),
  card('gravity-assist', 'mission', 'GRAVITY ASSIST', 'Spacecraft steal speed from planets by swinging past them: '
    + 'a gravity assist.', null, W + 'Gravity_assist'),
  card('coma-speeds', 'mission', 'RUSH HOUR', "Coma's galaxies rush about at roughly 1,000 km/s.", '1,000 KM/S',
    W + 'Coma_Cluster'),
  card('curtis-ray', 'mission', 'A CURIOUS RAY', "In 1918 Heber Curtis saw 'a curious straight ray' coming out of "
    + 'M87.', '1918', W + 'Messier_87'),
  card('sloan-wall', 'secret', 'SLOAN GREAT WALL', 'About 1.37 billion light-years long, found in 2003. It may be '
    + 'three structures lined up by chance.', '1.37 BILLION LY', W + 'Sloan_Great_Wall'),
  card('dark-matter', 'secret', 'DARK MATTER', "About 90% of Coma's mass is thought to be dark matter.", '90%',
    W + 'Coma_Cluster'),
  card('udg-big', 'secret', 'THE BIG GHOST', 'Some ghosts in Coma are 60,000 light-years wide, yet hold about 1% of '
    + "the Milky Way's stars.", null, W + 'Ultra_diffuse_galaxy'),
  card('udg-many', 'set', 'GHOSTS', 'Coma holds many of these faint ghost galaxies, spread through the cluster like '
    + 'the bright ones.', null, W + 'Ultra_diffuse_galaxy'),
  card('photon-ring', 'secret', 'PHOTON RING', 'Light can circle a black hole at 1.5 times its event-horizon radius.',
    null, W + 'Photon_sphere'),
];

/** FACTS: id → { id, kind, title, text, number, source }. */
export const FACTS = Object.freeze(Object.fromEntries(LIST.map((c) => [c.id, Object.freeze(c)])));
export const FACT_LIST = Object.freeze(LIST.map((c) => FACTS[c.id]));
export const factById = (id) => FACTS[id] || null;
