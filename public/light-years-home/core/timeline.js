// Light Years Home: Earth's clock. You travel at a hair under light speed, so Earth's date is today minus the route
// still ahead, in years. This file turns that into HUD text, finds the "On Earth" cards a stretch of flight passes,
// works out which year's radio reaches you in chapter IV, and writes the arrival date. today is injected (tests pin
// it); nothing here reads the clock.
import { fmt, fracOf, decimalYear, daysInMonth, groupDigits, REF_FRAC } from './physics.js';
import { MILESTONES } from './milestones.js';

export const RADIO_START = 1895;               // no radio from Earth before this year: silence
export const REF_TODAY = Object.freeze({ y: 2026, m: 10, d: 13 });

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October',
  'November', 'December'];

// Day of the week for a Gregorian date, 0 = Sunday (Sakamoto's method).
export function weekdayOf(y, m, d) {
  const t = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
  const yy = m < 3 ? y - 1 : y;
  return (((yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) + t[m - 1] + d) % 7) + 7) % 7;
}

// Date parts → { y, m, d, weekday, frac }. Takes { y, m, d } (month 1-12), { year, month, day }, 'YYYY-MM-DD', or a
// Date-like object with getFullYear/getMonth/getDate. Anything invalid gives 13 October 2026.
export function todayFrom(parts) {
  let y, m, d;
  if (typeof parts === 'string') {
    const k = /^(\d{4})-(\d{2})-(\d{2})/.exec(parts);
    if (k) [y, m, d] = [Number(k[1]), Number(k[2]), Number(k[3])];
  } else if (parts && typeof parts.getFullYear === 'function') {
    try { [y, m, d] = [parts.getFullYear(), parts.getMonth() + 1, parts.getDate()]; } catch { /* invalid */ }
  } else if (parts && typeof parts === 'object') {
    [y, m, d] = [parts.y ?? parts.year, parts.m ?? parts.month, parts.d ?? parts.day];
  }
  const ok = Number.isInteger(y) && y >= 1 && y <= 9999 && Number.isInteger(m) && m >= 1 && m <= 12
    && Number.isInteger(d) && d >= 1 && d <= daysInMonth(y, m);
  if (!ok) [y, m, d] = [REF_TODAY.y, REF_TODAY.m, REF_TODAY.d];
  return { y, m, d, weekday: weekdayOf(y, m, d), frac: decimalYear(y, m, d) };
}

// Years before today on Earth, given the route light-years still ahead (equal, at a hair under light speed).
export function earthYearsAgo(aheadLy) {
  return Number.isFinite(aheadLy) && aheadLy > 0 ? aheadLy : 0;
}

// Earth's date as a decimal year.
export function earthYear(today, aheadLy) {
  return fracOf(today) - earthYearsAgo(aheadLy);
}

// HUD text for Earth's date: '1.22 BILLION YEARS AGO' ... '8020 BC' ... '1969' ... 'TODAY'.
export function earthDateText(aheadLy, today, opts) {
  return fmt.earthDate(earthYearsAgo(aheadLy), today, opts);
}

// A milestone's years before today: calendar beats are counted from the given today.
export function milestoneAgo(m, today) {
  return Number.isFinite(m.year) && today !== undefined ? fracOf(today) - m.year : m.yearsAgo;
}

// Milestones whose date falls in [later, earlier): the ones Earth's date passes while the years-ago count falls from
// aAgo to bAgo. Called tick by tick, each milestone comes back exactly once. Oldest first.
export function milestonesBetween(aAgo, bAgo, today) {
  const hi = Math.max(aAgo, bAgo), lo = Math.min(aAgo, bAgo);
  if (!(hi > lo)) return [];
  return MILESTONES
    .map((m) => ({ m, ago: milestoneAgo(m, today) }))
    .filter(({ ago }) => ago >= lo && ago < hi)
    .sort((a, b) => b.ago - a.ago)
    .map(({ m }) => m);
}

// The card's date line: 'About 1.2 billion years before today', 'About 3200 BC', '1969'.
export function milestoneWhen(m, today) {
  const ago = milestoneAgo(m, today);
  let when;
  if (Number.isFinite(m.year)) {
    const y = Math.floor(m.year);
    when = y <= 0 ? `${1 - y} BC` : y < 1000 ? `${y} AD` : String(y);
  } else if (ago >= 1e9) {
    when = `${Number((ago / 1e9).toPrecision(3))} billion years before today`;
  } else if (ago >= 1e6) {
    when = `${Number((ago / 1e6).toPrecision(3))} million years before today`;
  } else {
    when = `${groupDigits(ago)} years before today`;
  }
  return m.about ? `About ${when}` : when[0].toUpperCase() + when.slice(1);
}

// Decimal year of the radio that reaches you: it left Earth r years before Earth's date at that moment.
export function signalYear(today, aheadLy, distFromEarthLy) {
  return earthYear(today, aheadLy) - Math.max(0, Number(distFromEarthLy) || 0);
}

// The calendar year of the radio you hear, or null before 1895 (silence).
export function heardYear(today, aheadLy, distFromEarthLy) {
  const y = Math.floor(signalYear(today, aheadLy, distFromEarthLy));
  return y >= RADIO_START ? y : null;
}

// Arrival words: { weekday: 'Tuesday', date: '13 October 2026', line: 'It is Tuesday, 13 October 2026.' }.
export function arrivalText(date) {
  const t = todayFrom(date);
  const weekday = WEEKDAYS[t.weekday];
  const text = `${t.d} ${MONTHS[t.m - 1]} ${t.y}`;
  return { weekday, date: text, line: `It is ${weekday}, ${text}.` };
}

export { REF_FRAC };
