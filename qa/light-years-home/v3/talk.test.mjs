// Light Years Home v3: the radio queue (final.md 18.1, 2.7).
// Owner: WP4. WP0 wrote this skeleton: turn each todo into a real check.
// node qa/light-years-home/v3/talk.test.mjs
import test from 'node:test';

test.todo('a scripted 120 s run never shows two lines less than 8 s apart (except the pre-roll)');
test.todo('no line within 2 s of a gate, hit or takedown');
test.todo('priority order: mission, Dot, Redshift');
test.todo('lines waiting over 6 s are dropped');
test.todo('a skip sends the line to the log');
