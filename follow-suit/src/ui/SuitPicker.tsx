import { SUIT_NAMES, SUIT_SYMBOLS, SUITS, suitColor, type Card, type Suit } from '../engine';
import { Sheet } from './Sheet';
import { cardName } from './text';

interface SuitButtonsProps {
  options: readonly Suit[];
  chosen?: Suit | null;
  onPick: (suit: Suit) => void;
}

/** 4 large suit buttons. Suits outside `options` are disabled. */
export function SuitButtons({ options, chosen = null, onPick }: SuitButtonsProps) {
  return (
    <div className="suit-grid">
      {SUITS.map((suit) => (
        <button
          key={suit}
          type="button"
          className={`suit-btn ${suitColor(suit)}${chosen === suit ? ' chosen' : ''}`}
          disabled={!options.includes(suit)}
          aria-pressed={chosen === null ? undefined : chosen === suit}
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
  );
}

interface SuitPickerProps {
  card: Card;
  options: readonly Suit[];
  onPick: (suit: Suit) => void;
  onCancel: () => void;
}

/** The sheet that opens when the player adds an 8. */
export function SuitPicker({ card, options, onPick, onCancel }: SuitPickerProps) {
  return (
    <Sheet title={`Name a suit for the ${cardName(card)}`} onClose={onCancel} testId="suit-picker">
      {options.length === 1 && <p className="sheet-note">This host allows only the current suit.</p>}
      <SuitButtons options={options} onPick={onPick} />
      <button type="button" className="btn wide sheet-cancel" onClick={onCancel}>
        Cancel
      </button>
    </Sheet>
  );
}
