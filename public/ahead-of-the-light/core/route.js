// Ahead of the Light: the route home as words and numbers (final.md 11.1, 18.1): each leg's stops with their
// distances from Earth, and the fact lines the vistas, captions and the ship's log show. Copied (not imported) from
// light-years-home/core/objects.js and core/world/facts.js, which another team is changing: each stop keeps its
// objects.js id and each fact its v3 card id, and qa/ahead-of-the-light/copies.test.mjs checks them against the
// originals (distances within 0.5 %, card text the same). Pure.

// A stop: { id (objects.js id), name, leg (the ROUTE leg it belongs to), role ('region': the leg you cross; 'gate':
// a landmark at its end; 'sight': something you pass), ly (from Earth), card (the v3 card id, or null) }.
const stop = (id, name, leg, role, ly, card = null) => Object.freeze({ id, name, leg, role, ly, card });

export const STOPS = Object.freeze([
  stop('start', 'SLOAN GREAT WALL', 'web', 'region', 1.000e9, 'wall'),
  stop('ngc4874', 'NGC 4874', 'web', 'gate', 3.157e8, 'ngc4874'),
  stop('ngc4889', 'NGC 4889', 'web', 'gate', 3.066e8, 'ngc4889'),
  stop('coma', 'COMA CLUSTER', 'coma', 'region', 3.229e8, 'coma'),
  stop('m84', 'M84', 'coma', 'gate', 5.489e7),
  stop('m86', 'M86', 'coma', 'gate', 5.200e7),
  stop('virgo', 'VIRGO CLUSTER', 'virgo', 'region', 5.382e7, 'virgo'),
  stop('m87', 'M87', 'virgo', 'sight', 5.349e7, 'm87'),
  stop('ngc4473', 'NGC 4473', 'virgo', 'sight', 5.274e7),
  stop('ngc4477', 'NGC 4477', 'virgo', 'sight', 5.480e7),
  stop('andromeda', 'ANDROMEDA', 'virgo', 'gate', 2.495e6),
  stop('triangulum', 'TRIANGULUM', 'virgo', 'gate', 2.880e6),
  stop('local-group', 'THE LOCAL GROUP', 'local', 'region', 1.241e6),
  stop('lmc', 'THE LMC', 'local', 'gate', 1.630e5),
  stop('smc', 'THE SMC', 'local', 'gate', 2.037e5),
  stop('galactic-centre', 'THE GALACTIC CENTRE', 'milkyway', 'region', 2.700e4),
  stop('orion-arm', 'THE ORION ARM', 'milkyway', 'gate', 1245),
  stop('orion-nebula', 'THE ORION NEBULA', 'orion', 'region', 1269),
  stop('betelgeuse', 'BETELGEUSE', 'orion', 'sight', 548),
  stop('pleiades', 'THE PLEIADES', 'neighbours', 'region', 444.2),
  stop('hyades', 'THE HYADES', 'neighbours', 'sight', 153),
  stop('sirius', 'SIRIUS', 'neighbours', 'sight', 8.609),
  stop('alpha-centauri', 'ALPHA CENTAURI', 'neighbours', 'sight', 4.342),
  stop('sun', 'THE SUN', 'neighbours', 'gate', 1.578e-5),
  stop('saturn', 'SATURN', 'earth', 'sight', 1.336e-4),
  stop('jupiter', 'JUPITER', 'earth', 'sight', 9.112e-5),
  stop('moon', 'THE MOON', 'earth', 'sight', 4.230e-8),
  stop('earth', 'EARTH', 'earth', 'region', 0),
]);
export const STOP = Object.freeze(Object.fromEntries(STOPS.map((s) => [s.id, s])));

// Fact lines. From the v3 cards: { id, leg, text, card } with text exactly the card's. From objects.js: { id, leg,
// text, obj, ly }, where ly is the number the text rounds.
const fact = (id, leg, text, card = id) => Object.freeze({ id, leg, text, card, obj: null, ly: null });
const far = (id, leg, text, obj, ly) => Object.freeze({ id, leg, text, card: null, obj, ly });

export const FACTS = Object.freeze([
  // THE WEB
  fact('any-galaxy', 'web', 'Each point here is a galaxy, most with billions of stars.'),
  fact('filament', 'web', 'Galaxies gather in long filaments round huge empty voids. Clusters sit where filaments meet.'),
  fact('void', 'web', 'A void is a huge region between filaments with very few galaxies.'),
  fact('node0', 'web', 'A cluster where filaments meet. Thousands like it have only catalogue numbers.'),
  fact('galaxy-flow', 'web', 'Gas flows down the filaments and feeds the galaxies growing where filaments cross.'),
  fact('sloan-wall', 'web', 'About 1.37 billion light-years long, found in 2003. It may be three structures lined up '
    + 'by chance.'),
  fact('far-coma', 'web', 'The Coma Cluster: over 1,000 galaxies, with two giant ellipticals at its heart.'),
  // COMA
  fact('coma', 'coma', 'Over 1,000 galaxies, 323 million light-years from Earth.'),
  fact('coma-giants', 'coma', 'Coma has two giant galaxies at its heart, NGC 4874 and NGC 4889.'),
  fact('ngc4889', 'coma', 'Probably the largest galaxy within 326 million light-years of us. Its black hole is about '
    + '21 billion Suns.'),
  fact('ngc4911', 'coma', 'A warped spiral deep inside Coma, with a ring of new stars round its core. Spirals rarely '
    + 'live this deep.'),
  fact('fast-traffic', 'coma', 'In 1933 Zwicky found these galaxies move too fast for the mass we can see. He called '
    + 'the rest dark matter.'),
  fact('hot-gas', 'coma', 'Gas at about 100 million degrees fills the cluster. It glows in X-rays and holds more mass '
    + 'than all the stars.'),
  fact('udg', 'coma', 'Ultra-diffuse galaxies are as wide as the Milky Way, with about 1% of its stars.'),
  fact('d100', 'coma', 'It is losing its gas into a long tail as it falls through the cluster. Its tail is drawn '
    + 'longer here.'),
  fact('dark-matter', 'coma', 'About 90% of Coma\'s mass is thought to be dark matter.'),
  fact('coma-speeds', 'coma', 'Coma\'s galaxies rush about at roughly 1,000 km/s.'),
  fact('cfa2-wall', 'coma', 'A wall of galaxies at least 500 million light-years long. It holds Coma, Leo and '
    + 'Hercules.'),
  // VIRGO
  fact('virgo', 'virgo', '1,300 to 2,000 galaxies, 54 million light-years away. Its pull slows our escape by about '
    + '10%.'),
  fact('m87', 'virgo', 'A giant elliptical, 132,000 light-years across, with about 12,000 globular clusters.'),
  fact('m87bh', 'virgo', '6.5 billion Suns. The first black hole ever pictured, published on 10 April 2019.'),
  fact('jet', 'virgo', 'Up to 5,000 light-years long. Its blobs seem to move faster than light. They come at us near '
    + 'light speed instead.'),
  fact('hst1', 'virgo', 'A knot about 200 light-years out. Its X-rays rose 50 times in four years, to 2006.'),
  fact('curtis-ray', 'virgo', 'In 1918 Heber Curtis saw \'a curious straight ray\' coming out of M87.'),
  fact('chain', 'virgo', 'A curved line of galaxies. At least seven of them move together.'),
  fact('eyes', 'virgo', 'NGC 4435 and NGC 4438, a pair in the chain, are called the Eyes.'),
  fact('intracluster', 'virgo', 'Up to 10% of Virgo\'s stars drift between the galaxies.'),
  fact('messier-list', 'virgo', 'Charles Messier listed these smudges so comet hunters would not mistake them for '
    + 'comets.'),
  fact('gravity-assist', 'virgo', 'Spacecraft steal speed from planets by swinging past them: a gravity assist.'),
  // THE LOCAL GROUP onward: distances from objects.js
  far('andromeda-far', 'local', 'Andromeda is 2.5 million light-years from home, the nearest big spiral.',
    'andromeda', 2.495e6),
  far('triangulum-far', 'local', 'Triangulum is 2.9 million light-years out, the third spiral of the Local Group.',
    'triangulum', 2.880e6),
  far('lmc-far', 'milkyway', 'The Large Magellanic Cloud circles the Milky Way 163,000 light-years from home.', 'lmc',
    1.630e5),
  far('centre-far', 'milkyway', 'The Galactic Centre is 27,000 light-years from home. A black hole of 4.3 million '
    + 'Suns sits there.', 'galactic-centre', 2.700e4),
  far('orion-far', 'orion', 'The Orion Nebula is 1,270 light-years away: a nursery of new stars.', 'orion-nebula',
    1269),
  far('betelgeuse-far', 'orion', 'Betelgeuse is 548 light-years away, a red supergiant 700 times wider than the Sun.',
    'betelgeuse', 548),
  far('pleiades-far', 'neighbours', 'The Pleiades are 444 light-years away and about 125 million years old.',
    'pleiades', 444.2),
  far('alpha-cen-far', 'neighbours', 'Alpha Centauri is 4.3 light-years away: the nearest stars to the Sun.',
    'alpha-centauri', 4.342),
  far('saturn-far', 'earth', 'Saturn is about 70 light-minutes from Earth today. Its rings have real gaps.', 'saturn',
    1.336e-4),
]);
export const FACT = Object.freeze(Object.fromEntries(FACTS.map((f) => [f.id, f])));

// The fact lines for a leg, in order.
export const factsFor = (leg) => FACTS.filter((f) => f.leg === leg);

// A distance as the game says it: "1,000 MLY", "54 MLY", "2.5 MLY", "27,000 LY", "4.3 LY", "8 LIGHT-MINUTES", "HOME".
export function lyText(ly) {
  if (!(ly > 0)) return 'HOME';
  const group = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (ly >= 1e7) return `${group(ly / 1e6)} MLY`;
  if (ly >= 1e6) return `${(Math.round(ly / 1e5) / 10)} MLY`;
  if (ly >= 100) return `${group(ly)} LY`;
  if (ly >= 0.1) return `${Math.round(ly * 10) / 10} LY`;
  const min = ly * 525960;
  return min >= 1 ? `${Math.round(min)} LIGHT-MINUTES` : `${Math.max(1, Math.round(min * 60))} LIGHT-SECONDS`;
}
