// Light Years Home: Earth's history, shown as "On Earth" cards when the Earth date passes each one. 30 beats, oldest
// first. Deep-time beats give yearsAgo. Beats from the last 12,000 years give a calendar year (astronomical numbering:
// 0 is 1 BC, −3199 is 3200 BC), and their yearsAgo is counted from 13 October 2026; timeline.js recounts it from the
// real date. about: true where the date is uncertain. Each has a source. EARLIER holds older cards for Look Home.
import { REF_FRAC } from './physics.js';

const W = 'https://en.wikipedia.org/wiki/';

const DEEP = [
  { id: 'single-cells', yearsAgo: 1.2e9, about: true, text: 'Life is mostly single cells.', source: W + 'Mesoproterozoic' },
  { id: 'seaweed', yearsAgo: 1.047e9, about: true, text: 'The first seaweeds.', source: W + 'Bangiomorpha' },
  { id: 'snowball', yearsAgo: 717e6, text: 'Ice covers nearly the whole planet.', source: W + 'Sturtian_glaciation' },
  { id: 'cambrian', yearsAgo: 538.8e6, about: true, text: 'Animal life bursts out. Soon there are eyes and shells.',
    source: W + 'Cambrian_explosion' },
  { id: 'land-plants', yearsAgo: 470e6, about: true, text: 'The first plants grow on land.',
    source: W + 'Evolutionary_history_of_plants' },
  { id: 'tetrapods', yearsAgo: 375e6, about: true, text: 'A fish with leg-like fins crawls into the shallows.',
    source: W + 'Tiktaalik' },
  { id: 'great-dying', yearsAgo: 251.9e6, text: 'The Great Dying. Most kinds of sea life die out.',
    source: W + 'Permian%E2%80%93Triassic_extinction_event' },
  { id: 'dinosaurs', yearsAgo: 231e6, about: true, text: 'The first dinosaurs.', source: W + 'Eoraptor' },
  { id: 'flowers', yearsAgo: 130e6, about: true, text: 'The first flowers.', source: W + 'Flowering_plant' },
  { id: 'asteroid', yearsAgo: 66.04e6, text: 'An asteroid hits. The dinosaurs are gone, except the birds.',
    source: W + 'Cretaceous%E2%80%93Paleogene_extinction_event' },
  { id: 'chimps', yearsAgo: 7e6, about: true, text: 'Our line splits from the chimpanzees.',
    source: W + 'Chimpanzee%E2%80%93human_last_common_ancestor' },
  { id: 'laetoli', yearsAgo: 3.66e6, text: 'Someone walks upright across wet ash at Laetoli.', source: W + 'Laetoli' },
  { id: 'sapiens', yearsAgo: 300e3, about: true, text: 'Our species appears.', source: W + 'Jebel_Irhoud' },
  { id: 'out-of-africa', yearsAgo: 70e3, about: true, text: 'People walk out of Africa.',
    source: W + 'Recent_African_origin_of_modern_humans' },
  { id: 'cave-painting', yearsAgo: 40e3, about: true, text: 'People paint animals on cave walls.',
    source: W + 'Lubang_Jeriji_Sal%C3%A9h' },
];

const DATED = [
  { id: 'ice-age-ends', year: -9700, about: true, text: 'The ice age ends.', source: W + 'Holocene' },
  { id: 'farming', year: -9499, about: true, text: 'People start to farm.', source: W + 'Neolithic_Revolution' },
  { id: 'writing', year: -3199, about: true, text: 'People start to write.', source: W + 'History_of_writing' },
  { id: 'pyramid', year: -2559, about: true, text: 'The Great Pyramid is built.', source: W + 'Great_Pyramid_of_Giza' },
  { id: 'aristarchus', year: -269, about: true, text: 'Aristarchus says the Earth goes round the Sun.',
    source: W + 'Aristarchus_of_Samos' },
  { id: 'aryabhata', year: 499, text: 'Aryabhata writes that the Earth spins.', source: W + 'Aryabhata' },
  { id: 'sn1054', year: 1054.5, text: 'Astronomers in China see a new star blaze in Taurus.', source: W + 'SN_1054' },
  { id: 'copernicus', year: 1543.4, text: 'Copernicus puts the Sun at the centre.',
    source: W + 'De_revolutionibus_orbium_coelestium' },
  { id: 'radio', year: 1895.5, text: 'Marconi sends his first radio signals.', source: W + 'Guglielmo_Marconi' },
  { id: 'einstein', year: 1905.7, text: 'Einstein shows that moving clocks run slow.', source: W + 'Special_relativity' },
  { id: 'hubble', year: 1925.0, text: 'Hubble shows that Andromeda is another galaxy.', source: W + 'Edwin_Hubble' },
  { id: 'cmb', year: 1965.5, text: 'Two radio astronomers find the faint glow that heats your shield.',
    source: W + 'Discovery_of_cosmic_microwave_background_radiation' },
  { id: 'moon', year: 1969.55, text: 'People walk on the Moon.', source: W + 'Apollo_11' },
  { id: 'proxima', year: 2016.65, text: 'A planet is found around Proxima Centauri, where you are going.',
    source: W + 'Proxima_Centauri_b' },
  { id: 'jwst', year: 2022.53, text: 'A new space telescope sends its first deep pictures.',
    source: W + 'James_Webb_Space_Telescope' },
];

export const MILESTONES = Object.freeze([
  ...DEEP,
  ...DATED.map((m) => ({ ...m, yearsAgo: REF_FRAC - m.year })),
].map((m) => Object.freeze({ about: false, ...m })));

// Older than the trip home (it starts 1.07 billion years ago), so no jump passes them and they are never "On Earth"
// cards. Look Home shows them: the light that reaches the Wall left Earth about 2.07 billion years ago (final.md 7.7).
export const EARLIER = Object.freeze([
  { id: 'oxygen', yearsAgo: 2.3e9, about: true, text: 'Oxygen starts to build up in the air.',
    source: W + 'Great_Oxidation_Event' },
].map((m) => Object.freeze({ about: false, ...m })));

// Every card, oldest first: the ones before the trip, then the trip's own.
export const ALL_MILESTONES = Object.freeze([...EARLIER, ...MILESTONES]);

// A card by id from either list, or null.
export function milestoneById(id) {
  return ALL_MILESTONES.find((m) => m.id === id) || null;
}
