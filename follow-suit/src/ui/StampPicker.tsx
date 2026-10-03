import { useState } from 'react';
import {
  applyStamp,
  cardLabel,
  STAMPS,
  SUITS,
  stampUse,
  type Card,
  type StampId,
  type StampUse,
  type Suit,
} from '../engine';
import { DeckGrid } from './DeckView';
import { Sheet } from './Sheet';
import { SuitButtons } from './SuitPicker';

interface StampPickerProps {
  stamp: StampId;
  deck: readonly Card[];
  nextCardId: number;
  price: number;
  onConfirm: (use: StampUse) => void;
  onCancel: () => void;
}

function nextStep(stamp: StampId, picked: number, suit: Suit | null): string {
  switch (stamp) {
    case 'suit':
      if (picked === 0) return 'Pick the card to change.';
      return suit === null ? 'Pick its new suit.' : 'Ready.';
    case 'copy':
      if (picked === 0) return 'Pick the card whose rank to copy.';
      return picked === 1 ? 'Pick the card that takes that rank.' : 'Ready.';
    case 'eight':
      return suit === null ? 'Pick the suit of the new 8.' : 'Ready.';
    case 'burn':
      return picked === 0 ? 'Pick the card to remove.' : 'Ready.';
  }
}

/** What the stamp will do, read from the engine's own result. */
function describe(deck: readonly Card[], nextCardId: number, use: StampUse): string {
  const after = applyStamp(deck, nextCardId, use).deck;
  const label = (cards: readonly Card[], id: string) => cardLabel(cards.find((c) => c.id === id)!);
  switch (use.id) {
    case 'suit':
      return `${label(deck, use.cardId)} becomes ${label(after, use.cardId)}.`;
    case 'copy':
      return `${label(deck, use.toId)} becomes ${label(after, use.toId)}.`;
    case 'eight':
      return `Adds a new ${cardLabel(after[after.length - 1])}. The deck goes to ${after.length} cards.`;
    case 'burn':
      return `Removes ${label(deck, use.cardId)}. The deck goes to ${after.length} cards.`;
  }
}

/** The deck picker for a stamp. The player pays only on Use. */
export function StampPicker({ stamp, deck, nextCardId, price, onConfirm, onCancel }: StampPickerProps) {
  const def = STAMPS[stamp];
  const [picked, setPicked] = useState<string[]>([]);
  const [suit, setSuit] = useState<Suit | null>(null);
  const use = stampUse(stamp, picked, suit);

  function pick(card: Card) {
    setPicked((current) => {
      if (current.includes(card.id)) return current.filter((id) => id !== card.id);
      if (current.length < def.cards) return [...current, card.id];
      return [...current.slice(0, def.cards - 1), card.id];
    });
  }

  return (
    <Sheet title={def.name} onClose={onCancel} className="tall" testId="stamp-picker">
      <p className="sheet-note">{def.text}</p>
      <p className="stamp-step" role="status" data-testid="stamp-step">
        {nextStep(stamp, picked.length, suit)}
      </p>
      {def.suit && <SuitButtons options={SUITS} chosen={suit} onPick={setSuit} />}
      {def.cards > 0 && (
        <div className="sheet-scroll">
          <DeckGrid cards={deck} onPick={pick} pickedIds={picked} />
        </div>
      )}
      <p className="stamp-preview" data-testid="stamp-preview">
        {use ? describe(deck, nextCardId, use) : ' '}
      </p>
      <div className="sheet-actions">
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="btn primary" disabled={use === null} onClick={() => use && onConfirm(use)}>
          Use for ${price}
        </button>
      </div>
    </Sheet>
  );
}
