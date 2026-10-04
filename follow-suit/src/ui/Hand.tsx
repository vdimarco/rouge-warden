import type { Card } from '../engine';
import { CardFace } from './CardFace';
import { cardCode, cardName } from './text';

export type HandMode = 'build' | 'redraw';

interface HandProps {
  cards: readonly Card[];
  chainIds: ReadonlySet<string>;
  legalIds: ReadonlySet<string>;
  selectedIds: ReadonlySet<string>;
  mode: HandMode;
  shakeId: string | null;
  isWild: (card: Card) => boolean;
  onTap: (card: Card) => void;
  onShakeEnd: () => void;
}

export function Hand({ cards, chainIds, legalIds, selectedIds, mode, shakeId, isWild, onTap, onShakeEnd }: HandProps) {
  return (
    <div className={`hand mode-${mode}`} role="group" aria-label="Hand" data-testid="hand">
      {cards.map((card) => {
        if (chainIds.has(card.id)) {
          return <div key={card.id} className="slot-ghost" aria-hidden="true" />;
        }
        const selected = selectedIds.has(card.id);
        const legal = legalIds.has(card.id);
        const classes = ['card-btn'];
        if (mode === 'redraw') classes.push(selected ? 'selected' : 'selectable');
        else classes.push(legal ? 'raised' : 'dimmed');
        if (shakeId === card.id) classes.push('shake');
        return (
          <button
            key={card.id}
            type="button"
            className={classes.join(' ')}
            data-card={cardCode(card)}
            data-id={card.id}
            data-legal={legal}
            aria-label={cardName(card)}
            aria-pressed={mode === 'redraw' ? selected : undefined}
            aria-disabled={mode === 'build' && !legal ? true : undefined}
            onClick={() => onTap(card)}
            onAnimationEnd={onShakeEnd}
          >
            <CardFace card={card} wild={isWild(card)} />
            {selected && (
              <span className="pick-mark" aria-hidden="true">
                ✓
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
