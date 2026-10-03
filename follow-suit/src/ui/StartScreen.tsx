import { useState } from 'react';
import { normalizeSeed } from '../engine';
import { ArcadeLinks } from './ArcadeLinks';
import { randomSeed } from './seed';

/** New run, or a run from a seed. */
export function StartScreen({ onStart }: { onStart: (seed: string) => void }) {
  const [text, setText] = useState('');
  const seed = normalizeSeed(text);

  return (
    <div className="screen start-screen" data-testid="start">
      <div className="start-body">
        <h1 className="title">Follow Suit</h1>
        <p className="lead">Build chains of cards. Each card must follow the card before it.</p>
        <ul className="rules">
          <li>Match the last card&rsquo;s suit or its rank. An 8 is wild and names the next suit.</li>
          <li>Each change of suit adds 1 Mult.</li>
          <li>A chain of 4 or more cards that ends on its first card&rsquo;s suit or rank closes a ring, which doubles Mult.</li>
          <li>A chain scores Value times Mult. Reach the target within 3 chains.</li>
          <li>Clear 8 stops of 3 tables to win. Spend your money on charms and stamps between tables.</li>
        </ul>
      </div>
      <div className="start-actions">
        <button type="button" className="btn primary wide" onClick={() => onStart(randomSeed())}>
          New run
        </button>
        <form
          className="seed-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (seed !== '') onStart(seed);
          }}
        >
          <label htmlFor="seed-input" className="seed-label">
            Seed
          </label>
          <input
            id="seed-input"
            className="seed-input"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="K7QX2M"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            maxLength={24}
          />
          <button type="submit" className="btn" disabled={seed === ''}>
            Play seed
          </button>
        </form>
        <ArcadeLinks />
      </div>
    </div>
  );
}
