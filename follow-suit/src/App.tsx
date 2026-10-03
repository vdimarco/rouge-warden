import { useState } from 'react';
import { CONFIG } from './config';
import { createDeck, createRng, seedState, startTable, tableTarget, type TableState } from './engine';
import { randomSeed, seedFromUrl } from './ui/seed';
import { TableScreen } from './ui/TableScreen';

interface Game {
  seed: string;
  table: TableState;
}

// Milestone 2 plays one table: the first table of stop 1, with no charms.
function newGame(seed: string): Game {
  const rng = createRng(seedState(seed));
  const table = startTable(createDeck(), { stop: 1, tableIndex: 0, target: tableTarget(1, 0) }, rng);
  return { seed, table };
}

export function App() {
  const [game, setGame] = useState<Game>(() => newGame(seedFromUrl() ?? randomSeed()));

  return (
    <TableScreen
      key={game.seed}
      table={game.table}
      seed={game.seed}
      money={CONFIG.run.startMoney}
      onChange={(table) => setGame((current) => ({ ...current, table }))}
      onNewTable={() => setGame(newGame(randomSeed()))}
    />
  );
}
