import {
  CHARMS,
  SLOT_IDS,
  SUIT_NAMES,
  SUIT_SYMBOLS,
  sellPrice,
  suitColor,
  type CharmSlots,
  type OwnedCharm,
  type SlotId,
} from '../engine';
import { Sheet } from './Sheet';

interface CharmBoardProps {
  charms: CharmSlots;
  /** The slot that is picked in the shop. */
  selected?: SlotId | null;
  /** Slots that light up for a moment, for example when a charm fires. */
  lit?: ReadonlySet<SlotId>;
  onTap: (slot: SlotId) => void;
}

export function slotName(slot: SlotId): string {
  return slot === 'table' ? 'table' : SUIT_NAMES[slot];
}

/** The 4 suit slots and the table slot. */
export function CharmBoard({ charms, selected = null, lit, onTap }: CharmBoardProps) {
  return (
    <div className="charm-board" role="group" aria-label="Charm slots">
      {SLOT_IDS.map((slot) => {
        const charm = charms[slot];
        const classes = ['slot', charm ? 'filled' : 'empty'];
        if (slot === 'table') classes.push('table-slot');
        if (selected === slot) classes.push('selected');
        if (lit?.has(slot)) classes.push('lit');
        return (
          <button
            key={slot}
            type="button"
            className={classes.join(' ')}
            data-slot={slot}
            aria-label={`${slotName(slot)} slot: ${charm ? CHARMS[charm.id].name : 'empty'}`}
            aria-pressed={selected === slot ? true : undefined}
            onClick={() => onTap(slot)}
          >
            <span className={`slot-head${slot === 'table' ? '' : ` ${suitColor(slot)}`}`} aria-hidden="true">
              {slot === 'table' ? 'Table' : SUIT_SYMBOLS[slot]}
            </span>
            <span className="slot-name">{charm ? CHARMS[charm.id].name : 'Empty'}</span>
            {charm?.id === 'spiral' && charm.stacks > 0 && <span className="slot-stacks">+{charm.stacks}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** What a charm does, with its slot and rarity. */
export function CharmDetails({ slot, charm }: { slot: SlotId; charm: OwnedCharm | null }) {
  if (charm === null) {
    return (
      <p className="charm-text">
        {slot === 'table' ? 'Buy table charms in the shop.' : `Buy suit charms in the shop. This one fires for ${SUIT_NAMES[slot]}.`}
      </p>
    );
  }
  const def = CHARMS[charm.id];
  return (
    <>
      <p className="charm-meta">
        {def.slot === 'table' ? 'Table charm' : `Suit charm for ${SUIT_NAMES[slot as keyof typeof SUIT_NAMES]}`} ·{' '}
        <span className={`rarity ${def.rarity}`}>{def.rarity}</span> · sells for ${sellPrice(charm.id)}
      </p>
      <p className="charm-text">{def.text}</p>
      {charm.id === 'spiral' && <p className="charm-text">Gained so far: +{charm.stacks} Mult.</p>}
    </>
  );
}

/** The sheet that opens when the player taps a slot on the table screen. */
export function CharmSheet({ slot, charm, onClose }: { slot: SlotId; charm: OwnedCharm | null; onClose: () => void }) {
  const title = charm ? CHARMS[charm.id].name : `Empty ${slotName(slot)} slot`;
  return (
    <Sheet title={title} onClose={onClose} testId="charm-sheet">
      <CharmDetails slot={slot} charm={charm} />
      <button type="button" className="btn wide sheet-cancel" onClick={onClose}>
        Close
      </button>
    </Sheet>
  );
}
