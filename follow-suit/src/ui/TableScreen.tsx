import { useMemo, useState } from 'react';
import { CONFIG } from '../config';
import {
  canPlay,
  canRedraw,
  isWild,
  legalCardIds,
  namedSuitOptions,
  needsNamedSuit,
  previewChain,
  runAddCard,
  runPlay,
  runRedraw,
  runRules,
  runUndo,
  type Card,
  type RunState,
  type SlotId,
  type Suit,
} from '../engine';
import { ActionBar } from './ActionBar';
import { ChainArea } from './ChainArea';
import { CharmBoard, CharmSheet } from './CharmBoard';
import { ClearedPanel } from './ClearedPanel';
import { DeckView } from './DeckView';
import { Hand, type HandMode } from './Hand';
import { HostBanner } from './HostBanner';
import { SuitPicker } from './SuitPicker';
import { TopBar } from './TopBar';

interface TableScreenProps {
  run: RunState;
  onChange: (next: RunState) => void;
  onOpenShop: () => void;
}

export function TableScreen({ run, onChange, onOpenShop }: TableScreenProps) {
  const table = run.table!;
  const rules = runRules(run);
  const [mode, setMode] = useState<HandMode>('build');
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [pendingEight, setPendingEight] = useState<Card | null>(null);
  const [shakeId, setShakeId] = useState<string | null>(null);
  const [charmSlot, setCharmSlot] = useState<SlotId | null>(null);
  const [deckOpen, setDeckOpen] = useState(false);

  const legalIds = useMemo(() => legalCardIds(table, run.charms), [table, run.charms]);
  const chainIds = useMemo(() => new Set(table.chain.map((link) => link.card.id)), [table.chain]);
  const preview = useMemo(() => previewChain(table.chain), [table.chain]);

  function tapCard(card: Card) {
    if (table.status !== 'playing') return;
    if (mode === 'redraw') {
      setSelected((current) => {
        const next = new Set(current);
        if (next.has(card.id)) next.delete(card.id);
        else next.add(card.id);
        return next;
      });
      return;
    }
    if (!legalIds.has(card.id)) {
      setShakeId(card.id);
      return;
    }
    if (needsNamedSuit(card, rules)) {
      setPendingEight(card);
      return;
    }
    onChange(runAddCard(run, card.id));
  }

  function pickSuit(suit: Suit) {
    if (pendingEight !== null) onChange(runAddCard(run, pendingEight.id, suit));
    setPendingEight(null);
  }

  function leaveRedraw() {
    setSelected(new Set());
    setMode('build');
  }

  function confirmRedraw() {
    onChange(runRedraw(run, [...selected]));
    leaveRedraw();
  }

  return (
    <div className="screen table-screen">
      <TopBar
        stop={table.stop}
        tableIndex={table.tableIndex}
        target={table.target}
        total={table.total}
        money={run.money}
        chainsLeft={table.chainsLeft}
        redrawsLeft={table.redrawsLeft}
        seed={run.seed}
        deckSize={run.deck.length}
        onDeck={() => setDeckOpen(true)}
      />

      {table.host !== null && <HostBanner host={table.host} />}

      <CharmBoard charms={run.charms} onTap={setCharmSlot} />

      <ChainArea
        chain={table.chain}
        preview={preview}
        ringMult={CONFIG.chain.ringMult}
        lastPlay={table.lastPlay}
        rules={rules}
        hint={mode === 'redraw' ? 'Tap cards to discard, then Confirm.' : undefined}
      />

      <Hand
        cards={table.hand}
        chainIds={chainIds}
        legalIds={legalIds}
        selectedIds={selected}
        mode={mode}
        shakeId={shakeId}
        isWild={(card) => isWild(card, rules)}
        onTap={tapCard}
        onShakeEnd={() => setShakeId(null)}
      />

      <ActionBar
        mode={mode}
        canUndo={table.status === 'playing' && table.chain.length > 0}
        canPlay={canPlay(table)}
        canRedraw={canRedraw(table)}
        redrawsLeft={table.redrawsLeft}
        selectedCount={selected.size}
        onUndo={() => onChange(runUndo(run))}
        onPlay={() => onChange(runPlay(run))}
        onRedraw={() => setMode('redraw')}
        onConfirm={confirmRedraw}
        onCancel={leaveRedraw}
      />

      {pendingEight !== null && (
        <SuitPicker
          card={pendingEight}
          options={namedSuitOptions(table.chain, pendingEight, rules)}
          onPick={pickSuit}
          onCancel={() => setPendingEight(null)}
        />
      )}
      {charmSlot !== null && (
        <CharmSheet slot={charmSlot} charm={run.charms[charmSlot]} onClose={() => setCharmSlot(null)} />
      )}
      {deckOpen && <DeckView cards={run.deck} onClose={() => setDeckOpen(false)} />}
      {run.phase === 'cleared' && <ClearedPanel run={run} onOpenShop={onOpenShop} />}
    </div>
  );
}
