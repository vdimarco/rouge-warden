import { useState } from 'react';
import { beginTable, leaveShop, newRun, openShop, type RunState } from './engine';
import { Explainer } from './ui/explainer/Explainer';
import { introSeen, markIntroSeen } from './ui/explainer/seen';
import { RunEnd } from './ui/RunEnd';
import { randomSeed, seedFromUrl } from './ui/seed';
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
  // The explainer opens by itself on a first visit. A seed link goes straight to its run.
  const [howToPlay, setHowToPlay] = useState(() => seedFromUrl() === null && !introSeen());

  if (howToPlay) {
    const close = () => {
      markIntroSeen();
      setHowToPlay(false);
    };
    return (
      <Explainer
        exit={run === null ? 'play' : 'back'}
        onClose={close}
        onPlay={() => {
          close();
          setRun(newRun(randomSeed()));
        }}
      />
    );
  }

  if (run === null) return <StartScreen onStart={(seed) => setRun(newRun(seed))} onHowToPlay={() => setHowToPlay(true)} />;

  switch (run.phase) {
    case 'intro':
      return (
        <StopIntro
          key={`intro-${run.stop}`}
          run={run}
          onBegin={() => setRun(beginTable(run))}
          onHowToPlay={() => setHowToPlay(true)}
        />
      );
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
