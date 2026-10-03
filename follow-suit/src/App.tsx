import { useState } from 'react';
import { beginTable, leaveShop, newRun, openShop, type RunState } from './engine';
import { RunEnd } from './ui/RunEnd';
import { seedFromUrl } from './ui/seed';
import { ShopScreen } from './ui/ShopScreen';
import { StartScreen } from './ui/StartScreen';
import { StopIntro } from './ui/StopIntro';
import { TableScreen } from './ui/TableScreen';

export function App() {
  // `?seed=` in the address skips the start screen.
  const [run, setRun] = useState<RunState | null>(() => {
    const seed = seedFromUrl();
    return seed === null ? null : newRun(seed);
  });

  if (run === null) return <StartScreen onStart={(seed) => setRun(newRun(seed))} />;

  switch (run.phase) {
    case 'intro':
      return <StopIntro key={`intro-${run.stop}`} run={run} onBegin={() => setRun(beginTable(run))} />;
    case 'table':
    case 'cleared':
      return (
        <TableScreen
          key={`table-${run.stop}-${run.tableIndex}`}
          run={run}
          onChange={setRun}
          onOpenShop={() => setRun(openShop(run))}
        />
      );
    case 'shop':
      return (
        <ShopScreen
          key={`shop-${run.stop}-${run.tableIndex}`}
          run={run}
          onChange={setRun}
          onLeave={() => setRun(leaveShop(run))}
        />
      );
    case 'won':
    case 'lost':
      return <RunEnd run={run} onNewRun={() => setRun(null)} />;
  }
}
