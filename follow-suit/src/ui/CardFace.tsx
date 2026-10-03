import { cardColor, isFaceCard, rankLabel, SUIT_SYMBOLS, suitColor, type ChainLink, type Card } from '../engine';

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
  link: ChainLink;
  /** True when the card named a suit. The badge shows that suit. */
  named: boolean;
}

/** A small card for the chain, with a badge for the suit that an 8 named. */
export function MiniCard({ link, named }: MiniCardProps) {
  const { card, suit } = link;
  return (
    <span className={`mini ${cardColor(card)}`}>
      <span className="r">{rankLabel(card.rank)}</span>
      <span className="s">{SUIT_SYMBOLS[card.suit]}</span>
      {named && <span className={`badge ${suitColor(suit)}`}>{SUIT_SYMBOLS[suit]}</span>}
    </span>
  );
}
