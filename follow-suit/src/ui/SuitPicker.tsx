import { useEffect, useRef } from 'react';
import { SUIT_NAMES, SUIT_SYMBOLS, SUITS, suitColor, type Card, type Suit } from '../engine';
import { cardName } from './text';

interface SuitPickerProps {
  card: Card;
  options: readonly Suit[];
  onPick: (suit: Suit) => void;
  onCancel: () => void;
}

/** The 4 suit buttons that open when the player adds an 8. */
export function SuitPicker({ card, options, onPick, onCancel }: SuitPickerProps) {
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => first.current?.focus(), []);

  return (
    <div className="sheet-backdrop" onClick={onCancel}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="suit-picker-title"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.key === 'Escape' && onCancel()}
      >
        <h2 id="suit-picker-title" className="sheet-title">
          Name a suit for the {cardName(card)}
        </h2>
        <div className="suit-grid">
          {SUITS.map((suit, i) => (
            <button
              key={suit}
              ref={i === 0 ? first : undefined}
              type="button"
              className={`suit-btn ${suitColor(suit)}`}
              disabled={!options.includes(suit)}
              data-suit={suit}
              onClick={() => onPick(suit)}
            >
              <span className="suit-glyph" aria-hidden="true">
                {SUIT_SYMBOLS[suit]}
              </span>
              <span className="suit-name">{SUIT_NAMES[suit]}</span>
            </button>
          ))}
        </div>
        <button type="button" className="btn sheet-cancel" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
