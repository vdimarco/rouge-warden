// js/story/look/quality.js : the quality tiers (design 3.7, amendments C1, C2, C6, C8).
// Q2 desktop, Q1 phone, Q0 low. S.q holds the tier; a change emits 'quality' on S.bus so WORLD (flora,
// tile LOD, grass), VEHICLES (traffic) and CAST (crowd, actor LOD) can follow. Gameplay never reads S.q
// (C2): attack tokens, mission traffic and every rule stay the same on every tier.
import * as THREE from 'three';
import { LITE } from '../../render.js';

const T = (o) => Object.freeze(o);
// view: how far the world draws, day and night (m); fog ends at or before it (C8)
// pr: the pixel-ratio range; msaa: scene samples; tris/draws: main-pass budgets
// shadow: half-size of the sun's shadow box (m), its map size, and the filter
// flora: density scale; grass: the camera patch radius (m, 0 = off); lodBias: tile LOD distance scale
// actors: full skinned actors; hull: outline hull distance (m); traffic/peds: ambient counts
// pano: the day panorama's width in pixels (C6)
export const QUALITY = Object.freeze([
  T({ q: 0, name: 'Q0 low', view: T({ day: 450, night: 160 }), pr: T([0.55, 1.0]), msaa: 0, tris: 150e3, draws: 100, actors: 4, hull: 12, traffic: 5, peds: 3,
    shadow: T({ box: 15, map: 1024, type: 'pcf' }), flora: 0.35, grass: 0, lodBias: 0.6, pano: 2048 }),
  T({ q: 1, name: 'Q1 phone', view: T({ day: 700, night: 220 }), pr: T([0.6, 1.25]), msaa: 2, tris: 220e3, draws: 130, actors: 6, hull: 12, traffic: 8, peds: 6,
    shadow: T({ box: 20, map: 1024, type: 'pcf' }), flora: 0.6, grass: 25, lodBias: 0.8, pano: 2048 }),
  T({ q: 2, name: 'Q2 desktop', view: T({ day: 1100, night: 300 }), pr: T([0.75, 1.5]), msaa: 4, tris: 450e3, draws: 200, actors: 10, hull: 25, traffic: 14, peds: 12,
    shadow: T({ box: 30, map: 2048, type: 'soft' }), flora: 1, grass: 55, lodBias: 1, pano: 3876 }),
]);
export const tierOf = (q) => QUALITY[Math.max(0, Math.min(2, Math.round(q) || 0))];

// the starting tier: ?q= wins; else a phone starts on Q1, and a weak phone (2 GB or less) on Q0
export function startTier() {
  const Q = new URLSearchParams(location.search);
  if (Q.has('q')) return Math.max(0, Math.min(2, Math.round(+Q.get('q')) || 0));
  if (!LITE) return 2;
  const mem = navigator.deviceMemory;
  return mem && mem <= 2 ? 0 : 1;
}
// what render.js setQuality() takes for a tier
export const renderOpts = (t) => ({ samples: t.msaa, prMin: t.pr[0], prMax: t.pr[1], shadowType: t.shadow.type === 'soft' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap });
