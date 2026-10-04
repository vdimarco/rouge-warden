import { useCallback, useEffect, useState } from 'react';
import { playRingChord, playSwitchNote, unlockAudio } from '../audio';
import { SoundToggle } from '../SoundToggle';
import { useReducedMotion } from '../useReducedMotion';
import { RING_AT, SCENE_FRAMES } from './scenes';
import { markIntroSeen } from './seen';
import { RECAP, SCENES, SCORE_BEATS } from './story';
import { useSceneClock } from './useSceneClock';

const LENGTHS = SCENES.map((scene) => scene.ms);
const SCORE_SCENE = SCENES.findIndex((scene) => scene.id === 'score');
const RING_SCENE = SCENES.findIndex((scene) => scene.id === 'ring');

interface ExplainerProps {
  /** play: the end card starts a new run. back: the end card goes back to the run in progress. */
  exit: 'play' | 'back';
  /** Skip, Escape, Close, and Back to the game. */
  onClose: () => void;
  /** Play on the end card. */
  onPlay: () => void;
}

/** How to play: 7 short animated scenes with the game's cards, then a list of the rules. */
export function Explainer({ exit, onClose, onPlay }: ExplainerProps) {
  const reduced = useReducedMotion();
  const [held, setHeld] = useState(false);
  const [stopped, setStopped] = useState(false);

  const onCue = useCallback((scene: number, from: number, to: number) => {
    const between = (at: number) => at > from && at <= to;
    if (scene === SCORE_SCENE) {
      for (const beat of SCORE_BEATS) if (beat.note !== null && between(beat.at)) playSwitchNote(beat.note);
    }
    if (scene === RING_SCENE && between(RING_AT)) playRingChord();
  }, []);

  const { scene, t, go } = useSceneClock(LENGTHS, held || stopped, onCue);
  const done = scene >= SCENES.length;
  const info = SCENES[scene];

  // A player who watched to the end has seen it, even without a tap on Play.
  useEffect(() => {
    if (done) markIntroSeen();
  }, [done]);

  const next = useCallback(() => go(scene + 1), [go, scene]);
  const back = useCallback(() => go(scene - 1), [go, scene]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') next();
      else if (event.key === 'ArrowLeft') back();
      else if (event.key === 'Escape') onClose();
      else if (event.key === ' ' && !done) setStopped((value) => !value);
      else return;
      event.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, back, onClose, done]);

  const release = () => setHeld(false);
  const paused = (held || stopped) && !done;

  return (
    <div className="screen explainer" data-testid="explainer" data-scene={scene} onPointerDownCapture={unlockAudio}>
      <header className="ex-head">
        <h1 className="ex-heading">How to play</h1>
        <span className="ex-count" aria-live="off">
          {done ? 'Done' : `${scene + 1} of ${SCENES.length}`}
        </span>
        <SoundToggle />
        <button type="button" className="btn ex-skip" onClick={onClose}>
          {done ? 'Close' : 'Skip'}
        </button>
      </header>

      <div className="ex-bars" data-testid="ex-bars" aria-hidden="true">
        {SCENES.map((s, i) => (
          <span key={s.id} className="ex-bar-track">
            <span className="ex-bar-fill" style={{ transform: `scaleX(${i < scene ? 1 : i === scene ? t / s.ms : 0})` }} />
          </span>
        ))}
      </div>

      <div className="ex-body">
        <div className="ex-stage-wrap">
          {done ? (
            <div className="ex-end" data-testid="ex-end">
              <ul className="ex-recap">
                {RECAP.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          ) : (
            <div
              className={`ex-stage${paused ? ' paused' : ''}`}
              data-testid="ex-stage"
              aria-hidden="true"
              onPointerDown={() => setHeld(true)}
              onPointerUp={release}
              onPointerCancel={release}
              onPointerLeave={release}
              onContextMenu={(event) => event.preventDefault()}
            >
              {SCENE_FRAMES[scene](t, reduced)}
              {paused && <span className="ex-paused">Paused</span>}
            </div>
          )}
        </div>

        <div className="ex-caption" aria-live="polite">
          <h2 className="ex-title" data-testid="ex-title">
            {done ? 'Ready to play?' : info.title}
          </h2>
          <p className="ex-text">
            {done ? (exit === 'play' ? 'Tap Play to start a run.' : 'Tap Back to the game to go on with your run.') : info.text}
          </p>
        </div>
      </div>

      <div className="actions ex-actions">
        {done ? (
          <>
            <button type="button" className="btn" onClick={() => go(0)}>
              Watch again
            </button>
            <button type="button" className="btn primary" onClick={exit === 'play' ? onPlay : onClose}>
              {exit === 'play' ? 'Play' : 'Back to the game'}
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn" onClick={back} disabled={scene === 0}>
              Back
            </button>
            <button type="button" className="btn primary" onClick={next}>
              {scene === SCENES.length - 1 ? 'Finish' : 'Next'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
