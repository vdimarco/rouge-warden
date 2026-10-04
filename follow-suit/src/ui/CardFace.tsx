import { cardColor, isFaceCard, rankLabel, SUIT_SYMBOLS, suitColor, type Card, type Suit } from '../engine';

interface CardFaceProps {
  card: Card;
  /** Wild cards get a gold inner frame. */
  wild?: boolean;
}

/** A full card, drawn with CSS. It fills its parent. */
export function CardFace({ card, wild = false }: CardFaceProps) {
  const rank = rankLabel(card.rank);
  const suit = SUIT_SYMBOLS[card.suit];
  return (
    <span className={`face ${cardColor(card)}${wild ? ' wild' : ''}`} aria-hidden="true">
      <span className="corner">
        <span className="r">{rank}</span>
        <span className="s">{suit}</span>
      </span>
      <span className="pip">
        {isFaceCard(card) ? (
          <span className="court">
            {rank}
            <span className="court-suit">{suit}</span>
          </span>
        ) : (
          suit
        )}
      </span>
      <span className="corner bottom">
        <span className="r">{rank}</span>
        <span className="s">{suit}</span>
      </span>
    </span>
  );
}

interface MiniCardProps {
  card: Card;
  /** The suit an 8 named. The badge shows it. */
  named?: Suit | null;
}

/** A small card for the chain, the deck view and the stamp picker. */
export function MiniCard({ card, named = null }: MiniCardProps) {
  return (
    <span className={`mini ${cardColor(card)}`}>
      <span className="r">{rankLabel(card.rank)}</span>
      <span className="s">{SUIT_SYMBOLS[card.suit]}</span>
      {named !== null && <span className={`badge ${suitColor(named)}`}>{SUIT_SYMBOLS[named]}</span>}
    </span>
  );
}
