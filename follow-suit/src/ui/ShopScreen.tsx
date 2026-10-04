import { useState } from 'react';
import {
  buyCharm,
  buyStamp,
  charmBuyStatus,
  CHARMS,
  isHostTable,
  moveCharm,
  reroll,
  rerollCost,
  sellCharm,
  sellPrice,
  stampBuyStatus,
  STAMPS,
  type BuyStatus,
  type RunState,
  type ShopOffer,
  type SlotId,
  type Suit,
} from '../engine';
import { CharmBoard, CharmDetails, slotName } from './CharmBoard';
import { DeckView } from './DeckView';
import { StampPicker } from './StampPicker';

interface ShopScreenProps {
  run: RunState;
  onChange: (next: RunState) => void;
  onLeave: () => void;
}

const WHY: Record<Exclude<BuyStatus, 'ok'>, string> = {
  sold: 'Sold.',
  money: 'Not enough money.',
  slot: 'Sell the charm in that slot first.',
  deck: 'The deck is at its smallest size.',
};

const isSuit = (slot: SlotId): slot is Suit => slot !== 'table';

export function ShopScreen({ run, onChange, onLeave }: ShopScreenProps) {
  const shop = run.shop!;
  const [selected, setSelected] = useState<SlotId | null>(null);
  const [stampOffer, setStampOffer] = useState<number | null>(null);
  const [deckOpen, setDeckOpen] = useState(false);
  const cost = rerollCost(shop.rerolls);
  const picked = selected === null ? null : run.charms[selected];

  function tapSlot(slot: SlotId) {
    if (selected !== null && selected !== slot && isSuit(selected) && isSuit(slot) && run.charms[selected] !== null) {
      onChange(moveCharm(run, selected, slot));
      setSelected(null);
      return;
    }
    setSelected(selected === slot ? null : slot);
  }

  function sell(slot: SlotId) {
    onChange(sellCharm(run, slot));
    setSelected(null);
  }

  function offerTile(offer: ShopOffer, index: number) {
    const status = offer.kind === 'charm' ? charmBuyStatus(run, index) : stampBuyStatus(run, index);
    const def = offer.kind === 'charm' ? CHARMS[offer.id] : STAMPS[offer.id];
    const meta =
      offer.kind === 'charm'
        ? `${CHARMS[offer.id].slot === 'table' ? 'Table' : 'Suit'} charm · ${CHARMS[offer.id].rarity}`
        : 'Stamp · use at once';
    const verb = offer.kind === 'charm' ? 'Buy' : 'Use';
    return (
      <article
        key={`${offer.kind}-${offer.id}`}
        className={`offer ${offer.kind}${offer.sold ? ' sold' : ''}`}
        data-offer={offer.id}
        data-status={status}
      >
        <h3 className="offer-name">{def.name}</h3>
        <p className="offer-meta">{meta}</p>
        <p className="offer-text">{def.text}</p>
        {status !== 'ok' && status !== 'sold' && <p className="offer-why">{WHY[status]}</p>}
        <button
          type="button"
          className="btn buy"
          disabled={status !== 'ok'}
          onClick={() => (offer.kind === 'charm' ? onChange(buyCharm(run, index)) : setStampOffer(index))}
        >
          {offer.sold ? 'Sold' : `${verb} $${offer.price}`}
        </button>
      </article>
    );
  }

  const stamp = stampOffer === null ? null : shop.offers[stampOffer];

  return (
    <div className="screen shop-screen" data-testid="shop">
      <header className="shop-head">
        <div className="where-block">
          <h1 className="shop-title">Shop</h1>
          <span className="seed">
            Stop {run.stop} · Seed {run.seed}
          </span>
        </div>
        <span className="money" data-testid="money" aria-label={`${run.money} dollars`}>
          ${run.money}
        </span>
        <button type="button" className="icon-btn deck-btn" onClick={() => setDeckOpen(true)} aria-label={`Deck, ${run.deck.length} cards`}>
          Deck <b>{run.deck.length}</b>
        </button>
      </header>

      <div className="shop-body">
        {run.lastPayout && <p className="payout-line">The last table paid ${run.lastPayout.total}.</p>}

        <section className="shop-section" aria-label="Your charms">
          <h2 className="section-title">Your charms</h2>
          <CharmBoard charms={run.charms} selected={selected} onTap={tapSlot} />
          {selected !== null && (
            <div className="slot-details" data-testid="slot-details">
              <h3 className="offer-name">{picked ? CHARMS[picked.id].name : `Empty ${slotName(selected)} slot`}</h3>
              <CharmDetails slot={selected} charm={picked} />
              {picked && isSuit(selected) && <p className="hint">Tap another suit slot to move it there.</p>}
              <div className="row-actions">
                {picked && (
                  <button type="button" className="btn" onClick={() => sell(selected)}>
                    Sell for ${sellPrice(picked.id)}
                  </button>
                )}
                <button type="button" className="btn" onClick={() => setSelected(null)}>
                  Done
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="shop-section" aria-label="For sale">
          <h2 className="section-title">For sale</h2>
          <div className="offer-grid">{shop.offers.map(offerTile)}</div>
        </section>
      </div>

      <div className="actions shop-actions">
        <button type="button" className="btn" disabled={run.money < cost} onClick={() => onChange(reroll(run))}>
          Reroll ${cost}
        </button>
        <button type="button" className="btn primary" onClick={onLeave}>
          {isHostTable(run.tableIndex) ? `Go to stop ${run.stop + 1}` : 'Next table'}
        </button>
      </div>

      {stamp !== null && stamp.kind === 'stamp' && (
        <StampPicker
          stamp={stamp.id}
          deck={run.deck}
          nextCardId={run.nextCardId}
          price={stamp.price}
          onConfirm={(use) => {
            onChange(buyStamp(run, stampOffer!, use));
            setStampOffer(null);
          }}
          onCancel={() => setStampOffer(null)}
        />
      )}
      {deckOpen && <DeckView cards={run.deck} onClose={() => setDeckOpen(false)} />}
    </div>
  );
}
