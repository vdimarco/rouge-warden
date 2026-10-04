import { SUIT_NAMES, SUIT_SYMBOLS, SUITS, sortCards, suitColor, type Card } from '../engine';
import { MiniCard } from './CardFace';
import { Sheet } from './Sheet';
import { cardCode, cardName } from './text';

interface DeckGridProps {
  cards: readonly Card[];
  /** When set, each card is a button that calls it. */
  onPick?: (card: Card) => void;
  pickedIds?: readonly string[];
}

/** Every card, grouped by suit and sorted by rank. */
export function DeckGrid({ cards, onPick, pickedIds = [] }: DeckGridProps) {
  return (
    <div className="deck-grid">
      {SUITS.map((suit) => {
        const group = sortCards(cards.filter((card) => card.suit === suit));
        return (
          <section key={suit} className="deck-suit" aria-label={`${SUIT_NAMES[suit]}, ${group.length} cards`}>
            <h3 className="deck-suit-head">
              <span className={suitColor(suit)} aria-hidden="true">
                {SUIT_SYMBOLS[suit]}
              </span>{' '}
              {SUIT_NAMES[suit]} <span className="deck-count">{group.length}</span>
            </h3>
            <div className="deck-row">
              {group.map((card) =>
                onPick ? (
                  <button
                    key={card.id}
                    type="button"
                    className={`deck-card${pickedIds.includes(card.id) ? ' picked' : ''}`}
                    data-card={cardCode(card)}
                    data-id={card.id}
                    aria-label={cardName(card)}
                    aria-pressed={pickedIds.includes(card.id)}
                    onClick={() => onPick(card)}
                  >
                    <MiniCard card={card} />
                  </button>
                ) : (
                  <span key={card.id} className="deck-card" data-card={cardCode(card)} data-id={card.id}>
                    <MiniCard card={card} />
                  </span>
                ),
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/** Every card in the run deck. Opens from the table screen and the shop. */
export function DeckView({ cards, onClose }: { cards: readonly Card[]; onClose: () => void }) {
  return (
    <Sheet title={`Deck: ${cards.length} cards`} onClose={onClose} className="tall" testId="deck-view">
      <div className="sheet-scroll">
        <DeckGrid cards={cards} />
      </div>
      <button type="button" className="btn wide sheet-cancel" onClick={onClose}>
        Close
      </button>
    </Sheet>
  );
}
