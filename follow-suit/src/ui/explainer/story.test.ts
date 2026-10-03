import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../config';
import { canFollow, cardPoints, isRing, scoreChain, SUIT_SYMBOLS } from '../../engine';
import {
  BUILD,
  FOLLOW,
  RING,
  RING_CHAIN,
  SCENES,
  SCORE_BEATS,
  SCORE_BEFORE_RING,
  TARGET,
  WILD,
  viaLabel,
} from './story';

describe('the explainer story', () => {
  it('has the 7 scenes in order, with the lengths from the config', () => {
    expect(SCENES.map((scene) => scene.title)).toEqual([
      'Build a chain',
      'Follow by suit or by rank',
      '8s are wild',
      'Value and Mult',
      'Close a ring',
      'Beat the target',
      'Win the run',
    ]);
    expect(SCENES.map((scene) => scene.ms)).toEqual([...CONFIG.explainer.sceneMs]);
  });

  it('builds its first chain by the rules', () => {
    expect(BUILD.chain.map((link) => link.card.rank)).toEqual([7, 13, 13]);
    expect(BUILD.hand).toHaveLength(5);
  });

  it('shows one card that follows by suit, one that does not match, and one that follows by rank', () => {
    expect(FOLLOW.tries.map((attempt) => attempt.via)).toEqual(['suit', null, 'rank']);
    expect(FOLLOW.tries.map((attempt) => viaLabel(attempt))).toEqual([`Same suit ${SUIT_SYMBOLS.S}`, 'No match', 'Same rank K']);
    const [, miss] = FOLLOW.tries;
    expect(canFollow(miss.chain, miss.card)).toBe(false);
  });

  it('plays a wild 8 that names diamonds, and then a diamond follows', () => {
    expect(WILD.chain[3]).toMatchObject({ via: 'eight', suit: 'D' });
    expect(WILD.chain[4]).toMatchObject({ via: 'suit', suit: 'D' });
    expect(canFollow(WILD.chain.slice(0, 4), WILD.misfit)).toBe(false);
  });

  it('scores the ring chain as the game does: Value 45, Mult 4, then 8 with the ring, and 360', () => {
    expect(RING_CHAIN.map((link) => cardPoints(link.card))).toEqual([6, 6, 7, 7, 8, 11]);
    expect(isRing(RING_CHAIN)).toBe(true);
    expect(SCORE_BEFORE_RING).toMatchObject({ value: 45, mult: 4 });
    expect(RING).toEqual(scoreChain(RING_CHAIN));
    expect(RING).toMatchObject({ value: 45, mult: 8, score: 360, switches: 3, ring: true });
    expect(TARGET).toBe(150);
  });

  it('times the scoring beats inside the scene, with one note for each change of suit', () => {
    const notes = SCORE_BEATS.filter((beat) => beat.note !== null).map((beat) => beat.note);
    expect(notes).toEqual([0, 1, 2]);
    const last = SCORE_BEATS[SCORE_BEATS.length - 1];
    expect(last.at).toBeLessThan(SCENES[3].ms - 1_500);
    expect(SCORE_BEATS[SCORE_BEATS.length - 1].step).toMatchObject({ value: 45, mult: 4 });
  });
});
