// Crisp silhouettes stay readable inside the thumb controls at phone size.
const glyphs = {
 wings:'M20 26C4 30 3 11 5 9l12 8 3-10 3 10 12-8c2 2 1 21-15 17Zm0-2v10',
 feathers:'m8 30 11-22 4 3-10 22m6-6L29 8l4 5-10 20M4 22l9 1m2-8 8 1m2 5 9 1',
 eye:'M3 20q17-20 34 0-17 20-34 0Zm17-6a6 6 0 1 0 0 12 6 6 0 1 0 0-12M20 4v5m0 22v5',
 eclipse:'M28 7a14 14 0 1 0 0 26A17 17 0 0 1 28 7ZM6 6l3 3m22-3-3 3M3 19h5m24 0h5',
 wave:'M4 28q6-9 13-2c-6-15 8-24 15-13-14-3-8 12 4 16M4 34q7-6 14-1t18-1',
 whirlpool:'M34 19c0-19-30-16-30 2 0 17 25 17 26 3 1-13-20-15-20-3 0 9 14 9 14 0m-8 2 5-5 4 5',
 tail:'M6 29q19 8 20-9Q23 6 34 4q-3 10 2 16-4 19-30 14Zm3-8 8 1M5 15l9 3',
 maelstrom:'M5 18q1-16 24-11l-3-4m8 13q7 23-17 20l4 3M6 27q-9-18 13-15m11 17q-19 12-17-9 2-10 11-5m-3 3-6 5 7 3',
 hut:'m5 17 15-12 15 12M9 16v16h23V16M16 32v-9h8v9M11 32l-4 5m20-5 6 5',
 snare:'M5 29q0-13 15-13t15 13M7 29h26m-22 0-3 7m12-7v8m9-8 4 7M20 16V5m-6 7 6-7 6 7',
 mortar:'M6 23h28q-1 14-14 14T6 23Zm4 0-3-7h26l-3 7M13 11q-6-6 1-8m8 8q-6-6 1-8m8 8q-6-6 1-8',
 ritual:'M9 8v16l-4 9h11l4-12 4 12h11l-4-9V8M4 36h32M15 7l5-4 5 4',
 horns:'M9 4q-5 16 11 24Q36 20 31 4l-7 10h-8L9 4Zm11 24v10m-7-6 7 6 7-6',
 shriek:'M17 12v16l-9-5v-6l9-5Zm7-3q13 11 0 22m6-26q17 15 0 30',
 claws:'m7 34 6-27 4 4-6 24m6-1 7-29 4 4-7 27m6 0 7-25 3 4-6 23',
 bloodmoon:'M28 5a15 15 0 1 0 4 27A18 18 0 0 1 28 5Zm-8 6q-12 15 0 15t0-15Z',
};
export const skillIcon = key => `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="${glyphs[key] || glyphs.eye}"/></svg>`;
