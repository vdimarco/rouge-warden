import { useMemo, useState } from 'react';
import { CONFIG } from '../config';
import {
  addCard,
  canPlay,
  canRedraw,
  isWild,
  legalCardIds,
  namedSuitOptions,
  needsNamedSuit,
  playChain,
  previewChain,
  redraw,
  undoCard,
  type Card,
  type Suit,
  type TableState,
} from '../engine';
import { ActionBar } from './ActionBar';
import { ChainArea } from './ChainArea';
import { Hand, type HandMode } from './Hand';
import { SuitPicker } from './SuitPicker';
import { TableEnd } from './TableEnd';
import { TopBar } from './TopBar';

interface TableScreenProps {
  table: TableState;
  seed: string;
  money: number;
  onChange: (next: TableState) => void;
  onNewTable: () => void;
}

export function TableScreen({ table, seed, money, onChange, onNewTable }: TableScreenProps) {
  const [mode, setMode] = useState<HandMode>('build');
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [pendingEight, setPendingEight] = useState<Card | null>(null);
  const [shakeId, setShakeId] = useState<string | null>(null);

  const legalIds = useMemo(() => legalCardIds(table), [table]);
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
    if (needsNamedSuit(card)) {
      setPendingEight(card);
      return;
    }
    onChange(addCard(table, card.id));
  }

  function pickSuit(suit: Suit) {
    if (pendingEight !== null) onChange(addCard(table, pendingEight.id, suit));
    setPendingEight(null);
  }

  function leaveRedraw() {
    setSelected(new Set());
    setMode('build');
  }

  function confirmRedraw() {
    onChange(redraw(table, [...selected]));
    leaveRedraw();
  }

  return (
    <div className="screen table-screen">
      <TopBar
        stop={table.stop}
        tableIndex={table.tableIndex}
        target={table.target}
        total={table.total}
        money={money}
        chainsLeft={table.chainsLeft}
        redrawsLeft={table.redrawsLeft}
        seed={seed}
      />

      <ChainArea
        chain={table.chain}
        preview={preview}
        ringMult={CONFIG.chain.ringMult}
        lastPlay={table.lastPlay}
        hint={mode === 'redraw' ? 'Tap cards to discard, then Confirm.' : undefined}
      />

      <Hand
        cards={table.hand}
        chainIds={chainIds}
        legalIds={legalIds}
        selectedIds={selected}
        mode={mode}
        shakeId={shakeId}
        isWild={isWild}
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
        onUndo={() => onChange(undoCard(table))}
        onPlay={() => onChange(playChain(table))}
        onRedraw={() => setMode('redraw')}
        onConfirm={confirmRedraw}
        onCancel={leaveRedraw}
      />

      {pendingEight !== null && (
        <SuitPicker
          card={pendingEight}
          options={namedSuitOptions(table.chain, pendingEight)}
          onPick={pickSuit}
          onCancel={() => setPendingEight(null)}
        />
      )}

      {table.status !== 'playing' && <TableEnd table={table} seed={seed} onNewTable={onNewTable} />}
    </div>
  );
}
